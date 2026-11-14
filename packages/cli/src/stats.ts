import { percentile as sortedPercentile } from '@rangefoundry/statistics'

/** Percentile `q` (0 to 1) of `values` by linear interpolation between the closest ranks; undefined without values. */
export const percentile = (values: readonly number[], q: number): number | undefined =>
  values.length === 0
    ? undefined
    : sortedPercentile(
        values.toSorted((a, b) => a - b),
        q,
      )
