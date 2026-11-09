/** A burn coefficient (and on request a temperature factor) per powder, a velocity offset per rifle and a burn offset per lot, fitted to many sessions at once with prediction intervals that hold a model-error term (`apps/docs/docs/models/interior-powder-fit.md`, "Pooled fit over rifles, powders and lots"); velocities only, SI in and out. */

import {
  checkLogFitLimits,
  chiSquareQuantile,
  type LogFitResult,
  logLeastSquares,
  nth,
} from '@open-reloading/statistics'
import { InputError, need } from '../issue.ts'
import { positive, type Settings } from '../settings.ts'
import { type LadderPoint, PowderFitError, type PowderPrior } from './fit.ts'
import { type InteriorLoad, type InteriorOptions, interior } from './model.ts'

/** One chronograph session of a pooled fit: a ladder of one powder lot fired from one rifle. */
export interface PooledSession {
  /** Name of the powder; sessions with the same name share its burn coefficient. */
  powder: string
  /** Name of the rifle; sessions with the same name share its velocity offset. */
  rifle: string
  /** Name of the powder lot; absent where the session records none. */
  lot?: string | undefined
  /** The burn coefficient of a powder's first session starts the fit and replaces that of its other sessions; all share one burn kind. */
  load: InteriorLoad
  /** Projectile travel to the muzzle of the barrel fired, m; default the load's. */
  barrelLength?: number | undefined
  /** Propellant temperature of the session, K; default the load's. */
  propellantTemperature?: number | undefined
  /** Charges with mean velocities and `velocitySigma` on every point; no pressures. */
  ladder: readonly LadderPoint[]
}

/** What a prediction of `predictPooled` is made for: a session without its ladder. */
export type PooledTarget = Omit<PooledSession, 'ladder'>

/** A per-powder parameter of the pooled fit. */
export type PooledRequest = 'burnRate' | 'temperatureFactor'

/** Gaussian priors of the per-powder parameters, by powder name, in the form of `PowderPrior`. */
type PooledPriors = Readonly<
  Record<string, Partial<Record<PooledRequest, PowderPrior | undefined>> | undefined>
>

/** Options of `fitPowderPooled`. */
export interface PooledFitOptions {
  /** Default ['burnRate'], which must be among them; the temperature factor is fitted where a powder's sessions span two or more temperatures and its load carries a sensitivity, else listed in `held`; `exponent` and `form` are refused with `unresolved`, as velocities do not resolve them. */
  parameters?: readonly PooledRequest[] | undefined
  /** Priors on the per-powder parameters: from a powder record, its thermochemistry or `similarPowdersPrior`. */
  priors?: PooledPriors | undefined
  /** Standard deviation of the log velocity factor of a rifle; default `pooledDefaults.rifleSigma`. */
  rifleSigma?: number | undefined
  /** Standard deviation of the log burn factor of a lot; default `pooledDefaults.lotSigma`. */
  lotSigma?: number | undefined
  /** Levenberg-Marquardt iterations before the fit fails with `not-converged`; default 30. */
  maxIterations?: number | undefined
  /** Largest condition number of the column-scaled Jacobian; default 1e3. */
  maxCondition?: number | undefined
  /** Integration settings of every `interior` run; default `interiorDefaults`. */
  options?: Settings<InteriorOptions> | undefined
}

/** Assumptions: a rifle moves the velocity by about 1 %, a lot the burn coefficient by about 3 %. */
const pooledDefaults = { rifleSigma: 0.01, lotSigma: 0.03 }

/** A powder's burn coefficient or temperature factor, a rifle's velocity factor, a lot's factor on its powder's burn coefficient. */
type PooledParameterKind = 'burnRate' | 'temperatureFactor' | 'rifle' | 'lot'

/** A fitted parameter of the pooled fit. Factors start at 1. */
interface PooledPowderParameter {
  /** Which parameter. */
  kind: PooledParameterKind
  /** The powder (burn coefficient, temperature factor, lot) or the rifle it belongs to. */
  group: string
  /** With kind `lot`: the lot. */
  lot?: string
  /** Start value: the burn coefficient of the powder's first session, else 1. */
  initial: number
  /** Fitted value, same unit as `initial`. */
  value: number
  /** Standard uncertainty: measurement and priors, no model error. */
  standardUncertainty: number
}

