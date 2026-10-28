/**
 * Advisory flier screen for a string of 10 to 30 shots: the shot farthest from the string mean is
 * compared with the mean and sample standard deviation of the other shots. The factors are the
 * 99th percentile of that statistic for clean normal strings, from a seeded simulation
 * (`tools/research/string-flier-flag.ts`, 1 000 000 strings per length). A flagged shot is never
 * excluded by this function.
 */
import { need } from '../errors.ts'

/** Factor k at a false-flag rate of 1 % per clean string, for 10 to 30 shots. */
const FACTORS = [
  5.32, 5.09, 4.92, 4.78, 4.68, 4.6, 4.53, 4.47, 4.42, 4.38, 4.34, 4.31, 4.28, 4.26, 4.23, 4.22,
  4.21, 4.2, 4.17, 4.16, 4.16,
]

/** Result of {@link flierScreen}. */
export interface FlierScreen {
  /** Index of the shot farthest from the string mean. */
  index: number
  /** Its distance from the mean of the other shots, in sample standard deviations of those shots. */
  distance: number
  /** The factor for this string length: the shot is flagged above it. */
  threshold: number
  flagged: boolean
  /** Sample standard deviation of the whole string. */
  standardDeviation: number
  /** Sample standard deviation of the string without the farthest shot. */
  standardDeviationWithout: number
}

const mean = (a: readonly number[]) => a.reduce((s, v) => s + v, 0) / a.length
const sd = (a: readonly number[]) => {
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1))
}

/**
 * Screens a string of velocities (or any normal quantity) for one flier: `undefined` for fewer than
 * 10 or more than 30 values, where the screen has no calibrated factor (at 5 shots it has almost no
 * power). The false-flag rate is 1 % per clean normal string; a flagged shot may be a real effect
 * such as a cold bore.
 */
export function flierScreen(values: readonly number[]): FlierScreen | undefined {
  need(
    values.every((v) => Number.isFinite(v)),
    'values must be finite',
  )
  const n = values.length
  const threshold = FACTORS[n - 10]
  if (threshold === undefined) return undefined
  const m = mean(values)
  let index = 0
  for (const [i, v] of values.entries())
    if (Math.abs(v - m) > Math.abs((values[index] as number) - m)) index = i
  const others = values.filter((_, i) => i !== index)
  const spread = sd(others)
  const distance = Math.abs((values[index] as number) - mean(others)) / spread
  return {
    index,
    distance,
    threshold,
    flagged: distance > threshold,
    standardDeviation: sd(values),
    standardDeviationWithout: spread,
  }
}
