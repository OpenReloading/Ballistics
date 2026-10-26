/**
 * Powder fit: fits the burn coefficient and, on request, the start pressure of the M3 interior
 * model to a chronograph ladder by weighted least squares, with optional Gaussian priors and a
 * Huber loss, and the prediction band of the fitted load at any charge,
 * `apps/docs/docs/models/interior-powder-fit.md`.
 * Every evaluation runs `interior` once per distinct charge. SI in and out.
 */
import { InputError, need, nth } from '../errors.ts'
import { chiSquareQuantile } from '../groups/chi-square.ts'
import { studentTwoSidedQuantile } from '../groups/student-t.ts'
import { logLeastSquares } from '../least-squares.ts'
import type { Settings } from '../settings.ts'
import {
  type InteriorInvalid,
  type InteriorLoad,
  type InteriorOptions,
  type InteriorResult,
  interior,
} from './model.ts'

/** One charge of a chronograph ladder: measured muzzle velocity and, optionally, peak pressure. */
export interface LadderPoint {
  /** Charge mass, kg. */
  charge: number
  /** Mean muzzle velocity of the string, m/s. */
  muzzleVelocity: number
  /** Standard uncertainty of `muzzleVelocity`, m/s; on all points or none. */
  velocitySigma?: number
  /** Measured peak pressure, Pa; compared with the predicted peak breech pressure. */
  peakPressure?: number
  /** Standard uncertainty of `peakPressure`, Pa; required with `peakPressure`. */
  pressureSigma?: number
}

/**
 * Parameter of the fit: the burn coefficient (or vivacity, by the load's burn kind) and the start
 * pressure, Pa.
 */
export type PowderParameter = 'burnRate' | 'startPressure'

/**
 * Gaussian prior of one fitted parameter in its log parameter
 * (`apps/docs/docs/models/interior-powder-fit.md`, "Prior and robust loss").
 */
export interface PowderPrior {
  /**
   * Centre of the prior, in the unit of the parameter. Burn coefficient: above 0. Start pressure:
   * above the floor of the shot start, as the fitted value is.
   */
  value: number
  /** Standard deviation of the log parameter: of ln(value) for the burn coefficient, of ln(value - floor) for the start pressure. */
  sigma: number
}

/** Options of `fitPowder`. */
export interface PowderFitOptions {
  /**
   * Default ['burnRate']; `startPressure` is resolved only with measured pressures
   * (`apps/docs/docs/models/interior-powder-fit.md`, "Identifiability").
   */
  parameters?: readonly PowderParameter[] | undefined
  /**
   * Levenberg-Marquardt iterations (accepted plus rejected steps) before the fit fails with reason
   * `not-converged`; default 30.
   */
  maxIterations?: number | undefined
  /** Largest condition number of the column-scaled Jacobian; default 1e3. */
  maxCondition?: number | undefined
  /**
   * Priors on fitted parameters; none by default. The fit then returns the maximum of the
   * posterior. Needs `velocitySigma` on the ladder.
   */
  priors?: Partial<Record<PowderParameter, PowderPrior | undefined>>
  /**
   * Threshold of a Huber loss in sigmas of the ladder rows; none by default, quadratic loss. Needs
   * `velocitySigma` on the ladder.
   */
  huberThreshold?: number | undefined
  /** Integration settings of every `interior` run; default `interiorDefaults`. */
  options?: Settings<InteriorOptions> | undefined
}

/** A fitted parameter: start value, result and uncertainty. */
export interface FittedPowderParameter {
  /** Which parameter. */
  name: PowderParameter
  /** Value in the input load. */
  initial: number
  /** Fitted value, same unit as `initial`. */
  value: number
  /** Standard uncertainty; absent when it cannot be estimated (n = p without sigmas). */
  standardUncertainty?: number
}

/** Observed and predicted value of one ladder row after the fit. */
export interface PowderFitResidual {
  /** Muzzle velocity (m/s) or peak pressure (Pa); the unit of the values below. */
  kind: 'velocity' | 'pressure'
  /** Charge mass of the ladder point, kg. */
  charge: number
  /** Measured value. */
  observed: number
  /** Value of `interior` at the fitted parameters. */
  predicted: number
  /** Predicted minus observed. */
  residual: number
}

