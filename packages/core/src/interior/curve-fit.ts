/**
 * Burn form and pressure exponent from a measured pressure-time trace: fits the burn coefficient,
 * the initial slope and transition point of a two-stage vivacity form and the pressure exponent of
 * the M3 interior model to the rising and falling side of one trace, together with the shift
 * between the trace's clock and the model's, or to several traces of one powder at different charges
 * with one shift each, `apps/docs/docs/models/interior-curve-fit.md`. SI in and out.
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
  /**
   * Variance inflation above which a parameter is `weak` (collinear); default 10, and 100 in
   * `fitPressureCurves` of traces at two or more charges without a `narrowPeaks` warning.
   */
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

/**
 * Why a parameter is `weak` or `fixed`; `inconsistent`: the exponents of the leave-one-trace-out
 * refits of a joint fit spread wider than its interval.
 */
export type CurveReason =
  | 'collinear'
  | 'imprecise'
  | 'unresolved'
  | 'ill-conditioned'
  | 'inconsistent'

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
  /**
   * Standard uncertainty with every other fitted parameter free, linearized at the solution; it
   * holds the trace noise only, not model error. Absent when `fixed`, `Infinity` when the trace
   * gives no covariance.
   */
  standardUncertainty?: number
  /** Relative standard uncertainty, the standard error of the log parameter. */
  relativeStandardUncertainty?: number
  /** Variance inflation factor against the other fitted parameters (1: independent). */
  varianceInflation?: number
  /**
   * The exponent only, when fitted: an interval meant to cover the true exponent in 90 % of fits,
   * `value` times `exp(±k u_rel)` with the coverage factor `k` of a synthetic study. It holds the
   * trace noise only: missing physics biases the exponent outside it unseen.
   */
  interval?: { low: number; high: number }
  /**
   * The exponent only, when fitted to three or more traces: the exponent refitted without each
   * trace in turn, in input order. Absent when a refit fails or holds the exponent.
   */
  leaveOneOut?: number[]
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

/** A pressure trace of one shot of a joint fit and the charge it was fired with. */
export interface ChargedTrace {
  /** Charge mass of the shot, kg; the rest of the load is shared. */
  charge: number
  /** The measured trace. */
  trace: PressureHistory
}

/**
 * An input check of a joint fit: `sameCharge` names traces fired at the same charge (repeat shots,
 * which add no pressure range), `narrowPeaks` a highest peak below 1.2 times the lowest, which
 * keeps the exponent's limit at that of one trace.
 */
export interface CurveWarning {
  /** Which check. */
  reason: 'sameCharge' | 'narrowPeaks'
  /** Indices of the traces it names, in input order. */
  traces: number[]
  /** The same as a sentence. */
  message: string
}

/** Window and residuals of one trace of a joint fit. */
export interface TraceResiduals {
  /** Window of the trace, s on the trace's own clock. */
  window: { start: number; end: number }
  /** The samples of the trace in the fit window. */
  residuals: CurveResidual[]
}

/** Result of `fitPressureCurves`; a simulation result, not load data. */
export interface PressureCurvesFit extends Omit<PressureCurveFit, 'window' | 'residuals'> {
  /**
   * Pressure at which the fitted burn coefficient is stated, Pa: the geometric mean of the
   * trace peaks.
   */
  referencePressure: number
  /** One entry per requested parameter in `CurveParameter` order, then one time shift per trace in input order. */
  parameters: CurveParameterReport[]
  /** Window and residuals of each trace, in input order. */
  traces: TraceResiduals[]
  /** What the input checks found; empty with one trace. */
  warnings: CurveWarning[]
}

/** Coverage factor of the exponent's 90 % interval on its relative standard uncertainty, from a synthetic study. */
const coverage = 2.2

/** Smallest ratio of the highest to the lowest trace peak at which a joint fit resolves the exponent. */
const minPeakRatio = 1.2

/** Charges equal to this relative difference are the same charge. */
const sameCharge = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(a, b)

