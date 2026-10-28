import { type Interval, velocityStatistics } from '@open-reloading/core'

/** The part of a shot the statistics read: velocity in m/s and the reason it is excluded. */
interface StatShot {
  velocity: { value: number }
  excluded?: string | undefined
}

/** Statistics of one string of a session. */
export interface StringStats {
  /** Shots in the statistics: all but the excluded ones. */
  count: number
  excluded: number
  /** m/s. */
  mean: number
  /** Sample standard deviation (n - 1), m/s; undefined below two shots. */
  standardDeviation: number | undefined
  /** Extreme spread, max - min, m/s. */
  extremeSpread: number
  min: number
  max: number
  /** Chi-square interval of the population SD at `confidenceLevel`, m/s; undefined below three shots. */
  standardDeviationInterval: Interval | undefined
  confidenceLevel: number
}

/** Statistics of one string over its shots without an exclusion reason; undefined when none is left. */
export function stringStats(shots: readonly StatShot[]): StringStats | undefined {
  const v = shots.filter((s) => !s.excluded).map((s) => s.velocity.value)
  const st = velocityStatistics(v)
  if (!st) return undefined
  return {
    count: st.count,
    excluded: shots.length - v.length,
    mean: st.mean,
    standardDeviation: st.standardDeviation,
    extremeSpread: st.extremeSpread,
    min: st.min,
    max: st.max,
    standardDeviationInterval: st.standardDeviationInterval,
    confidenceLevel: st.confidenceLevel,
  }
}
