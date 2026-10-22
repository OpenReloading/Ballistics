/**
 * Two-sided quantile of Student's t distribution for whole degrees of freedom, from the closed
 * forms of the probability P(|T| < t) for odd and even degrees (Abramowitz and Stegun 26.7.3 and
 * 26.7.4, `apps/docs/docs/models/groups.md`, "Student's t quantile") and bisection.
 */
import { bisect } from '../bisect.ts'
import { need } from '../errors.ts'

/** P(|T| < t) for `df` degrees of freedom, t >= 0. */
function centralMass(t: number, df: number): number {
  const theta = Math.atan(t / Math.sqrt(df))
  const s = Math.sin(theta)
  const c2 = Math.cos(theta) ** 2
  // term k of the series in cos^2: (2k-1)!! / (2k)!! (even df) or (2k)!! / (2k+1)!! (odd df)
  let term = df % 2 === 0 ? 1 : Math.cos(theta)
  let sum = term
  for (let k = 1; 2 * k < df - (df % 2 === 0 ? 0 : 1); k++) {
    term *= (df % 2 === 0 ? (2 * k - 1) / (2 * k) : (2 * k) / (2 * k + 1)) * c2
    sum += term
  }
  return df % 2 === 0
    ? s * sum
    : df === 1
      ? (2 * theta) / Math.PI
      : (2 / Math.PI) * (theta + s * sum)
}

/** The `t` >= 0 with P(|T| < t) = `level`, level in (0, 1), `df` a positive whole number. */
export function studentTwoSidedQuantile(level: number, df: number): number {
  need(level > 0 && level < 1, 'level must lie in (0, 1)')
  need(Number.isInteger(df) && df > 0, 'degrees of freedom must be a positive whole number')
  let hi = 2
  while (centralMass(hi, df) < level) hi *= 2
  return bisect((t) => centralMass(t, df) < level, 0, hi, 200, true)
}