/** Result of `fitPowder`. */
export interface PowderFit {
  /** The input load with the fitted values applied; its charge is the input's. */
  load: InteriorLoad
  /** Fitted parameters, in the order of `PowderFitOptions.parameters`. */
  parameters: FittedPowderParameter[]
  /** Absent like `standardUncertainty`. */
  correlation?: number[][]
  /**
   * Covariance of the log parameters of `PowderParameter` order (the fit's theta, relative to each
   * parameter's initial value); absent like `standardUncertainty`. `predictPowder` propagates it.
   */
  covariance?: number[][]
  /** Whether the ladder carried velocity uncertainties; without them the covariance is scaled by the residual. */
  weighted: boolean
  /** One row per velocity, then pressure, of each ladder point in input order. */
  residuals: PowderFitResidual[]
  /** Sum of squared residuals over sigma (sigma 1 where the ladder has none), plus `priorChiSquare`. */
  chiSquare: number
  /** The ladder rows' share of `chiSquare`, whatever the loss. */
  dataChiSquare: number
  /** The priors' share of `chiSquare`: the squared distance of each log parameter from its prior centre in prior sigmas; 0 without priors. */
  priorChiSquare: number
  /** The minimized cost: `chiSquare`, or with `huberThreshold` the Huber loss of the rows plus `priorChiSquare`. */
  loss: number
  /** Degrees of freedom: rows minus parameters. */
  degreesOfFreedom: number
  /** Condition number of the column-scaled Jacobian at the solution. */
  conditionNumber: number
  /** Smallest and largest ladder charge, kg; the fitted values describe this span only. */
  chargeRange: { min: number; max: number }
  /** Iterations of the solver. */
  iterations: number
  /** `interior` runs of the fit. */
  runCount: number
}

/** Why a fit failed, the `reason` of a `PowderFitError`; `invalid` is an invalid `interior` run. */
export type PowderFitReason =
  | 'underdetermined'
  | 'unresolved'
  | 'ill-conditioned'
  | 'invalid'
  | 'not-converged'

/**
 * Failure of `fitPowder`: `reason` is `underdetermined` (fewer ladder rows than parameters),
 * `unresolved` or `ill-conditioned` (the ladder does not separate the parameters), `invalid` (an
 * `interior` run at a ladder charge is not valid) or `not-converged` (`maxIterations` reached).
 */
export class PowderFitError extends InputError {
  readonly reason: PowderFitReason
  readonly conditionNumber?: number | undefined
  /** Indices of parameters the ladder does not resolve. */
  readonly unresolved?: number[] | undefined
  /** Parameter combination (in log parameters, column-scaled) with the smallest eigenvalue. */
  readonly direction?: number[] | undefined
  readonly estimate?: FittedPowderParameter[] | undefined
  /** With `invalid`: the ladder charge, kg, whose `interior` run was invalid. */
  readonly charge?: number | undefined
  /** With `invalid`: that run's result. */
  readonly result?: InteriorInvalid | undefined

  constructor(
    reason: PowderFitReason,
    extra: {
      conditionNumber?: number | undefined
      unresolved?: number[] | undefined
      direction?: number[] | undefined
      estimate?: FittedPowderParameter[] | undefined
      charge?: number | undefined
      result?: InteriorInvalid | undefined
    } = {},
  ) {
    super(`powder fit: ${reason}`)
    this.name = 'PowderFitError'
    this.reason = reason
    this.conditionNumber = extra.conditionNumber
    this.unresolved = extra.unresolved
    this.direction = extra.direction
    this.estimate = extra.estimate
    this.charge = extra.charge
    this.result = extra.result
  }
}

const positive = (v: number | undefined) => v === undefined || (Number.isFinite(v) && v > 0)

/** Start pressure below which the shot start does not depend on it: max(p_i, p_f + p_e(0)). */
function startPressureFloor(load: InteriorLoad): number {
  const first = load.resistance?.engraving?.[0]
  const engraving = first?.travel === 0 ? first.pressure : 0
  return Math.max(load.ignitionPressure, (load.resistance?.friction ?? 0) + engraving)
}

type Valid = Extract<InteriorResult, { valid: true }>

