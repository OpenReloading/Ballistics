/**
 * Truing: fits muzzle velocity and drag factors to observations of one session, or one drag
 * correction to several sessions, by weighted least squares,
 * `apps/docs/docs/models/exterior-truing.md`. Every evaluation is an
 * ordinary `trajectory` call with candidate inputs. SI in and out; angles in rad.
 */
import type { DragTable } from '../drag-tables.ts'
import { InputError, need, nth } from '../errors.ts'
import { type LogFitResult, logLeastSquares } from '../least-squares.ts'
import { overlay, type Settings } from '../settings.ts'
import { type DragInput, dragCoefficient, dragTableOf } from './drag.ts'
import type { StepBudget } from './rk45.ts'
import {
  type Projectile,
  type TrajectoryInput,
  type TrajectoryOptions,
  type TrajectoryPoint,
  trajectory,
} from './trajectory.ts'

/** One measured value at a slant range: height above the line of sight, hold angle or speed. */
export interface Observation {
  /** Quantity observed, a field of `TrajectoryPoint`. */
  kind: 'height' | 'elevationHold' | 'velocity'
  /** Slant range, m. */
  range: number
  /** m, rad or m/s, in the signs of `TrajectoryPoint`. */
  value: number
  /** One standard deviation in the unit of `value`; all observations or none. */
  standardUncertainty?: number | undefined
}

/**
 * Trajectory options of every evaluation (`budget` excluded: the fit sets it) and the limits of
 * the fit. The integrator defaults are relativeTolerance 1e-10, absoluteTolerance 1e-9 and zeroTolerance 1e-9.
 */
export interface TruingOptions extends Settings<Omit<TrajectoryOptions, 'budget'>> {
  /**
   * Levenberg-Marquardt iterations (accepted plus rejected steps) before the fit fails with reason
   * `not-converged`; default 30.
   */
  maxIterations?: number | undefined
  /** Largest condition number of the column-scaled Jacobian; default 1e3. */
  maxCondition?: number | undefined
  /**
   * Integration steps of all trajectories of the fit together, zero searches and point-mass twins
   * included, before it fails with reason `step-budget`; positive, default no limit.
   */
  maxTotalSteps?: number | undefined
}

/** A fitted parameter: start value, result and uncertainty. */
export interface TruedParameter {
  /** Muzzle velocity (m/s) or drag factor (multiplies the drag coefficient; 1 is unchanged). */
  name: 'muzzleVelocity' | 'dragFactor'
  /** Knot Mach number of a Mach-dependent factor. */
  mach?: number
  /** Index of the session of a per-session muzzle velocity (`trueDragSessions`). */
  session?: number
  /** Value before the fit: the shot's muzzle velocity, or 1 for a drag factor. */
  initial: number
  /** Fitted value, same unit as `initial`. */
  value: number
  /**
   * Standard uncertainty; absent when it cannot be estimated (n = p without standard uncertainties); NaN when
   * rounding leaves its covariance diagonal below 0.
   */
  standardUncertainty?: number
}

/** Observed and predicted value of one observation after the fit. */
export interface TruingResidual {
  /** Quantity observed. */
  kind: Observation['kind']
  /** Slant range, m. */
  range: number
  /** Observed value, unit of `kind`. */
  observed: number
  /** Predicted value of the fitted shot, unit of `kind`. */
  predicted: number
  /** Predicted minus observed. */
  residual: number
  /** Predicted Mach number at the range. */
  mach: number
  /** Index of the observation's session (`trueDragSessions`). */
  session?: number
}

/** Result of a one-session fit. */
export interface TruingResult {
  /** The input shot with the fitted values applied. */
  shot: TrajectoryInput
  /** Fitted parameters, in the order they were fitted. */
  parameters: TruedParameter[]
  /**
   * Absent like `standardUncertainty`; all NaN for an exact fit without standard uncertainties (chi-square 0,
   * `apps/docs/docs/models/exterior-truing.md`, "Limits").
   */
  correlation?: number[][]
  /** One row per observation, in input order. */
  residuals: TruingResidual[]
  /** Sum of squared residuals over sigma (sigma 1 where the observations have none). */
  chiSquare: number
  /** Degrees of freedom: observations minus parameters. */
  degreesOfFreedom: number
  /** Condition number of the column-scaled Jacobian at the solution. */
  conditionNumber: number
  /** Iterations of the solver. */
  iterations: number
  /** Trajectories computed, zero searches not counted. */
  trajectoryCount: number
  /** Integration steps of all trajectories, accepted plus rejected. */
  steps: number
}

