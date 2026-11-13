/** For whole degrees of freedom: bisection on the closed forms of P(|T| < t) for odd and even degrees (Abramowitz and Stegun 26.7.3 and 26.7.4) below level 0.5, on the tail P(|T| > t) = I_x(df/2, 1/2) from 0.5 up (DLMF 8.17.22), so that levels near 1 keep their digits (`apps/docs/docs/models/groups.md`, "Student's t quantile"). */
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

/** P(|T| > t) for `df` degrees of freedom, t not negative: the continued fraction of I_x(df/2, 1/2) at x = df / (df + t^2) (DLMF 8.17.22, https://dlmf.nist.gov/8.17#E22) by the modified Lentz method where it converges fast, else 1 - `centralMass`, which is at least 0.08 there. */
function tailMass(t: number, df: number): number {
  const a = df / 2
  const r = (t * t) / df
  const x = 1 / (1 + r)
  if (x >= (a + 1) / (a + 2.5)) return 1 - centralMass(t, df)
  const tiny = 1e-300
  const guard = (v: number) => (Math.abs(v) < tiny ? tiny : v)
  let c = 1
  let d = 1 / guard(1 - ((a + 0.5) * x) / (a + 1))
  let h = d
  for (let m = 1; m < 10000; m++) {
    const even = (m * (0.5 - m) * x) / ((a + 2 * m - 1) * (a + 2 * m))
    d = 1 / guard(1 + even * d)
    c = guard(1 + even / c)
    h *= d * c
    const odd = (-(a + m) * (a + 0.5 + m) * x) / ((a + 2 * m) * (a + 2 * m + 1))
    d = 1 / guard(1 + odd * d)
    c = guard(1 + odd / c)
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 1e-16) break
  }
  return (Math.exp(-a * Math.log1p(r)) * Math.sqrt(r / (1 + r)) * h) / betaTimesA(a)
}

/** a B(a, 1/2) = Gamma(a + 1) sqrt(pi) / Gamma(a + 1/2) for a whole or half-whole a > 0, as a product of ratios near 1, which keeps the digits that a difference of ln Gamma loses for large a. */
function betaTimesA(a: number): number {
  const whole = Number.isInteger(a)
  let product = whole ? 1 : Math.PI / 2
  for (let j = whole ? 1 : 1.5; j <= a; j++) product *= j / (j - 0.5)
  return product
}

/** The `t`, not negative, at which the probability of |T| below `t` is `level`; level in (0, 1), `df` a positive whole number. Every level a double holds in (0, 1) is accepted: for `df` up to 1,000 and levels from 1e-40 to 1 - 2^-53 the result keeps a relative accuracy of 1e-12; below 1e-40 the 200 bisection steps from 2 stop short of `t` (level 1e-100 at `df` 1 returns about 6e-61, not 1.6e-100). */
export function studentTwoSidedQuantile(level: number, df: number): number {
  need(level > 0 && level < 1, { code: 'levelOutsideUnit', params: {} })
  need(Number.isInteger(df) && df > 0, { code: 'degreesOfFreedomNotPositiveWhole', params: {} })
  // from 0.5 up 1 - level is exact, while 1 - centralMass loses the tail's digits near level 1
  const alpha = 1 - level
  const below =
    level < 0.5 ? (t: number) => centralMass(t, df) < level : (t: number) => tailMass(t, df) > alpha
  let hi = 2
  while (below(hi)) hi *= 2
  return bisect(below, [0, hi], 200, true)
}
