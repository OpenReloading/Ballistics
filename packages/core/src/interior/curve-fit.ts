/**
 * Burn form and pressure exponent from a measured pressure-time trace: fits the burn coefficient,
 * the initial slope and transition point of a two-stage vivacity form and the pressure exponent of
 * the M3 interior model to the rising and falling side of one trace, together with the shift
 * between the trace's clock and the model's,
 * `apps/docs/docs/models/interior-curve-fit.md`. SI in and out.
 */

import { InputError, need, nth, type Settings } from '../errors.ts'
import { identifiability, logLeastSquares } from '../least-squares.ts'
import { PowderFitError } from './fit.ts'
import {
  type InteriorInvalid,
  type InteriorLoad,
  type InteriorOptions,
  type InteriorPoint,
  interior,
} from './model.ts'

/** Where the sensor measured: the model's pressure at the breech, the space mean or the projectile base. */
export type PressureSensor = 'breech' | 'mean' | 'base'

/** A measured pressure-time trace of one shot. */
export interface PressureHistory {
  /** Sensor position, which pressure of the model the trace is compared with. */
  sensor: PressureSensor
  /** Sample times, s, strictly increasing; the origin is arbitrary (the fit finds the shift to the model's clock). */
  time: readonly number[]
  /** Pressure at each sample, Pa. */
  pressure: readonly number[]
  /** Standard uncertainty of every sample, Pa; without it the fit estimates the noise from the residuals. */
  sigma?: number | undefined
}

/**
 * Parameter of the curve fit, on the load's vivacity law with a two-stage form: the burn
 * coefficient (restated at the trace's peak pressure), the form parameter `a` that sets the
 * initial slope of the form function, its transition point `z1` and the pressure exponent.
 */
export type CurveParameter = 'burnRate' | 'formSlope' | 'transition' | 'exponent'

const sensors: readonly PressureSensor[] = ['breech', 'mean', 'base']

const order: readonly CurveParameter[] = ['burnRate', 'formSlope', 'transition', 'exponent']

/** Options of `fitPressureCurve`. */
export interface CurveFitOptions {
  /** Default all four. A parameter other than the burn coefficient that the trace does not resolve keeps its start value and is reported `fixed`. */
  parameters?: readonly CurveParameter[] | undefined
  /** Levenberg-Marquardt iterations before the fit fails with reason `not-converged`; default 100. */
  maxIterations?: number | undefined
  /** Largest condition number of the column-scaled Jacobian; default 1e3. */
  maxCondition?: number | undefined
  /** Variance inflation above which a parameter is `weak` (collinear); default 10. */
  maxInflation?: number | undefined
  /** Relative standard uncertainty above which a parameter is `weak` (imprecise); default 0.25. */
  maxRelativeStandardUncertainty?: number | undefined
  /**
   * The fit window ends where the trace has fallen to this fraction of its peak, in (0, 1); default 0.5.
   * The model must still be in the barrel there.
   */
  fallFraction?: number | undefined
  /** Integration settings of every `interior` run; default `interiorDefaults`. */
  options?: Settings<InteriorOptions> | undefined
}

/** Why a parameter is `weak` or `fixed`. */
export type CurveReason = 'collinear' | 'imprecise' | 'unresolved' | 'ill-conditioned'

/** Identifiability of one parameter of the curve fit. */
export interface CurveParameterReport {
  /** Which parameter; `timeShift` (s, trace time minus model time) is always fitted and not an option. */
  name: CurveParameter | 'timeShift'
  /** `identified`; `weak` (fitted, but `reasons` apply); `fixed` (dropped from the fit, the start value kept). */
  status: 'identified' | 'weak' | 'fixed'
  /** Start value: the input load's, except the burn coefficient, which is the input restated at `referencePressure`. */
  initial: number
  /** Fitted value, same unit as `initial`; the start value when `fixed`. */
  value: number
  /** Standard uncertainty with every other fitted parameter free; absent when `fixed`, `Infinity` when the trace gives no covariance. */
  standardUncertainty?: number
  /** Relative standard uncertainty, the standard error of the log parameter. */
  relativeStandardUncertainty?: number
  /** Variance inflation factor against the other fitted parameters (1: independent). */
  varianceInflation?: number
  /** Empty when `identified`. */
  reasons: CurveReason[]
}

