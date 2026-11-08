import { nth } from './errors.ts'

/** Percentile `q` (0 to 1) of ascending `sorted` by linear interpolation between the closest ranks. */
export function percentile(sorted: readonly number[], q: number): number {
  const rank = q * (sorted.length - 1)
  const i = Math.floor(rank)
  const low = nth(sorted, i)
  return low + (rank - i) * ((sorted[i + 1] ?? low) - low)
}
