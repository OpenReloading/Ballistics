/**
 * Weighted least squares on log parameters by Levenberg-Marquardt with central-difference
 * Jacobians, a conditioning check and the parameter covariance: `apps/docs/docs/models/least-squares.md`.
 */

import { nth } from './errors.ts'
import { type HuberLoss, huberCost, huberRoots } from './huber.ts'

/** Whether the off-diagonal part of `m` is negligible against its diagonal. */
function isDiagonal(m: number[][]): boolean {
  const n = m.length
  let off = 0
  let diag = 0
  for (let i = 0; i < n; i++) {
    const row = nth(m, i)
    diag += nth(row, i) ** 2
    for (let j = i + 1; j < n; j++) off += nth(row, j) ** 2
  }
  return off <= 1e-32 * diag
}

/** One Jacobi rotation of `m` that zeroes entry (p, q), accumulated into the vectors `v`. */
function rotate(m: number[][], v: number[][], p: number, q: number) {
  const n = m.length
  const mp = nth(m, p)
  const mq = nth(m, q)
  const theta = (nth(mq, q) - nth(mp, p)) / (2 * nth(mp, q))
  const t = (theta < 0 ? -1 : 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
  const c = 1 / Math.sqrt(t * t + 1)
  const s = t * c
  for (const mk of m) {
    const kp = nth(mk, p)
    const kq = nth(mk, q)
    mk[p] = c * kp - s * kq
    mk[q] = s * kp + c * kq
  }
  for (let k = 0; k < n; k++) {
    const pk = nth(mp, k)
    const qk = nth(mq, k)
    mp[k] = c * pk - s * qk
    mq[k] = s * pk + c * qk
  }
  for (const vk of v) {
    const kp = nth(vk, p)
    const kq = nth(vk, q)
    vk[p] = c * kp - s * kq
    vk[q] = s * kp + c * kq
  }
}

/** One cyclic Jacobi sweep: a rotation for each nonzero entry above the diagonal of `m`. */
function jacobiSweep(m: number[][], v: number[][]) {
  const n = m.length
  for (let p = 0; p < n - 1; p++)
    for (let q = p + 1; q < n; q++) if (nth(nth(m, p), q) !== 0) rotate(m, v, p, q)
}

/** Cyclic Jacobi eigen decomposition of a symmetric matrix; vectors[i][k]: entry i of vector k. */
function eigen(a: number[][]): { values: number[]; vectors: number[][] } {
  const m = a.map((r) => [...r])
  const v: number[][] = a.map((row, i) => row.map((_x, j) => (i === j ? 1 : 0)))
  for (let sweep = 0; sweep < 100; sweep++) {
    if (isDiagonal(m)) break
    jacobiSweep(m, v)
  }
  return { values: m.map((r, i) => nth(r, i)), vectors: v }
}

/** Inverse of a symmetric positive definite matrix through its eigen decomposition. */
function inverse(a: number[][]): number[][] {
  const { values, vectors } = eigen(a)
  return vectors.map((vi) =>
    vectors.map((vj) => values.reduce((sum, l, k) => sum + (nth(vi, k) * nth(vj, k)) / l, 0)),
  )
}

const transposeTimes = (j: number[][], b: number[][]) =>
  nth(j, 0).map((_row, r) =>
    nth(b, 0).map((_column, c) => j.reduce((s, row, i) => s + nth(row, r) * nth(nth(b, i), c), 0)),
  )

/** Parameter uncertainty and collinearity measures of a weighted Jacobian. */
export interface Identifiability {
  /** Standard errors of the parameters with all others free, per unit parameter; Infinity for a parameter in the null direction of a singular design. */
  standardUncertainty: number[]
  /** Standard errors with all other parameters known: 1 over the column norm. */
  conditionalSigma: number[]
  /** Correlation matrix of the parameters. */
  correlation: number[][]
  /** Variance inflation factors: `standardUncertainty` squared over `conditionalSigma` squared; Infinity where `standardUncertainty` is. */
  varianceInflation: number[]
  /** Condition number of the column-scaled information, as in the fit; Infinity when singular. */
  conditionNumber: number
  /** Eigenvector of the smallest eigenvalue of the column-scaled information. */
  direction: number[]
}

/**
 * Covariance, collinearity and conditioning of the parameters from a weighted Jacobian (rows:
 * observations, columns: parameters, none of them zero),
 * `apps/docs/docs/models/least-squares.md`, "Identifiability of a weighted Jacobian". The design is singular when the smallest eigenvalue of the column-scaled information
 * is at most 1e-12 of the largest. The eigenvalues are floored at that value for the correlations,
 * which stay finite; a parameter whose share of the null direction would then raise its variance
 * inflation above 1 (squared component above 1e-12 of the largest eigenvalue) gets Infinity for
 * `standardUncertainty` and `varianceInflation`, and the condition number is Infinity.
 */
export function identifiability(j: number[][]): Identifiability {
  const f = transposeTimes(j, j)
  const d = f.map((row, i) => Math.sqrt(nth(row, i)))
  const r = f.map((row, i) => row.map((x, k) => x / (nth(d, i) * nth(d, k))))
  const { values, vectors } = eigen(r)
  const top = Math.max(...values)
  // NaN eigenvalues make this -1: reads at it are NaN, as the fit treats them
  const lo = values.indexOf(Math.min(...values))
  const floor = 1e-12 * top
  const singular = (values[lo] ?? Number.NaN) <= floor
  const lambda = values.map((l) => Math.max(l, floor))
  const inv = r.map((_row, a) =>
    r.map((_column, b) =>
      lambda.reduce((s, l, k) => s + (nth(nth(vectors, a), k) * nth(nth(vectors, b), k)) / l, 0),
    ),
  )
  const unbounded = (a: number) => singular && (nth(vectors, a)[lo] ?? Number.NaN) ** 2 > floor
  return {
    standardUncertainty: inv.map((row, a) =>
      unbounded(a) ? Infinity : Math.sqrt(nth(row, a)) / nth(d, a),
    ),
    conditionalSigma: d.map((x) => 1 / x),
    correlation: inv.map((row, a) =>
      row.map((x, b) => x / Math.sqrt(nth(nth(inv, a), a) * nth(nth(inv, b), b))),
    ),
    varianceInflation: inv.map((row, a) => (unbounded(a) ? Infinity : nth(row, a))),
    conditionNumber: singular ? Infinity : Math.sqrt(top / (values[lo] ?? Number.NaN)),
    direction: vectors.map((row) => row[lo] ?? Number.NaN),
  }
}

/** Why a fit cannot continue; passed to `LogFitInput.fail`. */
export type LogFitFailure = 'unresolved' | 'ill-conditioned' | 'unreachable' | 'not-converged'

/**
 * The rule that ended a fit: `stalled` for an accepted step whose cost fell by less than the
 * tolerance (or to 0), `smallStep` for a step below 1e-8 in every log parameter.
 */
export type LogFitStop = 'stalled' | 'smallStep'

/** Inputs of `logLeastSquares`. */
export interface LogFitInput {
  /** Parameter count. */
  parameterCount: number
  /** Observed values. */
  observed: readonly number[]
  /** Standard deviation of each observation, in the unit of `observed`; 1 where unweighted. */
  standardUncertainty: readonly number[]
  /** Whether every observation has its own standard uncertainty; otherwise the covariance is scaled. */
  weighted: boolean
  /** Per observation: weighted Jacobian entries below it are noise, per unit log parameter. */
  floor: readonly number[]
  /** Predicted values at theta = 0, from the caller's own first evaluation. */
  first: readonly number[]
  /**
   * Predicted values at `trial`, or null for a rejected candidate; `current` is the accepted
   * iterate. With `run`, only that run's values; otherwise all runs stacked.
   */
  predict: (trial: number[], current: number[], run?: number) => readonly number[] | null
  /** Observation count of each run in stacking order; one run of all observations when absent. */
  runs?: readonly number[]
  /** Whether parameter `j` moves run `run`'s predictions; its Jacobian entries elsewhere are 0. */
  moves?: (j: number, run: number) => boolean
  /**
   * Huber loss on the first `count` observations (the rest stay quadratic): residuals beyond
   * `threshold` sigmas count linearly, `apps/docs/docs/models/least-squares.md`, "Huber loss".
   * Needs `weighted`.
   */
  huber?: HuberLoss
  /** Iterations before the fit fails with `'not-converged'`. */
  maxIterations: number
  /** Largest condition number of the column-scaled Jacobian before `'ill-conditioned'`. */
  maxCondition: number
  /** Relative decrease of the cost below which an accepted step ends the fit; default 1e-12. */
  tolerance?: number
  /** Throws the caller's error for a failure at log parameters `theta`. */
  fail: (
    reason: LogFitFailure,
    theta: number[],
    extra?: { conditionNumber?: number; unresolved?: number[]; direction?: number[] },
  ) => never
}

/** Solution of `logLeastSquares`. */
export interface LogFitResult {
  /** Log parameters at the solution. */
  theta: number[]
  /** Sum of squared weighted residuals at the solution, whatever the loss. */
  chiSquare: number
  /** The minimized cost: `chiSquare`, or with `huber` the sum of the Huber losses. */
  loss: number
  /** Predicted values at the solution: the last accepted candidate's, or `first` without one. */
  predicted: readonly number[]
  /** Condition number of the column-scaled Jacobian at the solution. */
  conditionNumber: number
  /** Iterations taken. */
  iterations: number
  /** The rule that ended the loop. */
  stop: LogFitStop
  /**
   * Whether the set of down-weighted rows (residual beyond the Huber threshold) was the same
   * before and after the last accepted step; true without `huber` and without an accepted step.
   */
  weightsSettled: boolean
  /** Covariance of theta; absent with n = p and no standard uncertainties. */
  covariance?: number[][]
  /** Square roots of the covariance diagonal of theta; absent like `covariance`. */
  standardUncertainty?: number[]
  /** Correlation matrix of theta; absent like `standardUncertainty`. */
  correlation?: number[][]
}

const lambda0 = 1e-3
/** Central-difference step in the log parameters. */
const step = 1e-3

/** Observation count of each run, the index of its first observation, and which parameters move it. */
interface Stacking {
  runs: readonly number[]
  start: readonly number[]
  moves: (j: number, run: number) => boolean
}

/** Weighted Jacobian at the log parameters `at` by central differences; rows: observations. */
function jacobian(fit: LogFitInput, stacking: Stacking, at: number[]): number[][] {
  const { observed, standardUncertainty: sigma, predict, fail } = fit
  const { runs, start, moves } = stacking
  const columns = at.map((_, j) => {
    const up = at.map((x, k) => (k === j ? x + step : x))
    const down = at.map((x, k) => (k === j ? x - step : x))
    return runs.flatMap((count, run) => {
      if (!moves(j, run)) return Array.from({ length: count }, () => 0)
      const a = predict(up, at, run)
      const b = predict(down, at, run)
      if (!a || !b) return fail('unreachable', at)
      return a.map((v, i) => (v - nth(b, i)) / (2 * step * nth(sigma, nth(start, run) + i)))
    })
  })
  return observed.map((_, i) => columns.map((c) => nth(c, i)))
}

/**
 * Unresolved columns and the condition number of the column-scaled normal matrix
 * (`apps/docs/docs/models/least-squares.md`, "Conditioning check"); calls `fit.fail` on either
 * finding, else returns the condition number.
 */
function checkConditioning(fit: LogFitInput, j: number[][], at: number[]): number {
  const { floor, maxCondition, fail } = fit
  const norms = at.map((_, k) => Math.hypot(...j.map((row) => nth(row, k))))
  const largest = Math.max(...norms)
  const unresolved = norms.flatMap((d, k) =>
    d === 0 || d < 1e-9 * largest || j.every((row, i) => Math.abs(nth(row, k)) < nth(floor, i))
      ? [k]
      : [],
  )
  if (unresolved.length > 0) fail('unresolved', at, { unresolved })
  const scaled = j.map((row) => row.map((x, k) => x / nth(norms, k)))
  const { values, vectors } = eigen(transposeTimes(scaled, scaled))
  // NaN eigenvalues make this -1: reads at it are NaN, as the fit treats them
  const lo = values.indexOf(Math.min(...values))
  const smallest = values[lo] ?? Number.NaN
  const condition = smallest > 0 ? Math.sqrt(Math.max(...values) / smallest) : Infinity
  if (!(condition <= maxCondition))
    fail('ill-conditioned', at, {
      conditionNumber: condition,
      direction: vectors.map((row) => row[lo] ?? Number.NaN),
    })
  return condition
}

/** Covariance of the log parameters from the Jacobian at the solution, times `scale`. */
function parameterCovariance(j: number[][], scale: number): number[][] {
  return inverse(transposeTimes(j, j)).map((row) => row.map((x) => x * scale))
}

const scaled = (m: number[][], w: number[]) => m.map((row, i) => row.map((x) => x * nth(w, i)))

/** The Levenberg-Marquardt step from the Jacobian `j`, residuals `r` with root weights `w`, damped by `lambda`. */
function levenbergMarquardtStep(j: number[][], r: number[], w: number[], lambda: number) {
  const jw = scaled(j, w)
  const a = transposeTimes(jw, jw)
  const g = transposeTimes(
    jw,
    r.map((x, i) => [x * nth(w, i)]),
  ).map((row) => nth(row, 0))
  const damped = a.map((row, k) => row.map((x, l) => (k === l ? x * (1 + lambda) : x)))
  const inv = inverse(damped)
  return inv.map((row) => -row.reduce((s, x, l) => s + x * nth(g, l), 0))
}

/** The covariance of a fit with its standard errors and correlations. */
function covarianceSummary(covariance: number[][]) {
  return {
    covariance,
    standardUncertainty: covariance.map((row, k) => Math.sqrt(nth(row, k))),
    correlation: covariance.map((row, k) =>
      row.map((x, l) => x / Math.sqrt(nth(nth(covariance, k), k) * nth(nth(covariance, l), l))),
    ),
  }
}

/** Fails with `not-converged` once `iterations` reaches the limit. */
function checkIterations(fit: LogFitInput, iterations: number, j: number[][], theta: number[]) {
  if (iterations < fit.maxIterations) return
  // a parameter that ran to where it has no effect is unresolved, not slow
  checkConditioning(fit, j, theta)
  fit.fail('not-converged', theta)
}

/** Whether an accepted step from cost `cost` to `next` is too small to continue. */
const stalled = (cost: number, next: number, tolerance: number) =>
  (cost - next) / cost < tolerance || next === 0

/** The covariance, standard errors and correlations at the solution; none without residual degrees of freedom. */
function covarianceOf(fit: LogFitInput, jw: number[][], cost: number, dof: number) {
  if (!(fit.weighted || dof > 0)) return {}
  return covarianceSummary(parameterCovariance(jw, fit.weighted ? 1 : cost / dof))
}

/** The chi-square of weighted residuals: the sum of their squares. */
const chiSquareOf = (r: number[]) => r.reduce((s, x) => s + x * x, 0)

/** What the iteration reads of a fit: its stacking, weighted residuals, cost and root weights. */
interface Model {
  fit: LogFitInput
  stacking: Stacking
  residuals: (values: readonly number[]) => number[]
  cost: (r: number[]) => number
  roots: (r: number[]) => number[]
}

function modelOf(fit: LogFitInput): Model {
  const { observed, standardUncertainty: sigma, huber } = fit
  const { runs = [observed.length], moves = () => true } = fit
  const start = runs.map((_count, k) => runs.slice(0, k).reduce((t, c) => t + c, 0))
  return {
    fit,
    stacking: { runs, start, moves },
    residuals: (values) => values.map((v, i) => (v - nth(observed, i)) / nth(sigma, i)),
    cost: (r) => (huber ? huberCost(r, huber) : chiSquareOf(r)),
    roots: (r) => huberRoots(r, huber),
  }
}

/** Where the iteration stands: parameters, prediction, residuals, cost, Jacobian and damping. */
interface State {
  theta: number[]
  predicted: readonly number[]
  r: number[]
  cost: number
  j: number[][]
  /** Whether `j` belongs to the current `theta`. */
  current: boolean
  lambda: number
  iterations: number
  weightsSettled: boolean
}

/** The start at theta = 0, after the conditioning check of its Jacobian. */
function startState(m: Model): State {
  const theta = Array.from({ length: m.fit.parameterCount }, () => 0)
  const r = m.residuals(m.fit.first)
  const cost = m.cost(r)
  const j = jacobian(m.fit, m.stacking, theta)
  checkConditioning(m.fit, j, theta)
  const iteration = { current: true, lambda: lambda0, iterations: 0, weightsSettled: true }
  return { theta, predicted: m.fit.first, r, cost, j, ...iteration }
}

/** Whether the Huber loss treats the same rows as outliers in `a` and `b`. */
function sameRows(m: Model, a: number[], b: number[]) {
  const wb = m.roots(b)
  return m.roots(a).every((w, i) => w < 1 === nth(wb, i) < 1)
}

/**
 * Moves to the `accepted` parameters, prediction and cost and lowers the damping; `stalled`
 * when the cost fell by less than `tolerance` of itself, else the Jacobian there.
 */
function acceptStep(
  m: Model,
  s: State,
  accepted: { theta: number[]; predicted: readonly number[]; cost: number },
  tolerance: number,
): LogFitStop | undefined {
  const before = s.r
  s.theta = accepted.theta
  s.predicted = accepted.predicted
  s.r = m.residuals(accepted.predicted)
  s.weightsSettled = sameRows(m, before, s.r)
  s.lambda /= 10
  s.current = false
  const done = stalled(s.cost, accepted.cost, tolerance)
  s.cost = accepted.cost
  if (done) return 'stalled'
  s.j = jacobian(m.fit, m.stacking, s.theta)
  s.current = true
  return undefined
}

/** One Levenberg-Marquardt iteration: a step that lowers the cost is taken, else the damping grows. */
function iterate(m: Model, s: State, tolerance: number): LogFitStop | undefined {
  checkIterations(m.fit, s.iterations, s.j, s.theta)
  s.iterations++
  const delta = levenbergMarquardtStep(s.j, s.r, m.roots(s.r), s.lambda)
  const small = Math.max(...delta.map(Math.abs)) < 1e-8
  const candidate = s.theta.map((x, k) => x + nth(delta, k))
  const p = small ? null : m.fit.predict(candidate, s.theta)
  const next = p ? m.cost(m.residuals(p)) : Infinity
  if (p && next < s.cost)
    return acceptStep(m, s, { theta: candidate, predicted: p, cost: next }, tolerance)
  if (small) return 'smallStep'
  s.lambda *= 10
  return undefined
}

/**
 * Levenberg-Marquardt on the log parameters, starting at theta = 0
 * (`apps/docs/docs/models/least-squares.md`, "Levenberg-Marquardt step").
 */
export function logLeastSquares(fit: LogFitInput): LogFitResult {
  const m = modelOf(fit)
  const s = startState(m)
  const tolerance = fit.tolerance ?? 1e-12
  let stop: LogFitStop | undefined
  while (stop === undefined) stop = iterate(m, s, tolerance)
  if (!s.current) s.j = jacobian(fit, m.stacking, s.theta)
  const condition = checkConditioning(fit, s.j, s.theta)
  return {
    theta: s.theta,
    chiSquare: chiSquareOf(s.r),
    loss: s.cost,
    predicted: s.predicted,
    conditionNumber: condition,
    iterations: s.iterations,
    stop,
    weightsSettled: s.weightsSettled,
    ...covarianceOf(
      fit,
      scaled(s.j, m.roots(s.r)),
      s.cost,
      fit.observed.length - fit.parameterCount,
    ),
  }
}
