/**
 * Expected extreme spread of a group against its shot count, from a seeded simulation of circular
 * normal groups (`tools/research/group-extreme-spread-per-shot-count.ts`, 1 000 000 groups per
 * shot count). Lengths are in units of the standard deviation on each axis.
 */
import { need } from '../errors.ts'

/** Mean and 5th and 95th percentile of the extreme spread of one group, in units of sigma. */
export interface ExpectedExtremeSpread {
  mean: number
  /** 5th percentile of one group. */
  low: number
  /** 95th percentile of one group. */
  high: number
}

/** Mean, 5th and 95th percentile for 2 to 20 shots. */
const TABLE: readonly (readonly [number, number, number])[] = [
  [1.77, 0.45, 3.46],
  [2.408, 1.07, 3.99],
  [2.792, 1.49, 4.3],
  [3.066, 1.8, 4.51],
  [3.277, 2.05, 4.68],
  [3.444, 2.25, 4.81],
  [3.585, 2.41, 4.93],
  [3.706, 2.56, 5.02],
  [3.812, 2.68, 5.11],
  [3.904, 2.79, 5.18],
  [3.988, 2.89, 5.25],
  [4.064, 2.98, 5.31],
  [4.134, 3.06, 5.37],
  [4.197, 3.14, 5.42],
  [4.255, 3.21, 5.46],
  [4.309, 3.27, 5.51],
  [4.36, 3.33, 5.55],
  [4.407, 3.38, 5.59],
  [4.452, 3.44, 5.63],
]

/**
 * The mean extreme spread of a group of `n` shots (2 to 20) from a circular normal population
 * with standard deviation 1 on each axis, and the range that holds 90 % of single groups. Multiply
 * by the standard deviation to get a length. The ratio of two means compares groups of different
 * shot counts.
 */
export function expectedExtremeSpread(n: number): ExpectedExtremeSpread {
  need(Number.isInteger(n) && n >= 2 && n <= 20, 'shot count must be a whole number from 2 to 20')
  const [mean, low, high] = TABLE[n - 2] as readonly [number, number, number] // n is checked above
  return { mean, low, high }
}
