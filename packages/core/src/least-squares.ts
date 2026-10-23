/**
 * Weighted least squares on log parameters by Levenberg-Marquardt with central-difference
 * Jacobians, a conditioning check and the parameter covariance, shared by truing and the powder
 * fit: `apps/docs/docs/models/least-squares.md`.
 */

import { type HuberLoss, huberCost, huberRoots } from './huber.ts'

/** Cyclic Jacobi eigen decomposition of a symmetric matrix; vectors[i][k]: entry i of vector k. */
function eigen(a: number[][]): { values: number[]; vectors: number[][] } {
  const n = a.length
  const m = a.map((r) => [...r])
  const v: number[][] = a.map((_, i) => a.map((_, j) => (i === j ? 1 : 0)))
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0
    let diag = 0
    for (let i = 0; i < n; i++) {
      diag += m[i][i] ** 2
      for (let j = i + 1; j < n; j++) off += m[i][j] ** 2
    }
    if (off <= 1e-32 * diag) break
    for (let p = 0; p < n - 1; p++)
      for (let q = p + 1; q < n; q++) {
        if (m[p][q] === 0) continue
        const theta = (m[q][q] - m[p][p]) / (2 * m[p][q])
        const t = (theta < 0 ? -1 : 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const kp = m[k][p]
          const kq = m[k][q]
          m[k][p] = c * kp - s * kq
          m[k][q] = s * kp + c * kq
        }
        for (let k = 0; k < n; k++) {
          const pk = m[p][k]
          const qk = m[q][k]
          m[p][k] = c * pk - s * qk
          m[q][k] = s * pk + c * qk
        }
        for (let k = 0; k < n; k++) {
          const kp = v[k][p]
          const kq = v[k][q]
          v[k][p] = c * kp - s * kq
          v[k][q] = s * kp + c * kq
        }
      }
  }
  return { values: m.map((r, i) => r[i]), vectors: v }
}

/** Inverse of a symmetric positive definite matrix through its eigen decomposition. */
function inverse(a: number[][]): number[][] {
  const { values, vectors } = eigen(a)
  return a.map((_, i) =>
    a.map((_, j) => values.reduce((sum, l, k) => sum + (vectors[i][k] * vectors[j][k]) / l, 0)),
  )
}

const transposeTimes = (j: number[][], b: number[][]) =>
  j[0].map((_, r) => b[0].map((_, c) => j.reduce((s, row, i) => s + row[r] * b[i][c], 0)))

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
  const d = f.map((row, i) => Math.sqrt(row[i]))
  const r = f.map((row, i) => row.map((x, k) => x / (d[i] * d[k])))
  const { values, vectors } = eigen(r)
  const top = Math.max(...values)
  const lo = values.indexOf(Math.min(...values))
  const floor = 1e-12 * top
  const singular = values[lo] <= floor
  const lambda = values.map((l) => Math.max(l, floor))
  const inv = r.map((_, a) =>
    r.map((_, b) => lambda.reduce((s, l, k) => s + (vectors[a][k] * vectors[b][k]) / l, 0)),
  )
  const unbounded = (a: number) => singular && vectors[a][lo] ** 2 > floor
  return {
    standardUncertainty: inv.map((row, a) => (unbounded(a) ? Infinity : Math.sqrt(row[a]) / d[a])),
    conditionalSigma: d.map((x) => 1 / x),
    correlation: inv.map((row, a) => row.map((x, b) => x / Math.sqrt(inv[a][a] * inv[b][b]))),
    varianceInflation: inv.map((row, a) => (unbounded(a) ? Infinity : row[a])),
    conditionNumber: singular ? Infinity : Math.sqrt(top / values[lo]),
    direction: vectors.map((row) => row[lo]),
  }
}

/** Why a fit cannot continue; passed to `LogFitInput.fail`. */
export type LogFitFailure = 'unresolved' | 'ill-conditioned' | 'unreachable' | 'not-converged'

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
      return a.map((v, i) => (v - b[i]) / (2 * step * sigma[start[run] + i]))
    })
  })
  return observed.map((_, i) => columns.map((c) => c[i]))
}

/**
 * Unresolved columns and the condition number of the column-scaled normal matrix
 * (`apps/docs/docs/models/least-squares.md`, "Conditioning check"); calls `fit.fail` on either
 * finding, else returns the condition number.
 */