/** Observed and predicted velocity of one ladder point after the fit. */
interface PooledResidual {
  /** Index of the session in the input. */
  session: number
  /** Charge mass, kg. */
  charge: number
  /** Measured mean velocity, m/s. */
  observed: number
  /** Velocity of the fitted model, m/s. */
  predicted: number
  /** Predicted minus observed, m/s. */
  residual: number
}

/** Result of `fitPowderPooled`. */
export interface PooledPowderFit {
  /** Per powder its burn coefficient and temperature factor, then the rifles, then the lots. */
  parameters: PooledPowderParameter[]
  /** Requested temperature factors not fitted: the powder's sessions hold one temperature or no sensitivity. */
  held: { powder: string; name: 'temperatureFactor' }[]
  /** Powder, rifle and lot of each input session, for `predictPooled`. */
  sessions: Pick<PooledSession, 'powder' | 'rifle' | 'lot'>[]
  /** Covariance of the log parameters, in the order of `parameters`. */
  covariance: number[][]
  /** Correlation matrix of the parameters. */
  correlation: number[][]
  /** Condition number of the column-scaled Jacobian at the solution. */
  conditionNumber: number
  /** Sum of squared weighted residuals of the ladder points and the prior rows. */
  chiSquare: number
  /** The ladder points' share of `chiSquare`. */
  dataChiSquare: number
  /** Ladder points minus parameters. */
  degreesOfFreedom: number
  /** One per ladder point, sessions in input order. */
  residuals: PooledResidual[]
  /** Relative standard deviation of the model error: 0 from `fitPowderPooled`, estimated by `calibratePooled` from held-out strings. */
  modelError: number
  /** Held-out strings `modelError` was estimated from; 0 before `calibratePooled`. */
  calibrationStrings: number
  /** Spreads of the random effects the fit used. */
  rifleSigma: number
  /** Spread of the lot effect the fit used. */
  lotSigma: number
  /** Iterations of the solver. */
  iterations: number
  /** `interior` runs of the fit. */
  runCount: number
}

/** The load with its burn coefficient (or vivacity) set to `value`. */
function withBurn(load: InteriorLoad, value: number): InteriorLoad {
  const burn = load.propellant.burn
  return {
    ...load,
    propellant: {
      ...load.propellant,
      burn:
        burn.kind === 'vivacity' ? { ...burn, vivacity: value } : { ...burn, coefficient: value },
    },
  }
}

const burnOf = (load: InteriorLoad) => {
  const burn = load.propellant.burn
  return burn.kind === 'vivacity' ? burn.vivacity : burn.coefficient
}

/** The load of `target` at `charge` with burn coefficient `burn` and temperature factor `factor`. */
function targetLoad(target: PooledTarget, charge: number, burn: number, factor: number) {
  const load = withBurn(target.load, burn)
  const t = load.propellant.temperatureSensitivity
  return {
    ...load,
    charge,
    ...(target.barrelLength === undefined
      ? {}
      : { barrel: { ...load.barrel, length: target.barrelLength } }),
    ...(target.propellantTemperature === undefined
      ? {}
      : { propellantTemperature: target.propellantTemperature }),
    ...(t === undefined || factor === 1
      ? {}
      : {
          propellant: {
            ...load.propellant,
            temperatureSensitivity: { ...t, cold: t.cold * factor, hot: t.hot * factor },
          },
        }),
  }
}

/** Index in `parameters` of the parameter of `kind` for `group` (and `lot`); -1 where it has none. */
function indexOf(
  parameters: readonly Pick<PooledPowderParameter, 'kind' | 'group' | 'lot'>[],
  kind: PooledParameterKind,
  group: string,
  lot?: string,
) {
  return parameters.findIndex((p) => p.kind === kind && p.group === group && p.lot === lot)
}

/** The parameter indices that move a session's velocities: burn, temperature, rifle, lot. */
function sessionIndices(
  parameters: readonly Pick<PooledPowderParameter, 'kind' | 'group' | 'lot'>[],
  s: Pick<PooledSession, 'powder' | 'rifle' | 'lot'>,
) {
  return {
    burn: indexOf(parameters, 'burnRate', s.powder),
    temperature: indexOf(parameters, 'temperatureFactor', s.powder),
    rifle: indexOf(parameters, 'rifle', s.rifle),
    lot: s.lot === undefined ? -1 : indexOf(parameters, 'lot', s.powder, s.lot),
  }
}

