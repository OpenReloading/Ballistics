/**
 * Powder fit: fits the burn coefficient and, on request, the start pressure, a correction factor
 * of the chamber volume, the specific energy and a factor on the temperature sensitivities of the
 * M3 interior model to a chronograph ladder, or to ladders at several barrel lengths and powder
 * temperatures, by weighted least squares, with optional Gaussian priors and a Huber loss, and the
 * prediction band of the fitted load at any charge,
 * `apps/docs/docs/models/interior-powder-fit.md`.
 * Every evaluation runs `interior` once per distinct charge, barrel length and temperature. SI in
 * and out.
 */

import type { Settings } from '../errors.ts'
import { InputError, need, nth } from '../errors.ts'
import { chiSquareQuantile } from '../groups/chi-square.ts'
import { studentTwoSidedQuantile } from '../groups/student-t.ts'
import { logLeastSquares } from '../least-squares.ts'
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
  /** Projectile travel to the muzzle of the barrel fired, m; default the load's. */
  barrelLength?: number
  /** Propellant temperature of the string, K; default the load's. */
  propellantTemperature?: number
}

const parameterNames = [
  'burnRate',
  'startPressure',
  'volumeFactor',
  'energy',
  'temperatureFactor',
] as const

/**
 * Parameter of the fit: the burn coefficient (or vivacity, by the load's burn kind), the start
 * pressure, Pa, the factor that multiplies the chamber volume (1 leaves it as given), the specific
 * energy of the propellant, J/kg, and the factor that multiplies both temperature sensitivities of
 * the load (1 leaves them as given; the load must carry them). Energy and the temperature factor
 * are resolved only by ladders at several barrel lengths or several temperatures
 * (`apps/docs/docs/models/interior-powder-fit.md`, "Several barrel lengths and temperatures").
 */
export type PowderParameter = (typeof parameterNames)[number]

/**
 * Gaussian prior of one fitted parameter in its log parameter
 * (`apps/docs/docs/models/interior-powder-fit.md`, "Prior and robust loss").
 */
export interface PowderPrior {
  /**
   * Centre of the prior, in the unit of the parameter. Burn coefficient and volume factor: above 0
   * (a volume factor prior is centred on 1 where the volume is a record's nominal one). Start
   * pressure: above the floor of the shot start, as the fitted value is.
   */
  value: number
  /** Standard deviation of the log parameter: of ln(value) for the burn coefficient and the volume factor, of ln(value - floor) for the start pressure. */
  sigma: number
}

/** Options of `fitPowder`. */
export interface PowderFitOptions {
  /**
   * Default ['burnRate']; `startPressure` is resolved only with measured pressures. `volumeFactor`
   * corrects the load's chamber volume; a ladder too narrow to separate it from the burn rate
   * needs a prior on it or measured pressures (`apps/docs/docs/models/interior-powder-fit.md`,
   * "Identifiability").
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
  /**
   * Relative margin that widens each axis of the fit's `domain`, in [0, 1); default
   * `powderDomainMargin`.
   */
  domainMargin?: number | undefined
}

/** Default relative margin of a fit's `domain`: an assumption, to be tuned against held-out ladders. */
export const powderDomainMargin = 0.05

/** An axis on which a prediction can leave the data a powder was fitted to. */
export type PowderAxis = 'charge' | 'velocity' | 'pressure' | 'boreDiameter' | 'barrelLength'

/** A closed range of one axis, in the axis's SI unit. */
export interface PowderAxisRange {
  /** Smallest value inside. */
  min: number
  /** Largest value inside. */
  max: number
}

/**
 * Where a fit holds: the span of the fitted data on each axis, widened by `margin` (a value at the
 * widened end is inside). `pressure` is absent without measured pressures.
 */
