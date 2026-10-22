/**
 * Powder fit: fits the burn coefficient and, on request, the start pressure of the M3 interior
 * model to a chronograph ladder by weighted least squares, `apps/docs/docs/models/interior-powder-fit.md`.
 * Every evaluation runs `interior` once per distinct charge. SI in and out.
 */
import { InputError, need } from '../errors.ts'
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
}

/**
 * Parameter of the fit: the burn coefficient (or vivacity, by the load's burn kind) and the start
 * pressure, Pa.
 */
export type PowderParameter = 'burnRate' | 'startPressure'

/** Options of `fitPowder`. */
export interface PowderFitOptions {
  /**
   * Default ['burnRate']; `startPressure` is resolved only with measured pressures
   * (`apps/docs/docs/models/interior-powder-fit.md`, "Identifiability").
   */
  parameters?: readonly PowderParameter[]
  /**
   * Levenberg-Marquardt iterations (accepted plus rejected steps) before the fit fails with reason
   * `not-converged`; default 30.
   */
  maxIterations?: number
  /** Largest condition number of the column-scaled Jacobian; default 1e3. */
  maxCondition?: number
  /** Integration settings of every `interior` run; default `interiorDefaults`. */
  options?: Partial<InteriorOptions>
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
  /** One row per velocity, then pressure, of each ladder point in input order. */
  residuals: PowderFitResidual[]
  /** Sum of squared residuals over sigma (sigma 1 where the ladder has none). */
  chiSquare: number
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
  readonly conditionNumber?: number
  /** Indices of parameters the ladder does not resolve. */
  readonly unresolved?: number[]
  /** Parameter combination (in log parameters, column-scaled) with the smallest eigenvalue. */
  readonly direction?: number[]
  readonly estimate?: FittedPowderParameter[]
  /** With `invalid`: the ladder charge, kg, whose `interior` run was invalid. */
  readonly charge?: number
  /** With `invalid`: that run's result. */
  readonly result?: InteriorInvalid

  constructor(
    reason: PowderFitReason,
    extra: {
      conditionNumber?: number
      unresolved?: number[]
      direction?: number[]
      estimate?: FittedPowderParameter[]
      charge?: number
      result?: InteriorInvalid
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
    initial.map((v, j) => offset[j] + (v - offset[j]) * Math.exp(theta[j]))
  const estimate = (theta: number[]): FittedPowderParameter[] =>
    parameters.map((name, j) => ({ name, initial: initial[j], value: q(theta)[j] }))
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
  const floor = startPressureFloor(load)
  need(
    !parameters.includes('startPressure') || load.startPressure > floor,
    'startPressure must be above the ignition pressure and the resistance at travel 0',
  )

  const rows = ladderRows(ladder)
  if (rows.length < parameters.length) throw new PowderFitError('underdetermined')
  const { initial, apply, offset, q, estimate } = powderParameterMap(load, parameters, floor)

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
        ? results[index[i]].muzzleVelocity
        : results[index[i]].peakBreechPressure,
    )
  }

  // q(0), not `initial`: with the start pressure fitted they can differ in the last place
  const first = evaluate(q(parameters.map(() => 0)))
  if (!first) throw new PowderFitError('invalid', rejected)
  const fit = logLeastSquares({
    parameterCount: parameters.length,
    observed: rows.map((o) => o.value),
    standardUncertainty: rows.map((o) => o.sigma),
    weighted: withSigma > 0,
    // a Jacobian entry below 1e-6 of the observation per unit log parameter is noise
    floor: rows.map((o) => (1e-6 * o.value) / o.sigma),
    first,
    predict: (trial) => evaluate(q(trial)),
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
  return {
    load: apply(values),
    parameters: parameters.map((name, k) => ({
      name,
      initial: initial[k],
      value: values[k],
      ...(fit.standardUncertainty
        ? { standardUncertainty: (values[k] - offset[k]) * fit.standardUncertainty[k] }
        : {}),
    })),
    ...(fit.correlation ? { correlation: fit.correlation } : {}),
    residuals: rows.map((o, i) => ({
      kind: o.kind,
      charge: o.charge,
      observed: o.value,
      predicted: fit.predicted[i],
      residual: fit.predicted[i] - o.value,
    })),
    chiSquare: fit.chiSquare,
    degreesOfFreedom: rows.length - parameters.length,
    conditionNumber: fit.conditionNumber,
    chargeRange: { min: Math.min(...charges), max: Math.max(...charges) },
    iterations: fit.iterations,
    runCount,
  }
}
