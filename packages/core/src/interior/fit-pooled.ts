/**
 * Pooled powder fit: the burn coefficient and, on request, the temperature factor of each powder,
 * a velocity offset per rifle and a burn offset per lot, fitted to the chronograph sessions of many
 * rifles, powders and lots at once, with prediction intervals that hold a model-error term,
 * `apps/docs/docs/models/interior-powder-fit.md`, "Pooled fit over rifles, powders and lots".
 * Velocities only. SI in and out.
 */

import type { Settings } from '../errors.ts'
import { InputError, need, nth, positive } from '../errors.ts'
import { chiSquareQuantile } from '../groups/chi-square.ts'
import { logLeastSquares } from '../least-squares.ts'
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
  /**
   * The rifle, components and fixed inputs of the session. The burn coefficient of a powder's first
   * session starts the fit and replaces that of its other sessions; all share one burn kind.
   */
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
export type PooledPriors = Readonly<
  Record<string, Partial<Record<PooledRequest, PowderPrior | undefined>> | undefined>
>

/** Options of `fitPowderPooled`. */
export interface PooledFitOptions {
  /**
   * Per-powder parameters, default ['burnRate'], which must be among them. The temperature factor
   * is fitted for each powder whose sessions span two or more temperatures and whose load carries
   * a sensitivity, and listed in `held` for the others. `exponent` and `form` are refused with
   * reason `unresolved`: velocities do not resolve them.
   */
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

/**
 * Default spreads of the random effects (assumptions): a rifle moves the velocity by about 1 %, a
 * lot the burn coefficient by about 3 %.
 */
export const pooledDefaults = { rifleSigma: 0.01, lotSigma: 0.03 }

/**
 * Kind of a pooled parameter: the burn coefficient or temperature factor of a powder, the velocity
 * factor of a rifle, the factor of a lot on its powder's burn coefficient.
 */
export type PooledParameterKind = 'burnRate' | 'temperatureFactor' | 'rifle' | 'lot'

/** A fitted parameter of the pooled fit. Factors start at 1. */
export interface PooledPowderParameter {
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
export interface PooledResidual {
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
  /**
   * Relative standard deviation of the model error: 0 from `fitPowderPooled`, estimated by
   * `calibratePooled` from held-out strings.
   */
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
  need(sessions.length > 0, 'at least one session')
  const names: readonly string[] = requested
  if (names.includes('exponent') || names.includes('form')) throw new PowderFitError('unresolved')
  need(
    requested.includes('burnRate') &&
      requested.every((p) => p === 'burnRate' || p === 'temperatureFactor') &&
      new Set(requested).size === requested.length,
    'parameters: burnRate, temperatureFactor, each at most once, burnRate always',
  )
  need(rifleSigma > 0 && lotSigma > 0, 'rifleSigma and lotSigma must be positive')
  need(
    Number.isInteger(maxIterations) && maxIterations > 0,
    'maxIterations must be a positive integer',
  )
  need(maxCondition > 0, 'maxCondition must be positive')
  for (const s of sessions) {
    need(s.ladder.length > 0, 'at least one ladder point per session')
    need(positive(s.barrelLength), 'barrelLength must be positive')
    need(positive(s.propellantTemperature), 'propellantTemperature must be positive')
    for (const x of s.ladder) {
      need(positive(x.charge) && positive(x.muzzleVelocity), 'ladder charge and velocity positive')
      need(
        x.velocitySigma !== undefined && positive(x.velocitySigma),
        'velocitySigma on every point',
      )
      need(x.peakPressure === undefined, 'the pooled fit takes velocities only')
      need(
        x.barrelLength === undefined && x.propellantTemperature === undefined,
        'barrel length and temperature per session',
      )
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
    'the sessions of a powder share one burn kind',
  )
  need(
    Object.keys(priors).every((p) => powders.includes(p)),
    'a prior needs its powder in the sessions',
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
      `prior ${p.kind} of ${p.group}: value and sigma above 0`,
    )
    return [{ k, centre: Math.log(prior.value / p.initial), sigma: prior.sigma }]
  })
}

/**
 * Fits the burn coefficient (and, on request, the temperature factor) of each powder, a velocity
 * factor per rifle and a burn factor per lot to many sessions at once
 * (`apps/docs/docs/models/interior-powder-fit.md`, "Pooled fit over rifles, powders and lots").
 * Rifle and lot factors are random effects: Gaussian priors on their logs, centred on 0 with
 * `rifleSigma` and `lotSigma`. They are fitted only where the sessions hold two or more rifles, or
 * two or more lots of a powder. Throws a `PowderFitError` as `fitPowder` does, and `unresolved`
 * for a powder whose sessions hold a single charge.
 */
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
  const priorRows = priorRowsOf(parameters, priors, rifleSigma, lotSigma)