/** The traces that cannot resolve the exponent together. */
function curveWarnings(charges: readonly number[], peaks: readonly number[]): CurveWarning[] {
  const warnings: CurveWarning[] = []
  const seen = new Set<number>()
  charges.forEach((c, k) => {
    if (seen.has(k)) return
    const group = charges.flatMap((d, j) => (sameCharge(c, d) ? [j] : []))
    for (const j of group) seen.add(j)
    if (group.length > 1)
      warnings.push({
        reason: 'sameCharge',
        traces: group,
        message: `traces ${group.join(', ')} have the same charge`,
      })
  })
  if (charges.length > 1) {
    const [high, low] = [maxOf(peaks), peaks.reduce((a, b) => Math.min(a, b))]
    if (high < minPeakRatio * low) {
      const traces = [peaks.indexOf(low), peaks.indexOf(high)]
      warnings.push({
        reason: 'narrowPeaks',
        traces,
        message: `the highest peak (trace ${traces[1]}) is ${(high / low).toFixed(2)} times the lowest (trace ${traces[0]}), below ${minPeakRatio}`,
      })
    }
  }
  return warnings
}

/** Fits the burn coefficient, form and exponent of `load`'s vivacity law to the trace. */
export function fitPressureCurve(
  load: InteriorLoad,
  trace: PressureHistory,
  options: CurveFitOptions = {},
): PressureCurveFit {
  const {
    traces,
    warnings: _,
    ...fit
  } = fitPressureCurves(load, [{ charge: load.charge, trace }], options)
  const { window, residuals } = nth(traces, 0)
  return { ...fit, window, residuals }
}

/**
 * Fits the burn coefficient, form and exponent of `load`'s vivacity law to several traces of the
 * same powder, rifle and sensor, each fired with its own charge, with one time shift per trace.
 */
export function fitPressureCurves(
  load: InteriorLoad,
  shots: readonly ChargedTrace[],
  options: CurveFitOptions = {},
): PressureCurvesFit {
  return fitTraces(load, shots, options, true)
}