/** Value of log parameter `k` of `theta`; 0 where the session has no such parameter. */
const at = (theta: readonly number[], k: number) => (k < 0 ? 0 : nth(theta, k))

/** Checks the sessions and options of `fitPowderPooled` before any run. */
function checkPooled(
  sessions: readonly PooledSession[],
  requested: readonly PooledRequest[],
  limits: { rifleSigma: number; lotSigma: number; maxIterations: number; maxCondition: number },
) {
  const { rifleSigma, lotSigma, maxIterations, maxCondition } = limits
  need(sessions.length > 0, { code: 'noSession', params: {} })
  const names: readonly string[] = requested
  if (names.includes('exponent') || names.includes('form')) throw new PowderFitError('unresolved')
  need(
    requested.includes('burnRate') &&
      requested.every((p) => p === 'burnRate' || p === 'temperatureFactor') &&
      new Set(requested).size === requested.length,
    { code: 'pooledFitParametersInvalid', params: {} },
  )
  need(rifleSigma > 0 && lotSigma > 0, { code: 'rifleOrLotSigmaNotPositive', params: {} })
  checkLogFitLimits(maxIterations, maxCondition)
  checkSessions(sessions)
}

/** Checks each session and its ladder points: velocities with sigmas only, conditions per session. */
function checkSessions(sessions: readonly PooledSession[]) {
  for (const s of sessions) {
    need(s.ladder.length > 0, { code: 'sessionWithoutLadderPoint', params: {} })
    need(positive(s.barrelLength), { code: 'barrelLengthNotPositive', params: {} })
    need(positive(s.propellantTemperature), {
      code: 'propellantTemperatureNotPositive',
      params: {},
    })
    for (const x of s.ladder) {
      need(positive(x.charge) && positive(x.muzzleVelocity), {
        code: 'ladderChargeOrVelocityNotPositive',
        params: {},
      })
      need(x.velocitySigma !== undefined && positive(x.velocitySigma), {
        code: 'velocitySigmaMissing',
        params: {},
      })
      need(x.peakPressure === undefined, { code: 'pooledFitVelocitiesOnly', params: {} })
      need(x.barrelLength === undefined && x.propellantTemperature === undefined, {
        code: 'barrelOrTemperatureOnPoint',
        params: {},
      })
    }
  }
}

/** Whether the sessions of one powder span two or more temperatures and carry a sensitivity. */
function resolvesTemperature(sessions: readonly PooledSession[]) {
  const temperatures = new Set(
    sessions.map((s) => s.propellantTemperature ?? s.load.propellantTemperature),
  )
  const t = nth(sessions, 0).load.propellant.temperatureSensitivity
  return temperatures.size > 1 && t !== undefined && (t.cold !== 0 || t.hot !== 0)
}

/** The pooled parameters in their order, and the temperature factors the sessions do not resolve. */
function pooledParameters(
  sessions: readonly PooledSession[],
  requested: readonly PooledRequest[],
  priors: PooledPriors,
) {
  const powders = [...new Set(sessions.map((s) => s.powder))]
  const rifles = [...new Set(sessions.map((s) => s.rifle))]
  const of = (powder: string) => sessions.filter((s) => s.powder === powder)
  const first = (powder: string) => nth(of(powder), 0).load
  need(
    sessions.every((s) => s.load.propellant.burn.kind === first(s.powder).propellant.burn.kind),
    { code: 'sessionsBurnKindDiffers', params: {} },
  )
  need(
    Object.keys(priors).every((p) => powders.includes(p)),
    { code: 'priorPowderNotInSessions', params: {} },
  )

  const parameters: Omit<PooledPowderParameter, 'value' | 'standardUncertainty'>[] = []
  const held: PooledPowderFit['held'] = []
  for (const powder of powders) {
    parameters.push({ kind: 'burnRate', group: powder, initial: burnOf(first(powder)) })
    if (!requested.includes('temperatureFactor')) continue
    if (resolvesTemperature(of(powder)))
      parameters.push({ kind: 'temperatureFactor', group: powder, initial: 1 })
    else held.push({ powder, name: 'temperatureFactor' })
  }
  // one level of a random effect is absorbed by the burn coefficients, so it gets no parameter
  if (rifles.length > 1)
    for (const rifle of rifles) parameters.push({ kind: 'rifle', group: rifle, initial: 1 })
  for (const powder of powders) {
    const lots = new Set(of(powder).map((s) => s.lot))
    const named = [...lots].filter((lot) => lot !== undefined)
    if (lots.size > 1)
      parameters.push(
        ...named.map((lot) => ({ kind: 'lot' as const, group: powder, lot, initial: 1 })),
      )
  }
  for (const powder of powders) {
    const charges = new Set(of(powder).flatMap((s) => s.ladder.map((x) => x.charge)))
    if (charges.size < 2)
      throw new PowderFitError('unresolved', {
        unresolved: [indexOf(parameters, 'burnRate', powder)],
      })
  }
  return { parameters, held }
}