  const rows = sessions.flatMap((s, session) =>
    s.ladder.map((x) => ({ session, x, indices: sessionIndices(parameters, s) })),
  )
  let runCount = 0
  // last interior velocity per session and charge; a rifle step reuses it
  const cache = new Map<string, { burn: number; factor: number; velocity: number }>()
  const velocity = (row: (typeof rows)[number], theta: readonly number[]): number | null => {
    const { burn, temperature, rifle, lot } = row.indices
    const s = nth(sessions, row.session)
    const b = nth(parameters, burn).initial * Math.exp(at(theta, burn) + at(theta, lot))
    const factor = Math.exp(at(theta, temperature))
    const key = `${row.session} ${row.x.charge}`
    let hit = cache.get(key)
    if (hit?.burn !== b || hit.factor !== factor) {
      runCount++
      const r = interior(targetLoad(s, row.x.charge, b, factor), options.options)
      if (!r.valid) return null
      hit = { burn: b, factor, velocity: r.muzzleVelocity }
      cache.set(key, hit)
    }
    return hit.velocity * Math.exp(at(theta, rifle))
  }
  const predictRun = (theta: readonly number[], run: number): number | null => {
    const row = rows[run]
    return row === undefined
      ? nth(theta, nth(priorRows, run - rows.length).k)
      : velocity(row, theta)
  }
  const predict = (theta: number[], _current: number[], run?: number) => {
    const runs =
      run === undefined
        ? Array.from({ length: rows.length + priorRows.length }, (_, k) => k)
        : [run]
    const out: number[] = []
    for (const k of runs) {
      const v = predictRun(theta, k)
      if (v === null) return null
      out.push(v)
    }
    return out
  }
  const zero = parameters.map(() => 0)
  const start = predict(zero, zero)
  if (!start) throw new PowderFitError('invalid')
  const fit = logLeastSquares({
    parameterCount: parameters.length,
    observed: [...rows.map((r) => r.x.muzzleVelocity), ...priorRows.map((p) => p.centre)],
    standardUncertainty: [
      ...rows.map((r) => r.x.velocitySigma as number),
      ...priorRows.map((p) => p.sigma),
    ],
    weighted: true,
    // as in fitPowder: a Jacobian entry below 1e-6 of the observation per unit log parameter is noise
    floor: [
      ...rows.map((r) => (1e-6 * r.x.muzzleVelocity) / (r.x.velocitySigma as number)),
      ...priorRows.map(() => 0),
    ],
    first: start,
    predict,
    runs: [...rows, ...priorRows].map(() => 1),
    moves: (j, run) => {
      const row = rows[run]
      if (row === undefined) return nth(priorRows, run - rows.length).k === j
      return Object.values(row.indices).includes(j)
    },
    maxIterations,
    maxCondition,
    fail: (reason, _theta, extra = {}) => {
      throw new PowderFitError(reason === 'unreachable' ? 'invalid' : reason, extra)
    },
  })
  const { covariance, correlation, standardUncertainty } = fit
  // weighted, with at least the burn coefficient per powder: logLeastSquares always gives them
  if (!covariance || !correlation || !standardUncertainty)
    throw new InputError('the pooled fit has no covariance')
  const residuals = rows.map((r, i): PooledResidual => {
    const predicted = nth(fit.predicted, i)
    return {
      session: r.session,
      charge: r.x.charge,
      observed: r.x.muzzleVelocity,
      predicted,
      residual: predicted - r.x.muzzleVelocity,
    }
  })
  return {
    parameters: parameters.map((p, k) => {
      const value = p.initial * Math.exp(nth(fit.theta, k))
      return { ...p, value, standardUncertainty: value * nth(standardUncertainty, k) }
    }),
    held,
    sessions: sessions.map((s) => ({
      powder: s.powder,
      rifle: s.rifle,
      ...(s.lot === undefined ? {} : { lot: s.lot }),
    })),
    covariance,
    correlation,
    conditionNumber: fit.conditionNumber,
    chiSquare: fit.chiSquare,
    dataChiSquare: residuals.reduce(
      (sum, r, i) => sum + (r.residual / (nth(rows, i).x.velocitySigma as number)) ** 2,
      0,
    ),
    degreesOfFreedom: rows.length - parameters.length,
    residuals,
    modelError: 0,
    calibrationStrings: 0,
    rifleSigma,
    lotSigma,
    iterations: fit.iterations,
    runCount,
  }
}