/** Why a fit failed, the `reason` of a `TruingError`. */
export type TruingReason =
  | 'underdetermined'
  | 'unresolved'
  | 'ill-conditioned'
  | 'unreachable'
  | 'not-converged'
  | 'step-budget'

/**
 * Failure of a truing fit: `reason` is `underdetermined` (fewer observations than parameters),
 * `unresolved` or `ill-conditioned` (the observations do not separate the parameters),
 * `unreachable` (a trajectory misses an observed range), `not-converged` (`maxIterations` reached)
 * or `step-budget` (`maxTotalSteps` reached).
 */
export class TruingError extends InputError {
  readonly reason: TruingReason
  readonly conditionNumber?: number | undefined
  /** Indices of parameters the observations do not resolve. */
  readonly unresolved?: number[] | undefined
  /** Parameter combination (in log parameters, column-scaled) with the smallest eigenvalue. */
  readonly direction?: number[] | undefined
  readonly estimate?: TruedParameter[] | undefined

  constructor(
    reason: TruingReason,
    extra: {
      conditionNumber?: number | undefined
      unresolved?: number[] | undefined
      direction?: number[] | undefined
      estimate?: TruedParameter[] | undefined
      /** What the solver reported, appended to the message. */
      detail?: string | undefined
    } = {},
  ) {
    super(extra.detail ? `truing: ${reason} (${extra.detail})` : `truing: ${reason}`)
    this.name = 'TruingError'
    this.reason = reason
    this.conditionNumber = extra.conditionNumber
    this.unresolved = extra.unresolved
    this.direction = extra.direction
    this.estimate = extra.estimate
  }
}

interface Spec {
  name: TruedParameter['name']
  mach?: number
  /** Only this session depends on the parameter; all sessions when absent. */
  session?: number
  initial: number
}

/** Observations of one session and the map from parameters to its shot. */
interface Run {
  observations: readonly Observation[]
  apply: (q: number[]) => TrajectoryInput
  /** Session index reported on residual rows (multi-session fits only). */
  session?: number
}

/** One firing session of a multi-session drag fit. */
export interface TruingSession {
  /** The session's shot without the projectile: muzzle velocity, rifle, air, wind, site, zero. */
  shot: Omit<TrajectoryInput, 'projectile'>
  /** Observations of the session; at least one. */
  observations: readonly Observation[]
  /** Fit this session's muzzle velocity; default false (held). */
  fitMuzzleVelocity?: boolean
}

/** Result of a multi-session fit; `shot` is replaced by one shot per session. */
export interface SessionsTruingResult extends Omit<TruingResult, 'shot'> {
  /** Each session's shot with the fitted values applied, in input order. */
  shots: TrajectoryInput[]
}

interface Prediction {
  values: number[]
  points: TrajectoryPoint[]
}

/** Predictions of the runs at log parameters, counting the trajectories computed. */
interface Predictor {
  /** Predicted values of one session, or null when its trajectory throws or misses a range. */
  predictRun: (u: Run, trial: number[], current: number[], strict: boolean) => Prediction | null
  /** Predicted values of all sessions, or null when one of them fails. */
  predict: (trial: number[], current: number[], strict?: boolean) => Prediction | null
  trajectories: number
}

/** The values of the session's observations in a trajectory, or null when it misses a range. */
function observedPoints(u: Run, t: ReturnType<typeof trajectory>): Prediction | null {
  const at = new Map(t.points.map((p) => [p.range, p]))
  const points: TrajectoryPoint[] = []
  const values: number[] = []
  for (const x of u.observations) {
    const p = at.get(x.range)
    if (p === undefined) return null
    points.push(p)
    values.push(p[x.kind])
  }
  return { values, points }
}

/**
 * Flies each session at the parameters `q(trial)` with the trajectory options `o`; a failure once
 * `budget` is spent throws `step-budget` with the estimate at `current`.
 */