/** One fitted sample of the trace window. */
export interface CurveResidual {
  /** Time from the 25 % rise of the trace, s. */
  time: number
  /** Measured pressure, Pa. */
  observed: number
  /** Model pressure at the fitted parameters, Pa. */
  predicted: number
}

/** Result of `fitPressureCurve`; a simulation result, not load data. */
export interface PressureCurveFit {
  /** The input load with the fitted values applied and its burn coefficient restated at `referencePressure`. */
  load: InteriorLoad
  /** Pressure at which the fitted burn coefficient is stated, Pa: the peak of the trace. */
  referencePressure: number
  /** One entry per requested parameter in `CurveParameter` order, then the time shift. */
  parameters: CurveParameterReport[]
  /** Correlation of the fitted parameters in `parameters` order without the `fixed` ones, then the time shift. */
  correlation: number[][]
  /** Condition number of the column-scaled Jacobian at the solution. */
  conditionNumber: number
  /** Whether `sigma` was given; without it the covariance is scaled by the residual variance. */
  weighted: boolean
  /** The samples in the fit window. */
  residuals: CurveResidual[]
  /** Sum of squared residuals over sigma (sigma 1 without one). */
  chiSquare: number
  /** Samples minus fitted parameters and the time shift. */
  degreesOfFreedom: number
  /** Window of the trace, s on the trace's own clock: from the 25 % rise to the fall to `fallFraction` of the peak. */
  window: { start: number; end: number }
  /** Iterations of the solver. */
  iterations: number
  /** `interior` runs of the fit. */
  runCount: number
}

/** The M3 burn law a curve fit needs: vivacity with a two-stage form. */
type TwoStageBurn = Extract<InteriorLoad['propellant']['burn'], { kind: 'vivacity' }> & {
  form: { kind: 'twoStage'; a: number; m: number; q: number; z1: number }
}

/** Fraction of the peak at which the model and the trace are aligned: above the kink at the shot start. */
const peakLevel = 0.25

/** Largest value; `Math.max(...v)` throws on a long trace. */
const maxOf = (v: readonly number[]) => v.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY)

/** Lagrange form of the parabola through three points: value and slope at `at`. */
function parabola(t: readonly number[], v: readonly number[], at: number): [number, number] {
  const [t0, t1, t2] = [nth(t, 0), nth(t, 1), nth(t, 2)]
  const w0 = nth(v, 0) / ((t0 - t1) * (t0 - t2))
  const w1 = nth(v, 1) / ((t1 - t0) * (t1 - t2))
  const w2 = nth(v, 2) / ((t2 - t0) * (t2 - t1))
  return [
    w0 * (at - t1) * (at - t2) + w1 * (at - t0) * (at - t2) + w2 * (at - t0) * (at - t1),
    w0 * (2 * at - t1 - t2) + w1 * (2 * at - t0 - t2) + w2 * (2 * at - t0 - t1),
  ]
}

/**
 * First time the series reaches `level` from below, or the first time when it starts above. The
 * linear crossing between two samples is refined on the parabola through them and the next sample:
 * a coarse trace would otherwise shift its rise by a fraction of the sample step.
 */
function riseTime(time: readonly number[], value: readonly number[], level: number): number {
  const i = value.findIndex((v) => v >= level)
  if (i === 0) return nth(time, 0)
  const [t0, t1, v0, v1] = [nth(time, i - 1), nth(time, i), nth(value, i - 1), nth(value, i)]
  let t = t0 + ((level - v0) / (v1 - v0)) * (t1 - t0)
  if (i + 1 < time.length) {
    const [pt, pv] = [time.slice(i - 1, i + 2), value.slice(i - 1, i + 2)]
    for (let k = 0; k < 3; k++) {
      const [q, slope] = parabola(pt, pv, t)
      if (slope > 0) t += (level - q) / slope
    }
  }
  return Math.min(Math.max(t, t0), t1)
}