/** `fitPressureCurves`, with the leave-one-trace-out refits only when `refit`. */
function fitTraces(
  load: InteriorLoad,
  shots: readonly ChargedTrace[],
  options: CurveFitOptions,
  refit: boolean,
): PressureCurvesFit {
  need(shots.length > 0, 'at least one trace')
  need(
    shots.every((s) => Number.isFinite(s.charge) && s.charge > 0),
    'charge must be positive',
  )
  need(
    shots.every((s) => s.trace.sigma === undefined) ||
      shots.every((s) => s.trace.sigma !== undefined),
    'sigma: on every trace or on none',
  )
  const { maxRelativeStandardUncertainty = 0.25 } = options
  const { maxIterations = 100, maxCondition = 1e3, fallFraction = 0.5 } = options
  const { burn, wanted } = nth(
    shots.map((s) => checkInput(load, s.trace, options)),
    0,
  )
  const { form } = burn
  const weighted = nth(shots, 0).trace.sigma !== undefined

  const traces = shots.map(({ charge, trace }) => {
    const peak = maxOf(trace.pressure)
    need(peak > 0, 'the trace has no positive pressure')
    const window = traceWindow(trace, peak, fallFraction)
    return {
      charge,
      peak,
      window,
      times: window.rows.map((i) => nth(trace.time, i)),
      observed: window.rows.map((i) => nth(trace.pressure, i)),
      rowSigma: trace.sigma ?? 1,
      pick: pressureOf(trace.sensor),
    }
  })
  const observed = traces.flatMap((t) => t.observed)
  const shotCount = traces.length
  need(observed.length > wanted.length + shotCount, 'too few trace samples in the window')
  const peaks = traces.map((t) => t.peak)
  const warnings = curveWarnings(
    traces.map((t) => t.charge),
    peaks,
  )
  // traces at two or more charges spanning 1.2 in peak resolve the exponent at a limit of 100
  const spread =
    traces.some((t) => !sameCharge(t.charge, nth(traces, 0).charge)) &&
    warnings.every((w) => w.reason !== 'narrowPeaks')
  const { maxInflation = spread ? 100 : 10 } = options
  // the product of K-th roots is exact for one trace, where the mean of the logs is not
  const peak = peaks.reduce((a, b) => a * b ** (1 / shotCount), 1)

  // M3 states the burn rate at a reference pressure: restating it at the traces' peak keeps the
  // coefficient and the exponent from being collinear and gives the same model
  const restated = burn.vivacity * (peak / burn.referencePressure) ** burn.exponent
  const base = [restated, form.a, form.z1, burn.exponent]
  let runCount = 0
  /** The last rejected candidate: an invalid run, or the window past the model's muzzle exit. */
  let rejected: InteriorInvalid | 'window' | undefined
  /** Value of each parameter at the log parameters `theta` of the fitted ones, the start value for the others. */
  const values = (parameters: readonly CurveParameter[], theta: readonly number[]) =>
    order.map((name, k) => {
      const j = parameters.indexOf(name)
      return nth(base, k) * (j < 0 ? 1 : Math.exp(nth(theta, j)))
    })
  const apply = (
    parameters: readonly CurveParameter[],
    theta: readonly number[],
    charge = load.charge,
  ): InteriorLoad => {
    const [vivacity, a, z1, exponent] = values(parameters, theta) as [
      number,
      number,
      number,
      number,
    ]
    return {
      ...load,
      charge,
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
  /** Trace time at model time 0 at the start values, per trace: the model's rise meets the trace's. */
  const shift0 = traces.map(({ charge, pick, window }) => {
    const start = interior(apply([], [], charge), options.options)
    if (!start.valid) throw new PowderFitError('invalid', { result: start })
    const risePressure = start.points.map(pick)
    return (
      window.start -
      riseTime(
        start.points.map((p) => p.time),
        risePressure,
        peakLevel * maxOf(risePressure),
      )
    )
  })
  /** The time shifts follow the parameters of the fit; one unit of their log-free parameter is `shiftScale` s. */
  const shiftScale = 1e-4
  /** Model pressure at the window's samples of trace `k`, or null when the candidate is rejected. */
  const evaluateOne = (
    parameters: readonly CurveParameter[],
    theta: readonly number[],
    k: number,
  ) => {
    const { charge, pick, times } = nth(traces, k)
    runCount++
    const run = interior(apply(parameters, theta, charge), options.options)
    if (!run.valid) {
      rejected = run
      return null
    }
    const t = run.points.map((p) => p.time)
    const p = run.points.map(pick)
    const shift = nth(shift0, k) + shiftScale * nth(theta, parameters.length + k)
    if (nth(times, 0) - shift < 0 || (times.at(-1) as number) - shift > (t.at(-1) as number)) {
      rejected = 'window'
      return null
    }
    let i = 1
    return times.map((x) => {
      while (nth(t, i) < x - shift) i++
      const f = (x - shift - nth(t, i - 1)) / (nth(t, i) - nth(t, i - 1))
      return nth(p, i - 1) + f * (nth(p, i) - nth(p, i - 1))
    })
  }
  /** Model pressure at the windows of trace `k`, or of all traces stacked without it. */
  const evaluate = (
    parameters: readonly CurveParameter[],
    theta: readonly number[],
    k?: number,
  ) => {
    if (k !== undefined) return evaluateOne(parameters, theta, k)
    const all: number[] = []
    for (let j = 0; j < shotCount; j++) {
      const one = evaluateOne(parameters, theta, j)
      if (!one) return null
      all.push(...one)
    }
    return all
  }
  const rowSigma = traces.flatMap((t) => t.observed.map(() => t.rowSigma))
  const runs = traces.map((t) => t.observed.length)

  /** One fit of `parameters`, with the identifiability of each from the Jacobian at the solution. */
  const attempt = (parameters: readonly CurveParameter[]) => {
    const n = parameters.length
    const zero = [...parameters.map(() => 0), ...traces.map(() => 0)]
    // a time shift moves only its own trace
    const moves = (j: number, run: number) => j < n || j - n === run
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
      parameterCount: zero.length,
      observed,
      standardUncertainty: rowSigma,
      weighted,
      // a Jacobian entry below 1e-6 of the peak per unit log parameter is noise
      floor: traces.flatMap((t) => t.observed.map(() => (1e-6 * t.peak) / t.rowSigma)),
      first,
      predict: (theta, _current, run) => evaluate(parameters, theta, run),
      runs,
      moves,
      maxIterations,
      maxCondition,
      // the valley of correlated form parameters is flat: a step that gains 1e-9 of chi2 is converged
      tolerance: 1e-9,
      fail: (reason, _theta, extra = {}) => {
        throw reason === 'unreachable' ? unreachable() : new PowderFitError(reason, extra)
      },
    })
    const step = 1e-3
    const columns = zero.map((_, j) =>
      runs.flatMap((count, run) => {
        if (!moves(j, run)) return Array.from({ length: count }, () => 0)
        const at = (d: number) =>
          evaluate(
            parameters,
            fit.theta.map((x, k) => (k === j ? x + d : x)),
            run,
          )
        const [up, down] = [at(step), at(-step)]
        if (!up || !down) throw unreachable()
        const { rowSigma: s } = nth(traces, run)
        return up.map((v, i) => (v - nth(down, i)) / (2 * step * s))
      }),
    )
    const info = identifiability(observed.map((_, i) => columns.map((c) => nth(c, i))))
    const done = values(parameters, fit.theta)
    const collinear = (k: number) =>
      nth(info.varianceInflation, k) > maxInflation ? ['collinear' as const] : []
    const timeShifts = shift0.map((initial, k): CurveParameterReport => {
      const j = n + k
      return {
        name: 'timeShift',
        status: collinear(j).length > 0 ? 'weak' : 'identified',
        initial,
        value: initial + shiftScale * nth(fit.theta, j),
        standardUncertainty: shiftScale * (fit.standardUncertainty?.[j] ?? Infinity),
        varianceInflation: nth(info.varianceInflation, j),
        reasons: collinear(j),
      }
    })
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
        ...(name === 'exponent'
          ? {
              interval: {
                low: value * Math.exp(-coverage * relative),
                high: value * Math.exp(coverage * relative),
              },
            }
          : {}),
        reasons,
      }
    })
    return { parameters, fit, reports: [...reports, ...timeShifts] }
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
  if (refit)
    // a subset may narrow the peak range: its exponent is measured, not judged
    checkSpread(reports, apply(parameters, fit.theta), shots, {
      ...options,
      parameters,
      maxInflation: Infinity,
      maxRelativeStandardUncertainty: Infinity,
    })
  return {
    load: apply(parameters, fit.theta),
    referencePressure: peak,
    parameters: [
      ...order.flatMap((name) => held.get(name) ?? reports.filter((r) => r.name === name)),
      ...reports.filter((r) => r.name === 'timeShift'),
    ],
    correlation: fit.correlation as number[][],
    conditionNumber: fit.conditionNumber,
    weighted,
    traces: traces.map(({ times, observed, window }, k) => {
      const from = runs.slice(0, k).reduce((a, b) => a + b, 0)
      return {
        window: { start: window.start, end: window.end },
        residuals: times.map((t, i) => ({
          time: t - window.start,
          observed: nth(observed, i),
          predicted: nth(fit.predicted, from + i),
        })),
      }
    }),
    chiSquare: fit.chiSquare,
    degreesOfFreedom: observed.length - parameters.length - shotCount,
    iterations: fit.iterations,
    runCount,
    warnings,
  }
}

