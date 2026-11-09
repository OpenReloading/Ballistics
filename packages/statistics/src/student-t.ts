/** For whole degrees of freedom: bisection on the closed forms of P(|T| < t) for odd and even degrees (Abramowitz and Stegun 26.7.3 and 26.7.4, `apps/docs/docs/models/groups.md`, "Student's t quantile"). */
import { bisect } from './bisect.ts'
import { need } from './issue.ts'

/** P(|T| < t) for even `df` at theta = atan(t / sqrt(df)): sin(theta) times a series in cos^2 (A&S 26.7.3). */
function evenMass(theta: number, df: number): number {
  const c2 = Math.cos(theta) ** 2
  // term k: (2k-1)!! / (2k)!! cos^(2k)
  let term = 1
  let sum = term
  for (let k = 1; 2 * k < df; k++) {
    term *= ((2 * k - 1) / (2 * k)) * c2
    sum += term
  }
  return Math.sin(theta) * sum
}

/** P(|T| < t) for odd `df` at theta = atan(t / sqrt(df)): 2 theta / pi plus a series in cos^2 (A&S 26.7.4). */
function oddMass(theta: number, df: number): number {
  if (df === 1) return (2 * theta) / Math.PI
  const c2 = Math.cos(theta) ** 2
  // term k: (2k)!! / (2k+1)!! cos^(2k+1)
  let term = Math.cos(theta)
  let sum = term
  for (let k = 1; 2 * k < df - 1; k++) {
    term *= ((2 * k) / (2 * k + 1)) * c2
    sum += term
  }
  return (2 / Math.PI) * (theta + Math.sin(theta) * sum)
}

/** P(|T| < t) for `df` degrees of freedom, t not negative. */
function centralMass(t: number, df: number): number {
  const theta = Math.atan(t / Math.sqrt(df))
  return df % 2 === 0 ? evenMass(theta, df) : oddMass(theta, df)
}

/** The `t`, not negative, at which the probability of |T| below `t` is `level`; level in (0, 1), `df` a positive whole number. */
export function studentTwoSidedQuantile(level: number, df: number): number {
  need(level > 0 && level < 1, { code: 'levelOutsideUnit', params: {} })
  need(Number.isInteger(df) && df > 0, { code: 'degreesOfFreedomNotPositiveWhole', params: {} })
  let hi = 2
  while (centralMass(hi, df) < level) hi *= 2
  return bisect((t) => centralMass(t, df) < level, [0, hi], 200, true)
}