function predictSessions(
  runs: readonly Run[],
  q: (theta: number[]) => number[],
  o: Settings<TrajectoryOptions>,
  budget: StepBudget,
  estimate: (theta: number[]) => TruedParameter[],
): Predictor {
  const predictRun = (
    u: Run,
    trial: number[],
    current: number[],
    strict: boolean,
  ): Prediction | null => {
    predictor.trajectories++
    let t: ReturnType<typeof trajectory>
    try {
      t = trajectory(
        u.apply(q(trial)),
        u.observations.map((x) => x.range),
        o,
      )
    } catch (e) {
      if (!(e instanceof InputError)) throw e
      // estimate of the current iterate, not of the candidate
      if (budget.used >= budget.max)
        throw new TruingError('step-budget', { estimate: estimate(current) })
      if (strict) throw e
      return null
    }
    return observedPoints(u, t)
  }
  const predict = (trial: number[], current: number[], strict = false): Prediction | null => {
    const values: number[] = []
    const points: TrajectoryPoint[] = []
    for (const u of runs) {
      const p = predictRun(u, trial, current, strict)
      if (!p) return null
      values.push(...p.values)
      points.push(...p.points)
    }
    return { values, points }
  }
  const predictor: Predictor = { predictRun, predict, trajectories: 0 }
  return predictor
}

/** Result of the fit from the solver's solution, the fitted values and the solution's predictions. */
function truingResult(
  runs: readonly Run[],
  specs: Spec[],
  fit: LogFitResult,
  values: number[],
  final: Prediction,
  trajectories: number,
  steps: number,
): SessionsTruingResult {
  const observations = runs.flatMap((u) => u.observations)
  const owner = runs.flatMap((u, k) => u.observations.map(() => k))
  return {
    shots: runs.map((u) => u.apply(values)),
    parameters: specs.map((s, k) => {
      const value = nth(values, k)
      return {
        ...s,
        value,
        ...(fit.standardUncertainty
          ? { standardUncertainty: value * nth(fit.standardUncertainty, k) }
          : {}),
      }
    }),
    ...(fit.correlation ? { correlation: fit.correlation } : {}),
    residuals: observations.map((x, i) => {
      const predicted = nth(final.values, i)
      const run = nth(owner, i)
      return {
        kind: x.kind,
        range: x.range,
        observed: x.value,
        predicted,
        residual: predicted - x.value,
        mach: nth(final.points, i).mach,
        ...(nth(runs, run).session === undefined ? {} : { session: run }),
      }
    }),
    chiSquare: fit.chiSquare,
    degreesOfFreedom: observations.length - specs.length,
    conditionNumber: fit.conditionNumber,
    iterations: fit.iterations,
    trajectoryCount: trajectories,
    steps,
  }
}

/**
 * Levenberg-Marquardt on the log parameters over the stacked runs
 * (`apps/docs/docs/models/least-squares.md`, "Levenberg-Marquardt step"; `apps/docs/docs/models/exterior-truing.md`, "Observations and cost").
 */
