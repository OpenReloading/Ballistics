/**
 * Dormand-Prince 5(4) integrator with error control, dense output and event location
 * (`apps/docs/docs/models/exterior-point-mass.md`, "Numerical method"; Dormand and Prince 1980; Hairer,
 * Norsett and Wanner 1993, sections II.4 to II.6). Generic over the state length.
 */
import { InputError, nth } from '../errors.ts'

/** Unchecked read of a state vector the caller sizes and indexes by the same count (kept in this module so the integrator loops inline it). */
const el = (a: Float64Array, i: number): number => a[i] as number

/** Right-hand side: writes dy/dt at (t, y) into `dy`. */
export type Rhs = (t: number, y: Float64Array, dy: Float64Array) => void

/** A scalar event function; its roots are located on the dense output. */
export interface Rk45Event {
  /** Event function of time and state; an event occurs where it changes sign. */
  eventFunction: (t: number, y: Float64Array) => number
  /** 1: only rising crossings, -1: only falling, 0: both. */
  direction: -1 | 0 | 1
  /** A terminal event ends the call at its root; others are recorded and the run continues. */
  terminal: boolean
}

/** Tolerances, limits and starting values of one `rk45` call. */
export interface Rk45Options {
  /** Relative error tolerance of the step control. */
  relativeTolerance: number
  /** Absolute error tolerance of the step control, in units of the state. */
  absoluteTolerance: number
  /** Accepted plus rejected steps before the call fails, counting `stepsBefore`. */
  maxSteps: number
  /** Steps already taken by earlier calls of the same run; default 0. */
  stepsBefore?: number | undefined
  /** Shared by several calls: each step adds 1 to `used`; a call fails once `used` is `max`. */
  budget?: StepBudget | undefined
  /** The call ends at this time (s) when no terminal event comes first. */
  maxTime: number
  /** First step size, s; estimated when absent. */
  initialStep?: number | undefined
}

/** Step count shared by several `rk45` calls of one run. */
export interface StepBudget {
  /** Steps taken so far, accepted and rejected. */
  used: number
  /** Steps allowed in total. */
  max: number
}

/** A non-terminal event root. */
export interface Rk45Hit {
  /** Index of the event in the `events` argument. */
  event: number
  /** Time of the root, s. */
  t: number
  /** State at the root, from the dense output. */
  y: Float64Array
}

/** End of an `rk45` call. */
export interface Rk45Result {
  /** End time, s: the terminal event root or `maxTime`. */
  t: number
  /** State at `t`. */
  y: Float64Array
  /** Index of the terminal event that ended the call, or null at `maxTime`. */
  event: number | null
  /** Non-terminal event roots before the end, in time order. */
  hits: Rk45Hit[]
  /** Accepted plus rejected steps of this call. */
  steps: number
  /** Step size to continue with, s. */
  h: number
}

/** Smallest step before the call fails, s. */
const minStep = 1e-12

const c2 = 1 / 5
const c3 = 3 / 10
const c4 = 4 / 5
const c5 = 8 / 9
const a21 = 1 / 5
const a31 = 3 / 40
const a32 = 9 / 40
const a41 = 44 / 45
const a42 = -56 / 15
const a43 = 32 / 9
const a51 = 19372 / 6561
const a52 = -25360 / 2187
const a53 = 64448 / 6561
const a54 = -212 / 729
const a61 = 9017 / 3168
const a62 = -355 / 33
const a63 = 46732 / 5247
const a64 = 49 / 176
const a65 = -5103 / 18656
const a71 = 35 / 384
const a73 = 500 / 1113
const a74 = 125 / 192
const a75 = -2187 / 6784
const a76 = 11 / 84
// fifth-order weights minus the embedded fourth-order weights
const e1 = 71 / 57600
const e3 = -71 / 16695
const e4 = 71 / 1920
const e5 = -17253 / 339200
const e6 = 22 / 525
const e7 = -1 / 40
// continuous extension (Shampine 1986, in the form of Hairer, Norsett and Wanner 1993)
const d1 = -12715105075 / 11282082432
const d3 = 87487479700 / 32700410799
const d4 = -10690763975 / 1880347072
const d5 = 701980252875 / 199316789632
const d6 = -1453857185 / 822651844
const d7 = 69997945 / 29380423