/** Prior pseudo-rows after the data: the parameter they hold, its log centre and sigma. */
function priorRowsOf(
  parameters: readonly Omit<PooledPowderParameter, 'value' | 'standardUncertainty'>[],
  priors: PooledPriors,
  rifleSigma: number,
  lotSigma: number,
) {
  return parameters.flatMap((p, k) => {
    if (p.kind === 'rifle') return [{ k, centre: 0, sigma: rifleSigma }]
    if (p.kind === 'lot') return [{ k, centre: 0, sigma: lotSigma }]
    const prior = priors[p.group]?.[p.kind]
    if (prior === undefined) return []
    need(
      Number.isFinite(prior.value) &&
        prior.value > 0 &&
        Number.isFinite(prior.sigma) &&
        prior.sigma > 0,
      { code: 'groupPriorNotPositive', params: { kind: p.kind, group: p.group } },
    )
    return [{ k, centre: Math.log(prior.value / p.initial), sigma: prior.sigma }]
  })
}

/** The start of a pooled parameter: its kind, group and initial value. */
type PooledStart = Omit<PooledPowderParameter, 'value' | 'standardUncertainty'>

/** One ladder point of a session, with the indices of its parameters. */
interface PooledRow {
  session: number
  x: LadderPoint
  /** Its velocity sigma, m/s; `checkSessions` makes every point carry one. */
  sigma: number
  indices: ReturnType<typeof sessionIndices>
}

/** What a pooled fit runs on, with its cache of runs and their count. */
interface PooledProblem {
  sessions: readonly PooledSession[]
  parameters: readonly PooledStart[]
  priorRows: ReturnType<typeof priorRowsOf>
  rows: PooledRow[]
  options: Settings<InteriorOptions> | undefined
  /** Last interior velocity per session and charge; a rifle step reuses it. */
  cache: Map<string, { burn: number; factor: number; velocity: number }>
  /** Model runs so far. */
  runCount: number
}

/** Velocity of `row` at `theta`, or null when its run is invalid. */
function pooledVelocity(
  problem: PooledProblem,
  row: PooledRow,
  theta: readonly number[],
): number | null {
  const { burn, temperature, rifle, lot } = row.indices
  const s = nth(problem.sessions, row.session)
  const b = nth(problem.parameters, burn).initial * Math.exp(at(theta, burn) + at(theta, lot))
  const factor = Math.exp(at(theta, temperature))
  const key = `${row.session} ${row.x.charge}`
  let hit = problem.cache.get(key)
  if (hit?.burn !== b || hit.factor !== factor) {
    problem.runCount++
    const r = interior(targetLoad(s, row.x.charge, b, factor), problem.options)
    if (!r.valid) return null
    hit = { burn: b, factor, velocity: r.muzzleVelocity }
    problem.cache.set(key, hit)
  }
  return hit.velocity * Math.exp(at(theta, rifle))
}

/** Prediction of row `run` at `theta`, or of its prior pseudo-row after the rows. */
function predictPooledRun(
  problem: PooledProblem,
  theta: readonly number[],
  run: number,
): number | null {
  const row = problem.rows[run]
  return row === undefined
    ? nth(theta, nth(problem.priorRows, run - problem.rows.length).k)
    : pooledVelocity(problem, row, theta)
}