function leastSquares(
  runs: readonly Run[],
  specs: Spec[],
  options: TruingOptions = {},
): SessionsTruingResult {
  const observations = runs.flatMap((u) => u.observations)
  const { maxIterations = 30, maxCondition = 1e3, maxTotalSteps = Infinity, ...rest } = options
  const n = observations.length
  const np = specs.length
  need(maxTotalSteps > 0, 'maxTotalSteps must be positive')
  if (n < np) throw new TruingError('underdetermined')
  const budget = { used: 0, max: maxTotalSteps }
  const o: Settings<TrajectoryOptions> = {
    ...overlay<Settings<TrajectoryOptions>>(
      { relativeTolerance: 1e-10, absoluteTolerance: 1e-9, zeroTolerance: 1e-9 },
      rest,
    ),
    budget,
  }
  const sigma = observations.map((x) => x.standardUncertainty ?? 1)
  // a Jacobian entry below 1e-6 of the observation's scale per unit log parameter is noise
  const floor = observations.map(
    (x, i) =>
      (1e-6 * (x.kind === 'height' ? x.range : x.kind === 'velocity' ? Math.abs(x.value) : 1)) /
      nth(sigma, i),
  )
  const q = (theta: number[]) => specs.map((s, j) => s.initial * Math.exp(nth(theta, j)))
  const estimate = (theta: number[]): TruedParameter[] => {
    const values = q(theta)
    return specs.map((s, j) => ({ ...s, value: nth(values, j) }))
  }
  const predictor = predictSessions(runs, q, o, budget, estimate)
  const { predictRun, predict } = predictor

  const zero = specs.map(() => 0)
  const first = predict(zero, zero, true)
  if (!first) throw new TruingError('unreachable')
  // full predictions by their values, so the solution's points come without another run
  const full = new WeakMap<readonly number[], Prediction>([[first.values, first]])
  const fit = logLeastSquares({
    parameterCount: np,
    observed: observations.map((x) => x.value),
    standardUncertainty: sigma,
    weighted: observations.every((x) => x.standardUncertainty !== undefined),
    floor,
    first: first.values,
    predict: (trial, current, run) => {
      if (run !== undefined)
        return predictRun(nth(runs, run), trial, current, false)?.values ?? null
      const p = predict(trial, current)
      if (p) full.set(p.values, p)
      return p?.values ?? null
    },
    runs: runs.map((u) => u.observations.length),
    // a session parameter moves only its own session's predictions
    moves: (j, run) => {
      const { session } = nth(specs, j)
      return session === undefined || session === run
    },
    maxIterations,
    maxCondition,
    fail: (reason, theta, extra = {}) => {
      throw new TruingError(reason, { ...extra, estimate: estimate(theta) })
    },
  })
  const final = full.get(fit.predicted)
  if (!final) throw new TruingError('unreachable')
  return truingResult(runs, specs, fit, q(fit.theta), final, predictor.trajectories, budget.used)
}

function checkObservations(observations: readonly Observation[]): void {
  need(observations.length > 0, 'at least one observation')
  for (const x of observations) {
    need(['height', 'elevationHold', 'velocity'].includes(x.kind), `observation kind ${x.kind}`)
    need(Number.isFinite(x.value), 'observation value')
    need(
      Number.isFinite(x.range) && (x.kind === 'velocity' ? x.range >= 0 : x.range > 0),
      `observation range ${x.range}`,
    )
    need(
      x.standardUncertainty === undefined ||
        (x.standardUncertainty > 0 && Number.isFinite(x.standardUncertainty)),
      'standardUncertainty must be positive',
    )
  }
  const withSigma = observations.filter((x) => x.standardUncertainty !== undefined).length
  need(
    withSigma === 0 || withSigma === observations.length,
    'standardUncertainty on all observations or none',
  )
  need(
    withSigma > 0 || new Set(observations.map((x) => x.kind)).size === 1,
    'observations of different kinds need standard uncertainties',
  )
}

/** Fits the muzzle velocity to the observations. */
export function trueMuzzleVelocity(
  shot: TrajectoryInput,
  observations: readonly Observation[],
  options?: TruingOptions,
): TruingResult {
  checkObservations(observations)
  return single(
    leastSquares(
      [{ observations, apply: (q) => ({ ...shot, muzzleVelocity: nth(q, 0) }) }],
      [{ name: 'muzzleVelocity', initial: shot.muzzleVelocity }],
      options,
    ),
  )
}

const single = ({ shots, ...rest }: SessionsTruingResult): TruingResult => ({
  shot: nth(shots, 0),
  ...rest,
})

/**
 * The drag of a projectile with drag factors applied: one constant factor without knots, else one
 * factor per knot written as a custom curve
 * (`apps/docs/docs/models/exterior-truing.md`, "Mach-dependent drag factor"). Validates the knots.
 */