function crosses(g0: number, g1: number, direction: -1 | 0 | 1): boolean {
  const rising = g0 < 0 && g1 >= 0
  const falling = g0 > 0 && g1 <= 0
  return direction > 0 ? rising : direction < 0 ? falling : rising || falling
}

/**
 * Root of f on [0, 1] with f(0) = f0 and f(1) = f1 on opposite sides (Illinois method); returns
 * a point on the side of f1, so the state there has crossed.
 */
function root(f: (x: number) => number, f0: number, f1: number, tol: number): number {
  if (f1 === 0) return 1
  let lo = 0
  let hi = 1
  let flo = f0
  let fhi = f1
  let last = 0
  for (let i = 0; i < 200 && hi - lo > tol; i++) {
    const x = Math.min(hi, Math.max(lo, (lo * fhi - hi * flo) / (fhi - flo)))
    const fx = f(x)
    if (fx === 0) return x
    if (fx > 0 === f1 > 0) {
      hi = x
      fhi = fx
      if (last === 1) flo /= 2
      last = 1
    } else {
      lo = x
      flo = fx
      if (last === -1) fhi /= 2
      last = -1
    }
  }
  return hi
}

/** Root mean square of v(0) to v(n - 1). */
function rms(n: number, v: (i: number) => number): number {
  let s = 0
  for (let i = 0; i < n; i++) s += v(i) ** 2
  return Math.sqrt(s / n)
}

/** Work arrays of one `rk45` call: stage derivatives, a stage state and the dense output coefficients. */
interface Work {
  n: number
  /** f at the start of the step; swapped with `k7` after an accepted step (first same as last). */
  k1: Float64Array
  k2: Float64Array
  k3: Float64Array
  k4: Float64Array
  k5: Float64Array
  k6: Float64Array
  /** f at the end of the step. */
  k7: Float64Array
  tmp: Float64Array
  r2: Float64Array
  r3: Float64Array
  r4: Float64Array
  r5: Float64Array
}

/**
 * One Dormand-Prince step of size h from (t, y) with `work.k1` = f(t, y); writes the fifth-order
 * state into `out`, f there into `work.k7`, and returns the error norm.
 */
function dormandPrinceStep(
  f: Rhs,
  work: Work,
  t: number,
  y: Float64Array,
  h: number,
  out: Float64Array,
  relativeTolerance: number,
  absoluteTolerance: number,
): number {
  const { n, k1, k2, k3, k4, k5, k6, k7, tmp } = work
  for (let i = 0; i < n; i++) tmp[i] = el(y, i) + h * a21 * el(k1, i)
  f(t + c2 * h, tmp, k2)
  for (let i = 0; i < n; i++) tmp[i] = el(y, i) + h * (a31 * el(k1, i) + a32 * el(k2, i))
  f(t + c3 * h, tmp, k3)
  for (let i = 0; i < n; i++)
    tmp[i] = el(y, i) + h * (a41 * el(k1, i) + a42 * el(k2, i) + a43 * el(k3, i))
  f(t + c4 * h, tmp, k4)
  for (let i = 0; i < n; i++)
    tmp[i] = el(y, i) + h * (a51 * el(k1, i) + a52 * el(k2, i) + a53 * el(k3, i) + a54 * el(k4, i))
  f(t + c5 * h, tmp, k5)
  for (let i = 0; i < n; i++)
    tmp[i] =
      el(y, i) +
      h * (a61 * el(k1, i) + a62 * el(k2, i) + a63 * el(k3, i) + a64 * el(k4, i) + a65 * el(k5, i))
  f(t + h, tmp, k6)
  for (let i = 0; i < n; i++)
    out[i] =
      el(y, i) +
      h * (a71 * el(k1, i) + a73 * el(k3, i) + a74 * el(k4, i) + a75 * el(k5, i) + a76 * el(k6, i))
  f(t + h, out, k7)
  return rms(n, (i) => {
    const err =
      h *
      (e1 * el(k1, i) +
        e3 * el(k3, i) +
        e4 * el(k4, i) +
        e5 * el(k5, i) +
        e6 * el(k6, i) +
        e7 * el(k7, i))
    return (
      err /
      (absoluteTolerance + relativeTolerance * Math.max(Math.abs(el(y, i)), Math.abs(el(out, i))))
    )
  })
}