/** Checks the ladder points; returns how many carry `velocitySigma` (all or none). */
function checkLadder(ladder: readonly LadderPoint[]): number {
  need(ladder.length > 0, 'at least one ladder point')
  for (const x of ladder) {
    need(x.charge !== undefined && positive(x.charge), 'ladder charge must be positive')
    need(
      x.muzzleVelocity !== undefined && positive(x.muzzleVelocity),
      'ladder velocity must be positive',
    )
    need(positive(x.velocitySigma), 'velocitySigma must be positive')
    need(positive(x.peakPressure), 'ladder pressure must be positive')
    need(positive(x.pressureSigma), 'pressureSigma must be positive')
    need(
      (x.peakPressure === undefined) === (x.pressureSigma === undefined),
      'peakPressure and pressureSigma together',
    )
  }
  const withSigma = ladder.filter((x) => x.velocitySigma !== undefined).length
  need(withSigma === 0 || withSigma === ladder.length, 'velocitySigma on all points or none')
  need(
    withSigma > 0 || ladder.every((x) => x.peakPressure === undefined),
    'pressures need velocity sigmas',
  )
  return withSigma
}

/** One observation of the fit: a ladder velocity or pressure with its sigma (1 without one). */
interface LadderRow {
  kind: 'velocity' | 'pressure'
  charge: number
  value: number
  sigma: number
}

/** The velocity, then the pressure, of each ladder point in input order. */
function ladderRows(ladder: readonly LadderPoint[]): LadderRow[] {
  return ladder.flatMap((x) => [
    {
      kind: 'velocity' as const,
      charge: x.charge,
      value: x.muzzleVelocity,
      sigma: x.velocitySigma ?? 1,
    },
    ...(x.peakPressure === undefined
      ? []
      : [
          {
            kind: 'pressure' as const,
            charge: x.charge,
            value: x.peakPressure,
            sigma: x.pressureSigma ?? 1,
          },
        ]),
  ])
}

/**
 * Maps the fitted parameters onto the load: start values, the load at given values, and the
 * values at log parameters theta.
 */
function powderParameterMap(
  load: InteriorLoad,
  parameters: readonly PowderParameter[],
  floor: number,
) {
  const fitsStart = parameters.includes('startPressure')
  const burn = load.propellant.burn
  const initial = parameters.map((p) =>
    p === 'startPressure'
      ? load.startPressure
      : burn.kind === 'vivacity'
        ? burn.vivacity
        : burn.coefficient,
  )
  const apply = (values: number[]): InteriorLoad => {
    const at = (name: PowderParameter) => values[parameters.indexOf(name)]
    const rate = parameters.includes('burnRate') ? at('burnRate') : undefined
    return {
      ...load,
      ...(fitsStart ? { startPressure: at('startPressure') } : {}),
      ...(rate === undefined
        ? {}
        : {
            propellant: {
              ...load.propellant,
              burn:
                burn.kind === 'vivacity'
                  ? { ...burn, vivacity: rate }
                  : { ...burn, coefficient: rate },
            },
          }),
    }
  }
  // log parameters; the start pressure in ln((p_st - p_floor)/(p_st0 - p_floor)), so no step reaches the floor
  const offset = parameters.map((p) => (p === 'startPressure' ? floor : 0))
  const q = (theta: number[]) =>
    initial.map((v, j) => {
      const base = nth(offset, j)
      return base + (v - base) * Math.exp(nth(theta, j))
    })
  const estimate = (theta: number[]): FittedPowderParameter[] => {
    const values = q(theta)
    return parameters.map((name, j) => ({ name, initial: nth(initial, j), value: nth(values, j) }))
  }
  return { initial, apply, offset, q, estimate }
}

