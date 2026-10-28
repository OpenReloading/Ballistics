/**
 * Velocity statistics of one string, `apps/docs/docs/models/groups.md`, "Velocity strings": mean,
 * sample standard deviation, extreme spread and the chi-square interval of the standard deviation
 * (the one-axis form of "Confidence intervals by shot count"), and the shot count that gives the
 * interval a stated width. Velocities in m/s.
 */
import { need } from '../errors.ts'
import { chiSquareQuantile } from './chi-square.ts'
import type { Interval } from './statistics.ts'

/** Level of the intervals when none is given. */
const defaultLevel = 0.95

/** Fewest shots with an interval of the standard deviation. */
const minimumIntervalShots = 3

/** Most shots `shotsNeeded` searches: a narrower interval is refused. */
const shotLimit = 100_000

/** Values of one string of velocities, m/s. */
export interface VelocityStatistics {
  /** Shots in the statistics. */
  count: number
  mean: number
  /** Sample standard deviation, divisor n - 1; present from 2 shots. */
  standardDeviation?: number
  /** Largest minus smallest velocity. */
  extremeSpread: number
  min: number
  max: number
  /** Two-sided level of `standardDeviationInterval`, in (0, 1). */
  confidenceLevel: number
  /** Chi-square interval of the population standard deviation; present from 3 shots, valid for normally distributed velocities. */
  standardDeviationInterval?: Interval
}

/** Limits of the interval of the standard deviation as multiples of the sample value, n >= 2 shots. */
function intervalFactors(n: number, level: number): Interval {
  const tail = (1 - level) / 2
  const nu = n - 1
  return {
    lower: Math.sqrt(nu / chiSquareQuantile(1 - tail, nu)),
    upper: Math.sqrt(nu / chiSquareQuantile(tail, nu)),
  }
}

/**
 * Statistics of the velocities of one string, m/s, finite values; `undefined` for no shot. The
 * interval of the standard deviation is sqrt((n - 1) s^2 / chi-square) at the two chi-square
 * quantiles of `level` (two-sided, in (0, 1), default 0.95).
 */
export function velocityStatistics(
  velocities: readonly number[],
  level: number = defaultLevel,
): VelocityStatistics | undefined {
  need(level > 0 && level < 1, 'confidence level must lie in (0, 1)')
  need(velocities.every(Number.isFinite), 'velocities must be finite')
  const n = velocities.length
  if (n === 0) return undefined
  const mean = velocities.reduce((a, x) => a + x, 0) / n
  const min = velocities.reduce((a, x) => Math.min(a, x), Number.POSITIVE_INFINITY)
  const max = velocities.reduce((a, x) => Math.max(a, x), Number.NEGATIVE_INFINITY)
  const out: VelocityStatistics = {
    count: n,
    mean,
    extremeSpread: max - min,
    min,
    max,
    confidenceLevel: level,
  }
  if (n < 2) return out
  const sd = Math.sqrt(velocities.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1))
  out.standardDeviation = sd
  if (n >= minimumIntervalShots) {
    const f = intervalFactors(n, level)
    out.standardDeviationInterval = { lower: f.lower * sd, upper: f.upper * sd }
  }
  return out
}

/**
 * The smallest shot count whose interval of the standard deviation has the given relative
 * half-width, (upper - lower) / 2 over the sample value, at `level` (default 0.95). The half-width
 * falls with the shot count; at least 3 shots, `relativeHalfWidth` from 0.01 up.
 */
export function shotsNeeded(relativeHalfWidth: number, level: number = defaultLevel): number {
  need(level > 0 && level < 1, 'confidence level must lie in (0, 1)')
  need(relativeHalfWidth >= 0.01, 'relative half-width must be at least 0.01')
  const narrow = (n: number) => {
    const f = intervalFactors(n, level)
    return (f.upper - f.lower) / 2 <= relativeHalfWidth
  }
  let hi = minimumIntervalShots
  while (!narrow(hi)) {
    hi *= 2
    need(hi <= shotLimit, 'relative half-width needs more shots than the search covers')
  }
  let lo = Math.max(minimumIntervalShots, hi / 2)
  // narrow(hi) holds; find the first n in (lo, hi] that holds
  if (narrow(lo)) return lo
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (narrow(mid)) hi = mid
    else lo = mid
  }
  return hi
}