/** Predictions of every row and pseudo-row, or of `run` alone; null when a run is invalid. */
function predictPooledRows(
  problem: PooledProblem,
  theta: readonly number[],
  run?: number,
): number[] | null {
  const runs =
    run === undefined
      ? Array.from({ length: problem.rows.length + problem.priorRows.length }, (_, k) => k)
      : [run]
  const out: number[] = []
  for (const k of runs) {
    const v = predictPooledRun(problem, theta, k)
    if (v === null) return null
    out.push(v)
  }
  return out
}

/** Whether log parameter `j` moves row or pseudo-row `run`. */
function pooledMoves(problem: PooledProblem, j: number, run: number): boolean {
  const row = problem.rows[run]
  if (row === undefined) return nth(problem.priorRows, run - problem.rows.length).k === j
  return Object.values(row.indices).includes(j)
}

/** The least-squares fit of the velocities and the prior pseudo-rows. */
function solvePooled(
  problem: PooledProblem,
  limits: { maxIterations: number; maxCondition: number },
): LogFitResult {
  const { parameters, rows, priorRows } = problem
  const zero = parameters.map(() => 0)
  const start = predictPooledRows(problem, zero)
  if (!start) throw new PowderFitError('invalid')
  return logLeastSquares({
    parameterCount: parameters.length,
    observed: [...rows.map((r) => r.x.muzzleVelocity), ...priorRows.map((p) => p.centre)],
    standardUncertainty: [...rows.map((r) => r.sigma), ...priorRows.map((p) => p.sigma)],
    weighted: true,
    // as in fitPowder: a Jacobian entry below 1e-6 of the observation per unit log parameter is noise
    floor: [...rows.map((r) => (1e-6 * r.x.muzzleVelocity) / r.sigma), ...priorRows.map(() => 0)],
    first: start,
    predict: (theta, _current, run) => predictPooledRows(problem, theta, run),
    runs: [...rows, ...priorRows].map(() => 1),
    moves: (j, run) => pooledMoves(problem, j, run),
    maxIterations: limits.maxIterations,
    maxCondition: limits.maxCondition,
    fail: (reason, _theta, extra = {}) => {
      throw new PowderFitError(reason === 'unreachable' ? 'invalid' : reason, extra)
    },
  })
}

/** The velocity residual of each ladder point. */
const pooledResiduals = (rows: readonly PooledRow[], predicted: readonly number[]) =>
  rows.map((r, i): PooledResidual => {
    const value = nth(predicted, i)
    return {
      session: r.session,
      charge: r.x.charge,
      observed: r.x.muzzleVelocity,
      predicted: value,
      residual: value - r.x.muzzleVelocity,
    }
  })

/** The rows of `sessions` and the prior pseudo-rows of a pooled fit of `parameters`. */
function pooledProblem(
  sessions: readonly PooledSession[],
  parameters: readonly PooledStart[],
  priorRows: PooledProblem['priorRows'],
  options: Settings<InteriorOptions> | undefined,
): PooledProblem {
  return {
    sessions,
    parameters,
    priorRows,
    rows: sessions.flatMap((s, session) =>
      s.ladder.map((x) => ({
        session,
        x,
        sigma: x.velocitySigma ?? Number.NaN,
        indices: sessionIndices(parameters, s),
      })),
    ),
    options,
    cache: new Map(),
    runCount: 0,
  }
}

/** The result of the pooled fit `fit` of `problem`. */
function pooledFitResult(
  problem: PooledProblem,
  fit: LogFitResult,
  given: Pick<PooledPowderFit, 'held' | 'rifleSigma' | 'lotSigma'>,
): PooledPowderFit {
  const { covariance, correlation, standardUncertainty } = fit
  // weighted, with at least the burn coefficient per powder: logLeastSquares always gives them
  if (!covariance || !correlation || !standardUncertainty)
    throw new InputError({ code: 'pooledFitNoCovariance', params: {} })
  const residuals = pooledResiduals(problem.rows, fit.predicted)
  return {
    parameters: problem.parameters.map((p, k) => {
      const value = p.initial * Math.exp(nth(fit.theta, k))
      return { ...p, value, standardUncertainty: value * nth(standardUncertainty, k) }
    }),
    held: given.held,
    sessions: problem.sessions.map((s) => ({
      powder: s.powder,
      rifle: s.rifle,
      ...(s.lot === undefined ? {} : { lot: s.lot }),
    })),
    covariance,
    correlation,
    conditionNumber: fit.conditionNumber,
    chiSquare: fit.chiSquare,
    dataChiSquare: residuals.reduce(
      (sum, r, i) => sum + (r.residual / nth(problem.rows, i).sigma) ** 2,
      0,
    ),
    degreesOfFreedom: problem.rows.length - problem.parameters.length,
    residuals,
    modelError: 0,
    calibrationStrings: 0,
    rifleSigma: given.rifleSigma,
    lotSigma: given.lotSigma,
    iterations: fit.iterations,
    runCount: problem.runCount,
  }
}