/** Fits burn coefficient and optionally start pressure of `load` to the ladder. */
export function fitPowder(
  load: InteriorLoad,
  ladder: readonly LadderPoint[],
  options: PowderFitOptions = {},
): PowderFit {
  const { parameters = ['burnRate'], maxIterations = 30, maxCondition = 1e3 } = options
  const withSigma = checkLadder(ladder)
  need(
    parameters.length > 0 &&
      new Set(parameters).size === parameters.length &&
      parameters.every((p) => p === 'burnRate' || p === 'startPressure'),
    'parameters: burnRate and startPressure, each at most once',
  )
  need(
    Number.isInteger(maxIterations) && maxIterations > 0,
    'maxIterations must be a positive integer',
  )
  need(maxCondition > 0, 'maxCondition must be positive')
  need(
    options.huberThreshold === undefined ||
      (Number.isFinite(options.huberThreshold) && options.huberThreshold > 0),
    'huberThreshold must be positive',
  )
  const priors = options.priors ?? {}
  const priorNames = (Object.keys(priors) as PowderParameter[]).filter(
    (n) => priors[n] !== undefined,
  )
  need(
    priorNames.every((name) => parameters.includes(name)),
    'a prior needs its parameter in parameters',
  )
  need(
    withSigma > 0 || (priorNames.length === 0 && options.huberThreshold === undefined),
    'priors and huberThreshold need velocity sigmas',
  )
  const floor = startPressureFloor(load)
  need(
    !parameters.includes('startPressure') || load.startPressure > floor,
    'startPressure must be above the ignition pressure and the resistance at travel 0',
  )

  const rows = ladderRows(ladder)
  if (rows.length < parameters.length) throw new PowderFitError('underdetermined')
  const { initial, apply, offset, q, estimate } = powderParameterMap(load, parameters, floor)

  // a prior is a pseudo-row after the data: observed log centre, predicted theta, its sigma
  const priorRows = priorNames.map((name) => {
    const prior = priors[name] as PowderPrior
    const k = parameters.indexOf(name)
    const base = nth(offset, k)
    need(
      Number.isFinite(prior.value) &&
        prior.value > base &&
        Number.isFinite(prior.sigma) &&
        prior.sigma > 0,
      `prior ${name}: value above ${base === 0 ? '0' : 'the floor'}, sigma above 0`,
    )
    return {
      k,
      sigma: prior.sigma,
      centre: Math.log((prior.value - base) / (nth(initial, k) - base)),
    }
  })

  const charges = [...new Set(ladder.map((x) => x.charge))]
  const index = rows.map((o) => charges.indexOf(o.charge))
  let runCount = 0
  /** The last invalid run. */
  let rejected: { charge?: number; result?: InteriorInvalid } = {}
  /** Predicted values per observation, or null when a run is invalid. */
  const evaluate = (values: number[]): number[] | null => {
    const trial = apply(values)
    const results: Valid[] = []
    for (const charge of charges) {
      runCount++
      const r = interior({ ...trial, charge }, options.options)
      if (!r.valid) {
        rejected = { charge, result: r }
        return null
      }
      results.push(r)
    }
    return rows.map((o, i) =>
      o.kind === 'velocity'
        ? nth(results, nth(index, i)).muzzleVelocity
        : nth(results, nth(index, i)).peakBreechPressure,
    )
  }

  // q(0), not `initial`: with the start pressure fitted they can differ in the last place
  const first = evaluate(q(parameters.map(() => 0)))
  if (!first) throw new PowderFitError('invalid', rejected)
  const fit = logLeastSquares({
    parameterCount: parameters.length,
    observed: [...rows.map((o) => o.value), ...priorRows.map((x) => x.centre)],
    standardUncertainty: [...rows.map((o) => o.sigma), ...priorRows.map((x) => x.sigma)],
    weighted: withSigma > 0,
    // a Jacobian entry below 1e-6 of the observation per unit log parameter is noise; a prior row never is
    floor: [...rows.map((o) => (1e-6 * o.value) / o.sigma), ...priorRows.map(() => 0)],
    first: [...first, ...priorRows.map(() => 0)],
    predict: (trial) => {
      const out = evaluate(q(trial))
      return out && [...out, ...priorRows.map((x) => nth(trial, x.k))]
    },
    ...(options.huberThreshold === undefined
      ? {}
      : { huber: { threshold: options.huberThreshold, count: rows.length } }),
    maxIterations,
    maxCondition,
    fail: (reason, theta, extra = {}) => {
      const e = { ...extra, estimate: estimate(theta) }
      throw reason === 'unreachable'
        ? new PowderFitError('invalid', { ...e, ...rejected })
        : new PowderFitError(reason, e)
    },
  })
  const values = q(fit.theta)
  const priorChiSquare = priorRows.reduce(
    (sum, x) => sum + ((nth(fit.theta, x.k) - x.centre) / x.sigma) ** 2,
    0,
  )
  return {
    load: apply(values),
    parameters: parameters.map((name, k) => {
      const value = nth(values, k)
      return {
        name,
        initial: nth(initial, k),
        value,
        ...(fit.standardUncertainty
          ? { standardUncertainty: (value - nth(offset, k)) * nth(fit.standardUncertainty, k) }
          : {}),
      }
    }),
    ...(fit.correlation ? { correlation: fit.correlation } : {}),
    ...(fit.covariance ? { covariance: fit.covariance } : {}),
    weighted: withSigma > 0,
    residuals: rows.map((o, i) => {
      const predicted = nth(fit.predicted, i)
      return {
        kind: o.kind,
        charge: o.charge,
        observed: o.value,
        predicted,
        residual: predicted - o.value,
      }
    }),
    chiSquare: fit.chiSquare,
    dataChiSquare: rows.reduce(
      (sum, o, i) => sum + ((nth(fit.predicted, i) - o.value) / o.sigma) ** 2,
      0,
    ),
    priorChiSquare,
    loss: fit.loss,
    degreesOfFreedom: rows.length - parameters.length,
    conditionNumber: fit.conditionNumber,
    chargeRange: { min: Math.min(...charges), max: Math.max(...charges) },
    iterations: fit.iterations,
    runCount,
  }
}

