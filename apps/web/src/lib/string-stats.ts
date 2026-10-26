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
}

/** Statistics of one string over its shots without an exclusion reason; undefined when none is left. */
export function stringStats(shots: readonly StatShot[]): StringStats | undefined {
  const v = shots.filter((s) => !s.excluded).map((s) => s.velocity.value)
  if (v.length === 0) return undefined
  const mean = v.reduce((a, x) => a + x, 0) / v.length
  const sd =
    v.length > 1
      ? Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / (v.length - 1))
      : undefined
  const min = v.reduce((a, x) => Math.min(a, x), Number.POSITIVE_INFINITY)
  const max = v.reduce((a, x) => Math.max(a, x), Number.NEGATIVE_INFINITY)
  return {
    count: v.length,
    excluded: shots.length - v.length,
    mean,
    standardDeviation: sd,
    extremeSpread: max - min,
    min,
    max,
  }
}