/** Rifle and lot factors are random effects (Gaussian priors on their logs, centred on 0 with `rifleSigma` and `lotSigma`), fitted only where the sessions hold two or more rifles, or lots of a powder; throws a `PowderFitError` as `fitPowder` does, and `unresolved` for a powder with a single charge (`apps/docs/docs/models/interior-powder-fit.md`, "Pooled fit over rifles, powders and lots"). */
export function fitPowderPooled(
  sessions: readonly PooledSession[],
  options: PooledFitOptions = {},
): PooledPowderFit {
  const {
    parameters: requested = ['burnRate'],
    priors = {},
    rifleSigma = pooledDefaults.rifleSigma,
    lotSigma = pooledDefaults.lotSigma,
    maxIterations = 30,
    maxCondition = 1e3,
  } = options
  checkPooled(sessions, requested, { rifleSigma, lotSigma, maxIterations, maxCondition })
  const { parameters, held } = pooledParameters(sessions, requested, priors)
  const problem = pooledProblem(
    sessions,
    parameters,
    priorRowsOf(parameters, priors, rifleSigma, lotSigma),
    options.options,
  )
  const fit = solvePooled(problem, { maxIterations, maxCondition })
  return pooledFitResult(problem, fit, { held, rifleSigma, lotSigma })
}

/** Options of `predictPooled`. */
export interface PooledPredictionOptions {
  /** Coverage of the interval, in (0, 1); default 0.9. */
  level?: number | undefined
  /** Of the predicted string mean, m/s: the spread of its shots over the root of their count; default 0, the interval of the true mean. */
  velocitySigma?: number | undefined
  /** Integration settings of the `interior` runs; use the fit's own. */
  options?: Settings<InteriorOptions> | undefined
}

/** Prediction of `predictPooled`: a mean muzzle velocity with its interval. */
export interface PooledPrediction {
  /** Charge mass, kg. */
  charge: number
  /** Coverage of the interval. */
  level: number
  /** Normal quantile of the coverage. */
  coverageFactor: number
  /** Velocity of the fitted model, m/s. */
  value: number
  /** From the parameter covariance, and for a rifle or lot the fit has not seen, its spread, m/s. */
  parameterUncertainty: number
  /** The fit's `modelError` times `value`, m/s. */
  modelUncertainty: number
  /** Root sum of squares of the parameter, model and string uncertainty, m/s. */
  standardUncertainty: number
  /** Lower end of the interval, m/s. */
  lower: number
  /** Upper end of the interval, m/s. */
  upper: number
  /** `interior` runs of the prediction. */
  runCount: number
}

/** Checks the charge, the level and the string sigma of a prediction, and that the fit knows the powder. */
function checkPooledPrediction(
  fit: PooledPowderFit,
  target: PooledTarget,
  charge: number,
  { level, velocitySigma }: { level: number; velocitySigma: number },
) {
  need(Number.isFinite(charge) && charge > 0, { code: 'chargeNotPositive', params: {} })
  need(level > 0 && level < 1, { code: 'levelOutsideUnit', params: {} })
  need(Number.isFinite(velocitySigma) && velocitySigma >= 0, {
    code: 'velocitySigmaNegative',
    params: {},
  })
  need(
    fit.sessions.some((s) => s.powder === target.powder),
    { code: 'targetPowderNotInFit', params: {} },
  )
}