/** Options of `predictPowder`. */
export interface PowderPredictionOptions {
  /** Coverage of the interval, in (0, 1); default 0.9. */
  level?: number | undefined
  /** Integration settings of the `interior` runs; use the fit's own, default `interiorDefaults`. */
  options?: Settings<InteriorOptions> | undefined
}

/** A predicted value with its parameter uncertainty and interval. */
export interface PowderPredictionBand {
  /** Value of `interior` at the fitted parameters: m/s or Pa. */
  value: number
  /** Standard uncertainty from the parameter covariance only, same unit. */
  standardUncertainty: number
  /** Lower end of the interval, same unit. */
  lower: number
  /** Upper end of the interval, same unit. */
  upper: number
}

/** Prediction of the fitted load at one charge; parameter uncertainty only, no model error. */
export interface PowderPrediction {
  /** Charge mass, kg. */
  charge: number
  /** Coverage of the intervals. */
  level: number
  /** Muzzle velocity. */
  velocity: PowderPredictionBand
  /** Peak breech pressure. */
  pressure: PowderPredictionBand
  /** Set where the charge lies outside the ladder's `chargeRange`: below or above it. */
  extrapolation?: 'below' | 'above'
  /** `interior` runs of the prediction. */
  runCount: number
}

/**
 * Muzzle velocity and peak breech pressure of a fitted powder at `charge`, with the standard
 * uncertainty and the interval that the covariance of the fitted parameters gives
 * (`apps/docs/docs/models/interior-powder-fit.md`, "Prediction at a charge"). Needs the covariance
 * of the fit: a ladder with more rows than parameters or with velocity sigmas.
 */
export function predictPowder(
  fit: PowderFit,
  charge: number,
  options: PowderPredictionOptions = {},
): PowderPrediction {
  const { level = 0.9 } = options
  need(Number.isFinite(charge) && charge > 0, 'charge must be positive')
  need(level > 0 && level < 1, 'level must lie in (0, 1)')
  const { covariance } = fit
  if (!covariance) throw new InputError('the fit has no covariance: add rows or velocity sigmas')
  const names = fit.parameters.map((p) => p.name)
  const { apply, q } = powderParameterMap(fit.load, names, startPressureFloor(fit.load))
  let runCount = 0
  const run = (theta: number[]): [number, number] => {
    runCount++
    const r = interior({ ...apply(q(theta)), charge }, options.options)
    if (!r.valid) throw new PowderFitError('invalid', { charge, result: r })
    return [r.muzzleVelocity, r.peakBreechPressure]
  }
  const zero = names.map(() => 0)
  const [velocity, pressure] = run(zero)
  // gradient of both outputs in the log parameters, by central differences
  const gradient = names.map((_, j): [number, number] => {
    const at = (d: number) => run(zero.map((x, k) => (k === j ? x + d : x)))
    const [vu, pu] = at(1e-3)
    const [vd, pd] = at(-1e-3)
    return [(vu - vd) / 2e-3, (pu - pd) / 2e-3]
  })
  const quantile = fit.weighted
    ? Math.sqrt(chiSquareQuantile(level, 1))
    : studentTwoSidedQuantile(level, fit.degreesOfFreedom)
  const band = (value: number, i: number): PowderPredictionBand => {
    const variance = gradient.reduce(
      (sum, gj, j) =>
        sum +
        nth(gj, i) * gradient.reduce((s, gk, k) => s + nth(nth(covariance, j), k) * nth(gk, i), 0),
      0,
    )
    const standardUncertainty = Math.sqrt(Math.max(variance, 0))
    return {
      value,
      standardUncertainty,
      lower: value - quantile * standardUncertainty,
      upper: value + quantile * standardUncertainty,
    }
  }
  const { min, max } = fit.chargeRange
  return {
    charge,
    level,
    velocity: band(velocity, 0),
    pressure: band(pressure, 1),
    ...(charge < min ? { extrapolation: 'below' as const } : {}),
    ...(charge > max ? { extrapolation: 'above' as const } : {}),
    runCount,
  }
}