/** Options of `predictPooled`. */
export interface PooledPredictionOptions {
  /** Coverage of the interval, in (0, 1); default 0.9. */
  level?: number | undefined
  /**
   * Standard uncertainty of the predicted string mean, m/s: the spread of its shots over the root
   * of their count; default 0, the interval of the true mean.
   */
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

/**
 * Mean muzzle velocity of `target` at `charge` with the prediction interval of the pooled fit
 * (`apps/docs/docs/models/interior-powder-fit.md`, "Pooled fit over rifles, powders and lots"): the
 * parameter covariance, the model error and the string's own uncertainty. A rifle or lot the fit
 * has not seen adds the spread of its random effect. The powder must be one of the fit.
 */
export function predictPooled(
  fit: PooledPowderFit,
  target: PooledTarget,
  charge: number,
  options: PooledPredictionOptions = {},
): PooledPrediction {
  const { level = 0.9, velocitySigma = 0 } = options
  need(Number.isFinite(charge) && charge > 0, 'charge must be positive')
  need(level > 0 && level < 1, 'level must lie in (0, 1)')
  need(Number.isFinite(velocitySigma) && velocitySigma >= 0, 'velocitySigma must be 0 or above')
  need(
    fit.sessions.some((s) => s.powder === target.powder),
    'the powder of the target must be one of the fit',
  )
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

/**
 * The fit with its `modelError` estimated from strings it was not fitted to
 * (`apps/docs/docs/models/interior-powder-fit.md`, "Pooled fit over rifles, powders and lots"):
 * the mean squared relative residual beyond the variance of the prediction without model error
 * (parameters, string, and an unseen rifle or lot), at least 0. Each point needs its
 * `velocitySigma`.
 */
export function calibratePooled(
  fit: PooledPowderFit,
  heldOut: readonly PooledSession[],
  options: Pick<PooledPredictionOptions, 'options'> = {},
): PooledPowderFit {
  const base = { ...fit, modelError: 0 }
  const excess = heldOut.flatMap((s) =>
    s.ladder.map((x) => {
      need(
        x.velocitySigma !== undefined && positive(x.velocitySigma),
        'velocitySigma on every point',
      )
      const p = predictPooled(base, s, x.charge, { ...options, velocitySigma: x.velocitySigma })
      return ((x.muzzleVelocity - p.value) ** 2 - p.standardUncertainty ** 2) / p.value ** 2
    }),
  )
  need(excess.length > 0, 'at least one held-out string')
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length
  return { ...fit, modelError: Math.sqrt(Math.max(mean, 0)), calibrationStrings: excess.length }
}