/** From the parameter covariance along `gradient`, plus the spread of a rifle or lot the fit has not seen. */
function pooledVariance(
  fit: PooledPowderFit,
  target: PooledTarget,
  gradient: readonly number[],
  { v, burn }: { v: number; burn: number },
): number {
  let variance = gradient.reduce(
    (sum, gj, j) =>
      gj === 0
        ? sum
        : sum + gj * gradient.reduce((s, gk, k) => s + nth(nth(fit.covariance, j), k) * gk, 0),
    0,
  )
  const seen = (pick: (s: PooledPowderFit['sessions'][number]) => boolean) =>
    fit.sessions.some(pick)
  if (!seen((s) => s.rifle === target.rifle)) variance += (fit.rifleSigma * v) ** 2
  if (!seen((s) => s.powder === target.powder && s.lot === target.lot))
    variance += (fit.lotSigma * nth(gradient, burn)) ** 2
  return variance
}

/** With the pooled fit's prediction interval (parameter covariance, model error and the string's own uncertainty; an unseen rifle or lot adds its random effect's spread); the powder must be one of the fit (`apps/docs/docs/models/interior-powder-fit.md`, "Pooled fit over rifles, powders and lots"). */
export function predictPooled(
  fit: PooledPowderFit,
  target: PooledTarget,
  charge: number,
  options: PooledPredictionOptions = {},
): PooledPrediction {
  const { level = 0.9, velocitySigma = 0 } = options
  checkPooledPrediction(fit, target, charge, { level, velocitySigma })
  const { burn, temperature, rifle, lot } = sessionIndices(fit.parameters, target)
  const value = (k: number) => (k < 0 ? 1 : nth(fit.parameters, k).value)
  const theta0 = fit.parameters.map(() => 0)
  let runCount = 0
  const run = (theta: readonly number[]) => {
    runCount++
    const b = value(burn) * value(lot) * Math.exp(at(theta, burn) + at(theta, lot))
    const r = interior(
      targetLoad(target, charge, b, value(temperature) * Math.exp(at(theta, temperature))),
      options.options,
    )
    if (!r.valid) throw new PowderFitError('invalid', { charge, result: r })
    return r.muzzleVelocity * value(rifle) * Math.exp(at(theta, rifle))
  }
  const v = run(theta0)
  const step = 1e-3
  const gradient = theta0.map((_, j) => {
    if (j === rifle) return v
    if (j !== burn && j !== temperature && j !== lot) return 0
    const shifted = (d: number) => run(theta0.map((x, k) => (k === j ? x + d : x)))
    return (shifted(step) - shifted(-step)) / (2 * step)
  })
  const variance = pooledVariance(fit, target, gradient, { v, burn })
  const parameterUncertainty = Math.sqrt(Math.max(variance, 0))
  const modelUncertainty = fit.modelError * v
  const standardUncertainty = Math.hypot(parameterUncertainty, modelUncertainty, velocitySigma)
  const coverageFactor = Math.sqrt(chiSquareQuantile(level, 1))
  return {
    charge,
    level,
    coverageFactor,
    value: v,
    parameterUncertainty,
    modelUncertainty,
    standardUncertainty,
    lower: v - coverageFactor * standardUncertainty,
    upper: v + coverageFactor * standardUncertainty,
    runCount,
  }
}

/** `modelError` from strings it was not fitted to: the mean squared relative residual beyond the prediction variance without model error (parameters, string, an unseen rifle or lot), at least 0; each point needs its `velocitySigma` (`apps/docs/docs/models/interior-powder-fit.md`, "Pooled fit over rifles, powders and lots"). */
export function calibratePooled(
  fit: PooledPowderFit,
  heldOut: readonly PooledSession[],
  options: Pick<PooledPredictionOptions, 'options'> = {},
): PooledPowderFit {
  const base = { ...fit, modelError: 0 }
  const excess = heldOut.flatMap((s) =>
    s.ladder.map((x) => {
      need(x.velocitySigma !== undefined && positive(x.velocitySigma), {
        code: 'velocitySigmaMissing',
        params: {},
      })
      const p = predictPooled(base, s, x.charge, { ...options, velocitySigma: x.velocitySigma })
      return ((x.muzzleVelocity - p.value) ** 2 - p.standardUncertainty ** 2) / p.value ** 2
    }),
  )
  need(excess.length > 0, { code: 'noHeldOutString', params: {} })
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length
  return { ...fit, modelError: Math.sqrt(Math.max(mean, 0)), calibrationStrings: excess.length }
}
