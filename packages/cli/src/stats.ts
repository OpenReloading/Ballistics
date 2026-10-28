/** Percentile `q` (0 to 1) of `values` by linear interpolation between the closest ranks; undefined without values. */
export function percentile(values: readonly number[], q: number): number | undefined {
  if (values.length === 0) return undefined
  const sorted = values.toSorted((a, b) => a - b)
  const rank = q * (sorted.length - 1)
  const i = Math.floor(rank)
  const low = sorted[i] as number
  return low + (rank - i) * ((sorted[i + 1] ?? low) - low)
}

/** Compare function of `toSorted` for text. */
export const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