/** The trace window: from its 25 % rise to the first fall to `fall` of its peak, as sample indices and times. */
function traceWindow(trace: PressureHistory, peak: number, fall: number) {
  const { time, pressure } = trace
  const start = riseTime(time, pressure, peakLevel * peak)
  const top = pressure.indexOf(peak)
  const down = pressure.findIndex((v, i) => i > top && v <= fall * peak)
  need(down > 0, 'the trace never falls to the fall fraction of its peak after the peak')
  const [t0, t1, v0, v1] = [
    nth(time, down - 1),
    nth(time, down),
    nth(pressure, down - 1),
    nth(pressure, down),
  ]
  const end = t0 + ((fall * peak - v0) / (v1 - v0)) * (t1 - t0)
  const rows = time.flatMap((t, i) => (t >= start && t <= end ? [i] : []))
  return { start, end, rows }
}

const pressureOf = (sensor: PressureSensor) => (p: InteriorPoint) =>
  sensor === 'breech' ? p.breechPressure : sensor === 'mean' ? p.meanPressure : p.basePressure

/** Checks the inputs; returns the load's two-stage vivacity law and the parameters to fit. */
function checkInput(load: InteriorLoad, trace: PressureHistory, options: CurveFitOptions) {
  const { time, pressure, sigma } = trace
  need(
    time.length === pressure.length &&
      time.length > 1 &&
      time.every((t, i) => Number.isFinite(t) && (i === 0 || t > nth(time, i - 1))) &&
      pressure.every(Number.isFinite),
    'trace: equal numbers of finite, strictly increasing times and finite pressures, at least 2',
  )
  need(sensors.includes(trace.sensor), 'trace.sensor: breech, mean or base')
  need(sigma === undefined || (Number.isFinite(sigma) && sigma > 0), 'sigma must be positive')
  const given = load.propellant.burn
  need(
    given.kind === 'vivacity' && given.form.kind === 'twoStage',
    'a curve fit needs a vivacity burn law with a two-stage form',
  )
  const burn = given as TwoStageBurn
  const wanted = options.parameters ?? order
  need(
    wanted.length > 0 &&
      new Set(wanted).size === wanted.length &&
      wanted.every((p) => order.includes(p)),
    'parameters: burnRate, formSlope, transition and exponent, each at most once',
  )
  need(!wanted.includes('formSlope') || burn.form.a > 0, 'formSlope needs a start value above 0')
  need(!wanted.includes('transition') || burn.form.z1 < 1, 'transition needs a start value below 1')
  need(!wanted.includes('exponent') || burn.exponent > 0, 'exponent needs a start value above 0')
  const { maxIterations = 100, maxCondition = 1e3 } = options
  need(
    Number.isInteger(maxIterations) && maxIterations > 0,
    'maxIterations must be a positive integer',
  )
  need(maxCondition > 0, 'maxCondition must be positive')
  need(
    options.fallFraction === undefined || (options.fallFraction > 0 && options.fallFraction < 1),
    'fallFraction must lie in (0, 1)',
  )
  return { burn, wanted }
}

/** Parameters to hold at their start values, why, and the report of the attempt that showed it. */
interface Withheld {
  names: CurveParameter[]
  reasons: CurveReason[]
  from?: CurveParameterReport
}

/** Order in which an ill-conditioned fit gives up parameters: the exponent first. */
const giveUp: readonly CurveParameter[] = ['exponent', 'formSlope', 'transition']

/**
 * What a failed attempt on `current` holds fixed: the unresolved parameters, or on an
 * ill-conditioned fit the next of `giveUp`. Rethrows any other failure, and one that would leave
 * nothing to fit.
 */
function withheld(e: unknown, current: readonly CurveParameter[]): Withheld {
  if (!(e instanceof PowderFitError)) throw e
  const names =
    e.reason === 'unresolved'
      ? (e.unresolved ?? []).flatMap((i) => current.slice(i, i + 1))
      : e.reason === 'ill-conditioned'
        ? giveUp.filter((p) => current.includes(p)).slice(0, 1)
        : []
  const held = names.filter((p) => p !== 'burnRate')
  if (held.length === 0 || held.length === current.length) throw e
  return { names: held, reasons: [e.reason as CurveReason] }
}

