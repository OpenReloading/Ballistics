import type { StringStats } from './string-stats.ts'

/** Fewest shots in each string for a ranking by SD: below it the intervals are too wide to rank on. */
const rankingShots = 10

/**
 * How two strings compare by SD: `few` when a string lacks an interval or a ranking needs more
 * shots, `same` when the intervals overlap, else the string with the smaller SD.
 */
export type SdComparison = 'first' | 'second' | 'same' | 'few'

/** Compares the SD of two strings by their intervals. */
export function compareSd(a: StringStats, b: StringStats): SdComparison {
  const ia = a.standardDeviationInterval
  const ib = b.standardDeviationInterval
  if (!ia || !ib) return 'few'
  if (ia.lower <= ib.upper && ib.lower <= ia.upper) return 'same'
  if (a.count < rankingShots || b.count < rankingShots) return 'few'
  return ia.upper < ib.lower ? 'first' : 'second'
}