export function dragCorrection(
  p: Projectile,
  knots?: readonly number[],
): (f: number[]) => DragInput {
  const drag = p.drag
  if (knots === undefined)
    return (f) => {
      const k = nth(f, 0)
      return drag.kind === 'bc'
        ? {
            ...drag,
            bands: drag.bands.map((b) => ({
              ...b,
              ballisticCoefficient: b.ballisticCoefficient / k,
            })),
          }
        : { ...drag, curve: drag.curve.map(([m, c]) => [m, c * k] as const) }
    }
  need(knots.length >= 2, 'at least two knots')
  knots.forEach((m, k) => {
    need(m > 0 && Number.isFinite(m), 'knot Mach must be positive')
    need(k === 0 || m > nth(knots, k - 1), 'knots must rise')
  })
  need(drag.kind === 'curve' || drag.bands.length === 1, 'knots need a single-band BC or a curve')
  // the curve built below drops the reference, so trajectory cannot reject a misspelled one
  need(
    drag.kind === 'curve' || [undefined, 'icao', 'metro'].includes(drag.reference),
    `BC reference ${drag.kind === 'bc' && drag.reference}`,
  )
  // the bullet's own drag coefficient on pi d^2 / 4
  const base: DragTable = dragTableOf(drag)
  const own = (m: number) =>
    drag.kind === 'curve'
      ? dragCoefficient(drag.curve, m, drag.interpolation)
      : (dragCoefficient(base, m, drag.interpolation) * p.mass) /
        (nth(drag.bands, 0).ballisticCoefficient * p.diameter ** 2)
  // a knot replaces a base node within 1e-9 relative: a closer pair makes the cubic's node slopes
  // rounding noise
  const near = (m: number) => knots.some((k) => Math.abs(m - k) <= 1e-9 * k)
  const nodes = [...base.map((x) => x[0]).filter((m) => !near(m)), ...knots].sort((a, b) => a - b)
  return (f) => {
    const factor: DragTable = knots.map((m, k) => [m, nth(f, k)] as const)
    return {
      kind: 'curve',
      curve: nodes.map((m) => [m, dragCoefficient(factor, m) * own(m)] as const),
      ...(drag.interpolation === undefined ? {} : { interpolation: drag.interpolation }),
    }
  }
}

const factorSpecs = (knots?: readonly number[]): Spec[] =>
  knots === undefined
    ? [{ name: 'dragFactor', initial: 1 }]
    : knots.map((m) => ({ name: 'dragFactor', mach: m, initial: 1 }))

/**
 * Fits a constant drag factor (C_D times k), or factors at Mach knots written as a custom curve
 * (`apps/docs/docs/models/exterior-truing.md`, "Mach-dependent drag factor"), optionally together with the
 * muzzle velocity.
 */
export function trueDrag(
  shot: TrajectoryInput,
  observations: readonly Observation[],
  spec: { knots?: readonly number[] | undefined; fitMuzzleVelocity?: boolean | undefined } = {},
  options?: TruingOptions,
): TruingResult {
  const { knots, fitMuzzleVelocity = false } = spec
  // the whole shot as the session shot keeps the key order of the trued shot
  return single(
    fitDrag(shot.projectile, [{ shot, observations, fitMuzzleVelocity }], knots, options, false),
  )
}

/**
 * Fits one drag correction of the projectile, shared by all sessions, to the observations of
 * every session flown with its own conditions, and optionally each session's muzzle velocity
 * (`apps/docs/docs/models/exterior-truing.md`, "Observations and cost").
 */
export function trueDragSessions(
  projectile: Projectile,
  sessions: readonly TruingSession[],
  spec: { knots?: readonly number[] | undefined } = {},
  options?: TruingOptions,
): SessionsTruingResult {
  return fitDrag(projectile, sessions, spec.knots, options, true)
}

function fitDrag(
  projectile: Projectile,
  sessions: readonly TruingSession[],
  knots: readonly number[] | undefined,
  options: TruingOptions | undefined,
  tag: boolean,
): SessionsTruingResult {
  need(sessions.length > 0, 'at least one session')
  checkObservations(sessions.flatMap((x) => x.observations))
  for (const x of sessions) need(x.observations.length > 0, 'at least one observation per session')
  const drag = dragCorrection(projectile, knots)
  const specs: Spec[] = sessions.flatMap((x, k) =>
    x.fitMuzzleVelocity
      ? [
          {
            name: 'muzzleVelocity' as const,
            ...(tag ? { session: k } : {}),
            initial: x.shot.muzzleVelocity,
          },
        ]
      : [],
  )
  const off = specs.length
  specs.push(...factorSpecs(knots))
  let next = 0
  const runs: Run[] = sessions.map((x, k) => {
    const v = x.fitMuzzleVelocity ? next++ : -1
    return {
      observations: x.observations,
      ...(tag ? { session: k } : {}),
      apply: (q) => ({
        ...x.shot,
        projectile: { ...projectile, drag: drag(q.slice(off)) },
        muzzleVelocity: v < 0 ? x.shot.muzzleVelocity : nth(q, v),
      }),
    }
  })
  return leastSquares(runs, specs, options)
}