/** Fits the burn coefficient, form and exponent of `load`'s vivacity law to the trace. */
export function fitPressureCurve(
  load: InteriorLoad,
  trace: PressureHistory,
  options: CurveFitOptions = {},
): PressureCurveFit {
  const { time, pressure, sigma } = trace
  const { maxInflation = 10, maxRelativeStandardUncertainty = 0.25 } = options
  const { maxIterations = 100, maxCondition = 1e3, fallFraction = 0.5 } = options
  const { burn, wanted } = checkInput(load, trace, options)
  const { form } = burn

  const peak = maxOf(pressure)
  need(peak > 0, 'the trace has no positive pressure')
  const window = traceWindow(trace, peak, fallFraction)
  need(window.rows.length > wanted.length + 1, 'too few trace samples in the window')
  const times = window.rows.map((i) => nth(time, i))
  const observed = window.rows.map((i) => nth(pressure, i))
  const rowSigma = sigma ?? 1

  // M3 states the burn rate at a reference pressure: restating it at the trace's peak keeps the
  // coefficient and the exponent from being collinear and gives the same model
  const restated = burn.vivacity * (peak / burn.referencePressure) ** burn.exponent
  const base = [restated, form.a, form.z1, burn.exponent]
  const pick = pressureOf(trace.sensor)
  let runCount = 0
  /** The last rejected candidate: an invalid run, or the window past the model's muzzle exit. */
  let rejected: InteriorInvalid | 'window' | undefined
  /** Value of each parameter at the log parameters `theta` of the fitted ones, the start value for the others. */
  const values = (parameters: readonly CurveParameter[], theta: readonly number[]) =>
    order.map((name, k) => {
      const j = parameters.indexOf(name)
      return nth(base, k) * (j < 0 ? 1 : Math.exp(nth(theta, j)))
    })
  const apply = (parameters: readonly CurveParameter[], theta: readonly number[]): InteriorLoad => {
    const [vivacity, a, z1, exponent] = values(parameters, theta) as [
      number,
      number,
      number,
      number,
    ]
    return {
      ...load,
      propellant: {
        ...load.propellant,
        burn: {
          ...burn,
          vivacity,
          exponent,
          referencePressure: peak,
          form: { ...form, a, z1 },
        },
      },
    }
  }
  const start = interior(apply([], []), options.options)
  if (!start.valid) throw new PowderFitError('invalid', { result: start })
  const risePressure = start.points.map(pick)
  /** Trace time at model time 0 at the start values: the model's rise meets the trace's. */
  const shift0 =
    window.start -
    riseTime(
      start.points.map((p) => p.time),
      risePressure,
      peakLevel * maxOf(risePressure),
    )
  /** The time shift is the last parameter of the fit; one unit of its log-free parameter is `shiftScale` s. */
  const shiftScale = 1e-4
  /** Model pressure at the window's samples, or null when the candidate is rejected. */
  const evaluate = (parameters: readonly CurveParameter[], theta: readonly number[]) => {
    runCount++
    const run = interior(apply(parameters, theta), options.options)
    if (!run.valid) {
      rejected = run
      return null
    }
    const t = run.points.map((p) => p.time)
    const p = run.points.map(pick)
    const shift = shift0 + shiftScale * nth(theta, parameters.length)
    if (nth(times, 0) - shift < 0 || (times.at(-1) as number) - shift > (t.at(-1) as number)) {
      rejected = 'window'
      return null
    }
    let k = 1
    return times.map((x) => {
      while (nth(t, k) < x - shift) k++
      const f = (x - shift - nth(t, k - 1)) / (nth(t, k) - nth(t, k - 1))
      return nth(p, k - 1) + f * (nth(p, k) - nth(p, k - 1))
    })
  }

  /** One fit of `parameters`, with the identifiability of each from the Jacobian at the solution. */
  const attempt = (parameters: readonly CurveParameter[]) => {
    const zero = [...parameters.map(() => 0), 0]
    const first = evaluate(parameters, zero)
    if (!first) {
      if (rejected === 'window' || rejected === undefined)
        throw new InputError(
          'the model at the start values leaves the barrel before the end of the trace window; start closer or raise fallFraction',
        )
      throw new PowderFitError('invalid', { result: rejected })
    }
    const unreachable = () =>
      new PowderFitError('invalid', rejected && rejected !== 'window' ? { result: rejected } : {})
    const fit = logLeastSquares({
      parameterCount: parameters.length + 1,
      observed,
      standardUncertainty: observed.map(() => rowSigma),
      weighted: sigma !== undefined,
      // a Jacobian entry below 1e-6 of the peak per unit log parameter is noise
      floor: observed.map(() => (1e-6 * peak) / rowSigma),
      first,
      predict: (theta) => evaluate(parameters, theta),
      maxIterations,
      maxCondition,
      // the valley of correlated form parameters is flat: a step that gains 1e-9 of chi2 is converged
      tolerance: 1e-9,
      fail: (reason, _theta, extra = {}) => {
        throw reason === 'unreachable' ? unreachable() : new PowderFitError(reason, extra)
      },
    })
    const step = 1e-3
    const columns = zero.map((_, j) => {
      const at = (d: number) =>
        evaluate(
          parameters,
          fit.theta.map((x, k) => (k === j ? x + d : x)),
        )
      const [up, down] = [at(step), at(-step)]
      if (!up || !down) throw unreachable()
      return up.map((v, i) => (v - nth(down, i)) / (2 * step * rowSigma))
    })
    const info = identifiability(observed.map((_, i) => columns.map((c) => nth(c, i))))
    const done = values(parameters, fit.theta)
    const collinear = (k: number) =>
      nth(info.varianceInflation, k) > maxInflation ? ['collinear' as const] : []
    const n = parameters.length
    const timeShift: CurveParameterReport = {
      name: 'timeShift',
      status: collinear(n).length > 0 ? 'weak' : 'identified',
      initial: shift0,
      value: shift0 + shiftScale * nth(fit.theta, n),
      standardUncertainty: shiftScale * (fit.standardUncertainty?.[n] ?? Infinity),
      varianceInflation: nth(info.varianceInflation, n),
      reasons: collinear(n),
    }
    const reports = parameters.map((name, k): CurveParameterReport => {
      const j = order.indexOf(name)
      const value = nth(done, j)
      const relative = fit.standardUncertainty?.[k] ?? Infinity
      const inflation = nth(info.varianceInflation, k)
      const reasons: CurveReason[] = [
        ...collinear(k),
        ...(relative > maxRelativeStandardUncertainty ? ['imprecise' as const] : []),
      ]
      return {
        name,
        status: reasons.length > 0 ? 'weak' : 'identified',
        initial: nth(base, j),
        value,
        standardUncertainty: value * relative,
        relativeStandardUncertainty: relative,
        varianceInflation: inflation,
        reasons,
      }
    })
    return { parameters, fit, reports: [...reports, timeShift] }
  }

  // A parameter the trace does not resolve is held at its start value instead of failing the
  // fit; the burn coefficient is never dropped
  const held = new Map<CurveParameter, CurveParameterReport>()
  let current = [...wanted]
  let result: ReturnType<typeof attempt> | undefined
  while (!result) {
    let cause: Withheld | undefined
    try {
      const done = attempt(current)
      const weak = done.reports.find((r) => r.name === 'exponent' && r.status === 'weak')
      // a lone exponent stays in the fit as `weak`: holding it would leave nothing to fit
      if (weak && current.length > 1)
        cause = { names: ['exponent'], reasons: weak.reasons, from: weak }
      else result = done
    } catch (e) {
      cause = withheld(e, current)
    }
    for (const name of cause?.names ?? []) {
      const j = order.indexOf(name)
      held.set(name, {
        // the variance inflation shows why; no uncertainty of a parameter that is not fitted
        ...(cause?.from?.varianceInflation === undefined
          ? {}
          : { varianceInflation: cause.from.varianceInflation }),
        name,
        status: 'fixed',
        initial: nth(base, j),
        value: nth(base, j),
        reasons: cause?.reasons ?? [],
      })
    }
    current = current.filter((p) => !held.has(p))
  }
  const { fit, parameters, reports } = result as NonNullable<typeof result>
  return {
    load: apply(parameters, fit.theta),
    referencePressure: peak,
    parameters: [
      ...order.flatMap((name) => held.get(name) ?? reports.filter((r) => r.name === name)),
      ...reports.filter((r) => r.name === 'timeShift'),
    ],
    correlation: fit.correlation as number[][],
    conditionNumber: fit.conditionNumber,
    weighted: sigma !== undefined,
    residuals: times.map((t, i) => ({
      time: t - window.start,
      observed: nth(observed, i),
      predicted: nth(fit.predicted, i),
    })),
    chiSquare: fit.chiSquare,
    degreesOfFreedom: observed.length - parameters.length - 1,
    window: { start: window.start, end: window.end },
    iterations: fit.iterations,
    runCount,
  }
}