function checkConditioning(fit: LogFitInput, j: number[][], at: number[]): number {
  const { floor, maxCondition, fail } = fit
  const norms = at.map((_, k) => Math.hypot(...j.map((row) => row[k])))
  const largest = Math.max(...norms)
  const unresolved = norms.flatMap((d, k) =>
    d === 0 || d < 1e-9 * largest || j.every((row, i) => Math.abs(row[k]) < floor[i]) ? [k] : [],
  )
  if (unresolved.length > 0) fail('unresolved', at, { unresolved })
  const scaled = j.map((row) => row.map((x, k) => x / norms[k]))
  const { values, vectors } = eigen(transposeTimes(scaled, scaled))
  const lo = values.indexOf(Math.min(...values))
  const condition = values[lo] > 0 ? Math.sqrt(Math.max(...values) / values[lo]) : Infinity
  if (!(condition <= maxCondition))
    fail('ill-conditioned', at, {
      conditionNumber: condition,
      direction: vectors.map((row) => row[lo]),
    })
  return condition
}

/** Covariance of the log parameters from the Jacobian at the solution, times `scale`. */
function parameterCovariance(j: number[][], scale: number): number[][] {
  return inverse(transposeTimes(j, j)).map((row) => row.map((x) => x * scale))
}

/**
 * Levenberg-Marquardt on the log parameters, starting at theta = 0
 * (`apps/docs/docs/models/least-squares.md`, "Levenberg-Marquardt step").
 */
export function logLeastSquares(fit: LogFitInput): LogFitResult {
  const { parameterCount, observed, standardUncertainty: sigma, predict, maxIterations, fail } = fit
  const n = observed.length
  const residuals = (values: readonly number[]) =>
    values.map((v, i) => (v - observed[i]) / sigma[i])
  const chi2 = (r: number[]) => r.reduce((s, x) => s + x * x, 0)
  const { huber } = fit
  const cost2 = (r: number[]) => (huber ? huberCost(r, huber) : chi2(r))
  const roots = (r: number[]) => huberRoots(r, huber)
  const scaled = (m: number[][], w: number[]) => m.map((row, i) => row.map((x) => x * w[i]))

  const { runs = [n], moves = () => true } = fit
  const start = runs.map((_, k) => runs.slice(0, k).reduce((t, c) => t + c, 0))
  const stacking = { runs, start, moves }

  let theta = Array.from({ length: parameterCount }, () => 0)
  let predicted = fit.first
  let r = residuals(predicted)
  let cost = cost2(r)
  let j = jacobian(fit, stacking, theta)
  /** Whether `j` belongs to the current `theta`. */
  let current = true
  checkConditioning(fit, j, theta)
  let lambda = lambda0
  let iterations = 0
  for (;;) {
    if (iterations >= maxIterations) {
      // a parameter that ran to where it has no effect is unresolved, not slow
      checkConditioning(fit, j, theta)
      fail('not-converged', theta)
    }
    iterations++
    const w = roots(r)
    const jw = scaled(j, w)
    const a = transposeTimes(jw, jw)
    const g = transposeTimes(
      jw,
      r.map((x, i) => [x * w[i]]),
    ).map((row) => row[0])
    const damped = a.map((row, k) => row.map((x, l) => (k === l ? x * (1 + lambda) : x)))
    const inv = inverse(damped)
    const delta = inv.map((row) => -row.reduce((s, x, l) => s + x * g[l], 0))
    const small = Math.max(...delta.map(Math.abs)) < 1e-8
    const candidate = theta.map((x, k) => x + delta[k])
    const p = small ? null : predict(candidate, theta)
    const next = p ? cost2(residuals(p)) : Infinity
    if (p && next < cost) {
      const drop = (cost - next) / cost
      theta = candidate
      predicted = p
      r = residuals(p)
      cost = next
      lambda /= 10
      current = false
      if (drop < 1e-12 || cost === 0) break
      j = jacobian(fit, stacking, theta)
      current = true
    } else if (small) break
    else lambda *= 10
  }

  if (!current) j = jacobian(fit, stacking, theta)
  const condition = checkConditioning(fit, j, theta)
  const dof = n - parameterCount
  if (!(fit.weighted || dof > 0))
    return {
      theta,
      chiSquare: chi2(r),
      loss: cost,
      predicted,
      conditionNumber: condition,
      iterations,
    }
  const scale = fit.weighted ? 1 : cost / dof
  const covariance = parameterCovariance(scaled(j, roots(r)), scale)
  return {
    theta,
    chiSquare: chi2(r),
    loss: cost,
    predicted,
    conditionNumber: condition,
    iterations,
    covariance,
    standardUncertainty: covariance.map((row, k) => Math.sqrt(row[k])),
    correlation: covariance.map((row, k) =>
      row.map((x, l) => x / Math.sqrt(covariance[k][k] * covariance[l][l])),
    ),
  }
}