/** Starting step size at (t, y), s (Hairer, Norsett and Wanner 1993, section II.4); uses `work.k2`. */
function startingStep(
  f: Rhs,
  work: Work,
  t: number,
  y: Float64Array,
  relativeTolerance: number,
  absoluteTolerance: number,
): number {
  const { n, k1, k2, tmp } = work
  const sc = (i: number) => absoluteTolerance + relativeTolerance * Math.abs(el(y, i))
  const dy0 = rms(n, (i) => el(y, i) / sc(i))
  const df0 = rms(n, (i) => el(k1, i) / sc(i))
  const h0 = dy0 < 1e-5 || df0 < 1e-5 ? 1e-6 : (0.01 * dy0) / df0
  for (let i = 0; i < n; i++) tmp[i] = el(y, i) + h0 * el(k1, i)
  f(t + h0, tmp, k2)
  const d2 = rms(n, (i) => (el(k2, i) - el(k1, i)) / sc(i)) / h0
  const dmax = Math.max(df0, d2)
  return Math.min(100 * h0, dmax <= 1e-15 ? Math.max(1e-6, h0 * 1e-3) : (0.01 / dmax) ** 0.2)
}

/** Dense output of the step of size h from y to ynew: the state at the step fraction s. */
function denseOutput(
  work: Work,
  y: Float64Array,
  ynew: Float64Array,
  h: number,
): (s: number) => Float64Array {
  const { n, k1, k3, k4, k5, k6, k7, r2, r3, r4, r5 } = work
  for (let i = 0; i < n; i++) {
    r2[i] = el(ynew, i) - el(y, i)
    r3[i] = h * el(k1, i) - el(r2, i)
    r4[i] = el(r2, i) - h * el(k7, i) - el(r3, i)
    r5[i] =
      h *
      (d1 * el(k1, i) +
        d3 * el(k3, i) +
        d4 * el(k4, i) +
        d5 * el(k5, i) +
        d6 * el(k6, i) +
        d7 * el(k7, i))
  }
  return (s: number): Float64Array => {
    const out = new Float64Array(n)
    for (let i = 0; i < n; i++)
      out[i] =
        el(y, i) + s * (el(r2, i) + (1 - s) * (el(r3, i) + s * (el(r4, i) + (1 - s) * el(r5, i))))
    return out
  }
}

/**
 * Roots of the `crossed` events on the step of size h from t; appends the non-terminal roots before
 * the first terminal root to `hits` in time order and returns that terminal root as a step fraction.
 */
function locateEvents(
  events: readonly Rk45Event[],
  crossed: readonly number[],
  gPrev: readonly number[],
  gNew: readonly number[],
  t: number,
  h: number,
  dense: (s: number) => Float64Array,
  hits: Rk45Hit[],
): { i: number; s: number } | null {
  const tol = minStep / h
  const roots = crossed.map((i) => {
    const { eventFunction } = nth(events, i)
    const s = root((x) => eventFunction(t + x * h, dense(x)), nth(gPrev, i), nth(gNew, i), tol)
    return { i, s }
  })
  let stop: { i: number; s: number } | null = null
  for (const r of roots) if (nth(events, r.i).terminal && (!stop || r.s < stop.s)) stop = r
  for (const r of roots.sort((p, q) => p.s - q.s)) {
    if (nth(events, r.i).terminal || (stop && r.s > stop.s)) continue
    hits.push({ event: r.i, t: t + r.s * h, y: dense(r.s) })
  }
  return stop
}

/** The scratch vectors of one integration, `n` states long. */
function makeWork(n: number): Work {
  const make = () => new Float64Array(n)
  return {
    n,
    k1: make(),
    k2: make(),
    k3: make(),
    k4: make(),
    k5: make(),
    k6: make(),
    k7: make(),
    tmp: make(),
    r2: make(),
    r3: make(),
    r4: make(),
    r5: make(),
  }
}