/**
 * With three or more traces and the exponent fitted, sets the leave-one-out exponents on its
 * report, and the reason `inconsistent` when their jackknife standard error on the log exponent
 * exceeds the full width of its interval.
 */
function checkSpread(
  reports: CurveParameterReport[],
  start: InteriorLoad,
  shots: readonly ChargedTrace[],
  options: CurveFitOptions,
) {
  const exponent = reports.find((r) => r.name === 'exponent')
  if (!exponent || shots.length < 3) return
  const values = refits(start, shots, options)
  if (!values) return
  exponent.leaveOneOut = values
  if (jackknife(values) > 2 * coverage * (exponent.relativeStandardUncertainty ?? Infinity)) {
    exponent.status = 'weak'
    exponent.reasons.push('inconsistent')
  }
}

/**
 * The exponent fitted from `start` to the traces without each one in turn, or undefined when a
 * refit fails or holds the exponent.
 */
function refits(
  start: InteriorLoad,
  shots: readonly ChargedTrace[],
  options: CurveFitOptions,
): number[] | undefined {
  const exponents: number[] = []
  for (let k = 0; k < shots.length; k++) {
    try {
      const fit = fitTraces(
        start,
        shots.filter((_, j) => j !== k),
        options,
        false,
      )
      const exponent = fit.parameters.find((p) => p.name === 'exponent')
      if (exponent?.status === 'fixed' || !exponent) return undefined
      exponents.push(exponent.value)
    } catch (e) {
      if (e instanceof InputError) return undefined
      throw e
    }
  }
  return exponents
}

/** Jackknife standard error of the log of a value from its leave-one-out estimates. */
function jackknife(values: readonly number[]): number {
  const logs = values.map(Math.log)
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length
  const sum = logs.reduce((a, b) => a + (b - mean) ** 2, 0)
  return Math.sqrt(((logs.length - 1) / logs.length) * sum)
}