export interface PowderDomain {
  /** Relative margin that widened each range. */
  margin: number
  /** Charge mass, kg. */
  charge: PowderAxisRange
  /** Measured muzzle velocity, m/s. */
  velocity: PowderAxisRange
  /** Measured peak pressure, Pa. */
  pressure?: PowderAxisRange
  /** Bore diameter of the load, m. */
  boreDiameter: PowderAxisRange
  /** Barrel length of the ladder points, m. */
  barrelLength: PowderAxisRange
}

/** The axes on which a prediction lies outside the `domain`, each with the side it lies on. */
export type PowderExtrapolation = Partial<Record<PowderAxis, 'below' | 'above'>>

/** The axes of `values` that lie outside `domain`; an axis without a range or a value is not checked. */
export function outsideDomain(
  domain: PowderDomain,
  values: Partial<Record<PowderAxis, number>>,
): PowderExtrapolation {
  const outside: PowderExtrapolation = {}
  for (const [axis, value] of Object.entries(values) as [PowderAxis, number][]) {
    const range = domain[axis]
    if (range === undefined) continue
    if (value < range.min) outside[axis] = 'below'
    else if (value > range.max) outside[axis] = 'above'
  }
  return outside
}

/** A fitted parameter: start value, result and uncertainty. A volume factor starts at 1. */
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
  /** The input load with the fitted values applied (a volume factor scales its chamber volume); its charge is the input's. */
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
  /** `refined` when a prior on the burn coefficient was given, else `from-scratch`. */
  basis: PowderFitBasis
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
  /** Smallest and largest ladder charge, kg. */
  chargeRange: { min: number; max: number }
  /** The data the fit holds for, with a margin: `predictPowder` names the axes outside it. */
  domain: PowderDomain
  /** Iterations of the solver. */
  iterations: number
  /** `interior` runs of the fit. */
  runCount: number
}

/** What a fit started from: a prior on the burn coefficient (`refined`) or the ladder alone. */
export type PowderFitBasis = 'refined' | 'from-scratch'

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

/** Smallest ratio of the longest to the shortest barrel length at which `energy` is fitted. */
const minLengthSpan = 1.05

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
    need(positive(x.barrelLength), 'barrelLength must be positive')
    need(positive(x.propellantTemperature), 'propellantTemperature must be positive')
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
  barrelLength: number | undefined
  temperature: number | undefined
  value: number
  sigma: number
}