/** Throws `InputError` when the steps taken, or the shared budget, reach their limit. */
function checkStepLimits(steps: number, options: Rk45Options) {
  const { maxSteps, budget } = options
  if (steps + (options.stepsBefore ?? 0) >= maxSteps)
    throw new InputError(`more than ${maxSteps} integration steps`)
  if (budget && budget.used >= budget.max)
    throw new InputError(`more than ${budget.max} integration steps in total`)
}

/** The events whose function changed sign over the step, in the direction they watch. */
function crossedEvents(events: readonly Rk45Event[], gPrev: number[], gNew: number[]) {
  const crossed: number[] = []
  for (const [i, event] of events.entries())
    if (crosses(nth(gPrev, i), nth(gNew, i), event.direction)) crossed.push(i)
  return crossed
}

/** The fifth-order state at an event `hs` into the step from `y` at `t`. */
function reStepToEvent(
  f: Rhs,
  work: Work,
  t: number,
  y: Float64Array,
  hs: number,
  options: Rk45Options,
) {
  const out = new Float64Array(work.n)
  if (hs > 0)
    dormandPrinceStep(f, work, t, y, hs, out, options.relativeTolerance, options.absoluteTolerance)
  else out.set(y)
  return out
}

/** Step factor after a rejected step of scaled error `err`. */
function shrinkFactor(err: number) {
  return Number.isFinite(err) ? Math.max(0.2, 0.9 * err ** -0.2) : 0.2
}

/** Step factor after an accepted step, at most 1 right after a rejection. */
function growFactor(err: number, rejected: boolean) {
  return Math.min(rejected ? 1 : 5, Math.max(0.2, err === 0 ? 5 : 0.9 * err ** -0.2))
}

/** The step size `h`, or `InputError` when it is below `minStep`. */
function checkMinStep(h: number) {
  if (h < minStep) throw new InputError(`step size ${h} s below ${minStep} s`)
  return h
}

/** The step size to start with: the given one, or the automatic choice when none is positive. */
function firstStep(f: Rhs, work: Work, t: number, y: Float64Array, options: Rk45Options) {
  const given = options.initialStep ?? 0
  if (given > 0) return given
  return startingStep(f, work, t, y, options.relativeTolerance, options.absoluteTolerance)
}

/** Integrates y' = f(t, y) from t0 until a terminal event or `maxTime`. */
export function rk45(
  f: Rhs,
  t0: number,
  y0: Float64Array,
  events: readonly Rk45Event[],
  options: Rk45Options,
): Rk45Result {
  const { relativeTolerance, absoluteTolerance, maxTime, budget } = options
  const n = y0.length
  const make = () => new Float64Array(n)
  let y = Float64Array.from(y0)
  const work = makeWork(n)
  let ynew = make()
  let t = t0
  f(t, y, work.k1)

  let h = firstStep(f, work, t, y, options)

  let gPrev = events.map((e) => e.eventFunction(t, y))
  const hits: Rk45Hit[] = []
  let steps = 0
  let rejected = false

  while (t < maxTime) {
    checkStepLimits(steps, options)
    const clipped = h >= maxTime - t
    h = clipped ? maxTime - t : checkMinStep(h)
    const err = dormandPrinceStep(f, work, t, y, h, ynew, relativeTolerance, absoluteTolerance)
    steps++
    if (budget) budget.used++
    if (!(err <= 1)) {
      h *= shrinkFactor(err)
      rejected = true
      continue
    }
    const t1 = clipped ? maxTime : t + h
    const gNew = events.map((e) => e.eventFunction(t1, ynew))

    const crossed = crossedEvents(events, gPrev, gNew)
    if (crossed.length > 0) {
      const dense = denseOutput(work, y, ynew, h)
      const stop = locateEvents(events, crossed, gPrev, gNew, t, h, dense, hits)
      if (stop) {
        const out = reStepToEvent(f, work, t, y, h * stop.s, options)
        return { t: t + h * stop.s, y: out, event: stop.i, hits, steps, h }
      }
    }

    const swap = y
    y = ynew
    ynew = swap
    const k = work.k1
    work.k1 = work.k7
    work.k7 = k
    t = t1
    gPrev = gNew
    h *= growFactor(err, rejected)
    rejected = false
  }
  return { t, y, event: null, hits, steps, h }
}