/** The velocity, then the pressure, of each ladder point in input order. */
function ladderRows(ladder: readonly LadderPoint[]): LadderRow[] {
  return ladder.flatMap((x) => [
    {
      kind: 'velocity' as const,
      charge: x.charge,
      barrelLength: x.barrelLength,
      temperature: x.propellantTemperature,
      value: x.muzzleVelocity,
      sigma: x.velocitySigma ?? 1,
    },
    ...(x.peakPressure === undefined
      ? []
      : [
          {
            kind: 'pressure' as const,
            charge: x.charge,
            barrelLength: x.barrelLength,
            temperature: x.propellantTemperature,
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
  const burn = load.propellant.burn
  const startValue = (p: PowderParameter) => {
    if (p === 'startPressure') return load.startPressure
    if (p === 'volumeFactor' || p === 'temperatureFactor') return 1
    if (p === 'energy') return load.propellant.specificEnergy
    return burn.kind === 'vivacity' ? burn.vivacity : burn.coefficient
  }
  const initial = parameters.map(startValue)
  const withPropellant = (
    l: InteriorLoad,
    p: Partial<InteriorLoad['propellant']>,
  ): InteriorLoad => ({
    ...l,
    propellant: { ...l.propellant, ...p },
  })
  const set: Record<PowderParameter, (l: InteriorLoad, v: number) => InteriorLoad> = {
    burnRate: (l, v) =>
      withPropellant(l, {
        burn: burn.kind === 'vivacity' ? { ...burn, vivacity: v } : { ...burn, coefficient: v },
      }),
    startPressure: (l, v) => ({ ...l, startPressure: v }),
    volumeFactor: (l, v) => ({ ...l, chamber: { ...l.chamber, volume: load.chamber.volume * v } }),
    energy: (l, v) => withPropellant(l, { specificEnergy: v }),
    temperatureFactor: (l, v) => {
      const t = load.propellant.temperatureSensitivity
      return t === undefined
        ? l
        : withPropellant(l, { temperatureSensitivity: { ...t, cold: t.cold * v, hot: t.hot * v } })
    },
  }
  const apply = (values: number[]): InteriorLoad =>
    parameters.reduce((l, name, k) => set[name](l, nth(values, k)), load)
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

/** Checks the requested parameters against the load and the ladder; `energy` needs cut-down barrels. */
function checkParameters(
  load: InteriorLoad,
  ladder: readonly LadderPoint[],
  parameters: readonly PowderParameter[],
) {
  need(
    parameters.length > 0 &&
      new Set(parameters).size === parameters.length &&
      parameters.every((p) => parameterNames.includes(p)),
    `parameters: ${parameterNames.join(', ')}, each at most once`,
  )
  const sensitivity = load.propellant.temperatureSensitivity
  need(
    !parameters.includes('temperatureFactor') ||
      (sensitivity !== undefined && (sensitivity.cold !== 0 || sensitivity.hot !== 0)),
    'temperatureFactor needs the load to carry a temperature sensitivity other than 0',
  )
  // a charge ladder at one length leaves the energy to the model error of every fixed input, so cut-down barrels are required
  const lengths = ladder.map((x) => x.barrelLength ?? load.barrel.length)
  if (parameters.includes('energy') && Math.max(...lengths) < minLengthSpan * Math.min(...lengths))
    throw new PowderFitError('unresolved', { unresolved: [parameters.indexOf('energy')] })
}

/**
 * Fits burn coefficient and optionally start pressure, chamber volume factor, specific energy and
 * temperature factor of `load` to the ladder. Points with another `barrelLength` or
 * `propellantTemperature` are fired from another barrel or at another temperature.
 */
export function fitPowder(
  load: InteriorLoad,
  ladder: readonly LadderPoint[],
  options: PowderFitOptions = {},
): PowderFit {
  const {
    parameters = ['burnRate'],
    maxIterations = 30,
    maxCondition = 1e3,
    domainMargin = powderDomainMargin,
  } = options
  need(
    Number.isFinite(domainMargin) && domainMargin >= 0 && domainMargin < 1,
    'domainMargin must lie in [0, 1)',
  )
  const withSigma = checkLadder(ladder)
  checkParameters(load, ladder, parameters)
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

  // one run per distinct charge, barrel length and temperature
  const key = (o: LadderRow) => `${o.charge} ${o.barrelLength} ${o.temperature}`
  const runs = new Map(rows.map((o) => [key(o), o]))
  const conditions = [...runs.values()]
  const keys = [...runs.keys()]
  const index = rows.map((o) => keys.indexOf(key(o)))
  const charges = [...new Set(ladder.map((x) => x.charge))]
  let runCount = 0
  /** The last invalid run. */
  let rejected: { charge?: number; result?: InteriorInvalid } = {}
  /** Predicted values per observation, or null when a run is invalid. */
  const evaluate = (values: number[]): number[] | null => {
    const trial = apply(values)
    const results: Valid[] = []
    for (const { charge, barrelLength, temperature } of conditions) {
      runCount++
      const r = interior(
        {
          ...trial,
          charge,
          ...(barrelLength === undefined
            ? {}
            : { barrel: { ...trial.barrel, length: barrelLength } }),
          ...(temperature === undefined ? {} : { propellantTemperature: temperature }),
        },
        options.options,
      )
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
    basis: priors.burnRate === undefined ? 'from-scratch' : 'refined',
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
    domain: fitDomain(load, ladder, domainMargin),
    iterations: fit.iterations,
    runCount,
  }
}

/** The ranges of the ladder's charges, velocities, pressures and barrel lengths and of the load's bore, widened by `margin`. */
function fitDomain(
  load: InteriorLoad,
  ladder: readonly LadderPoint[],
  margin: number,
): PowderDomain {
  const widen = (values: readonly number[]): PowderAxisRange => ({
    min: Math.min(...values) * (1 - margin),
    max: Math.max(...values) * (1 + margin),
  })
  const pressures = ladder.flatMap((x) => (x.peakPressure === undefined ? [] : [x.peakPressure]))
  return {
    margin,
    charge: widen(ladder.map((x) => x.charge)),
    velocity: widen(ladder.map((x) => x.muzzleVelocity)),
    ...(pressures.length > 0 ? { pressure: widen(pressures) } : {}),
    boreDiameter: widen([load.chamber.boreDiameter]),
    barrelLength: widen(ladder.map((x) => x.barrelLength ?? load.barrel.length)),
  }
}

/** Options of `predictPowder`. */
export interface PowderPredictionOptions {
  /** Coverage of the interval, in (0, 1); default 0.9. */
  level?: number | undefined
  /** Barrel length of the prediction, m; default the load's. */
  barrelLength?: number | undefined
  /** Bore diameter of the prediction, m (the bore area scales with its square); default the load's. */
  boreDiameter?: number | undefined
  /** Propellant temperature of the prediction, K; default the load's. */
  propellantTemperature?: number | undefined
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
  /** Factor on the standard uncertainty that gives the intervals: normal or Student quantile. */
  coverageFactor: number
  /** Muzzle velocity. */
  velocity: PowderPredictionBand
  /** Peak breech pressure. */
  pressure: PowderPredictionBand
  /**
   * The axes on which the prediction lies outside the fit's `domain`, each with its side; absent
   * when it lies inside on all of them. The velocity and pressure axes check the predicted values.
   */
  extrapolation?: PowderExtrapolation
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
  const { level = 0.9, barrelLength, boreDiameter, propellantTemperature } = options
  need(Number.isFinite(charge) && charge > 0, 'charge must be positive')
  need(level > 0 && level < 1, 'level must lie in (0, 1)')
  need(positive(barrelLength), 'barrelLength must be positive')
  need(positive(boreDiameter), 'boreDiameter must be positive')
  need(positive(propellantTemperature), 'propellantTemperature must be positive')
  const { covariance } = fit
  if (!covariance) throw new InputError('the fit has no covariance: add rows or velocity sigmas')
  const names = fit.parameters.map((p) => p.name)
  const { apply, q } = powderParameterMap(fit.load, names, startPressureFloor(fit.load))
  let runCount = 0
  const run = (theta: number[]): [number, number] => {
    runCount++
    const fitted = apply(q(theta))
    const r = interior(
      {
        ...fitted,
        charge,
        ...(barrelLength === undefined
          ? {}
          : { barrel: { ...fitted.barrel, length: barrelLength } }),
        ...(boreDiameter === undefined
          ? {}
          : {
              chamber: {
                ...fitted.chamber,
                boreDiameter,
                boreArea:
                  fitted.chamber.boreArea * (boreDiameter / fitted.chamber.boreDiameter) ** 2,
              },
            }),
        ...(propellantTemperature === undefined ? {} : { propellantTemperature }),
      },
      options.options,
    )
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
  const extrapolation = outsideDomain(fit.domain, {
    charge,
    velocity,
    pressure,
    boreDiameter: boreDiameter ?? fit.load.chamber.boreDiameter,
    barrelLength: barrelLength ?? fit.load.barrel.length,
  })
  return {
    charge,
    level,
    coverageFactor: quantile,
    velocity: band(velocity, 0),
    pressure: band(pressure, 1),
    ...(Object.keys(extrapolation).length > 0 ? { extrapolation } : {}),
    runCount,
  }
}
