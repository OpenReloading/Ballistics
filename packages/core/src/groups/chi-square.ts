/**
 * Chi-square distribution function and quantile for whole degrees of freedom,
 * `apps/docs/docs/models/groups.md`, "Confidence intervals by shot count": the regularized incomplete gamma function P(df/2, x/2) by
 * its power series (DLMF 8.2.6, 8.7.1), each term formed in logarithms so that large pooled
 * samples do not underflow.
 */
import { bisect } from '../bisect.ts'
import { need } from '../errors.ts'

/** ln Gamma(a + 1) for a whole or half-whole a >= 0: a finite product down to Gamma(1) or Gamma(3/2). */
function lnGammaPlusOne(a: number): number {
  let sum = 0
  let t = a
  for (; t >= 1; t -= 1) sum += Math.log(t)
  return t > 0 ? sum + Math.log(0.5) + 0.5 * Math.log(Math.PI) : sum
}

/**
 * Probability that a chi-square variable with `df` (a positive whole number) degrees of freedom is
 * at most `x`: the series below the mode, 1 minus `chiSquareSurvival` above, where the series would
 * need about x/2 terms.
 */
export function chiSquareCdf(x: number, df: number): number {
  need(Number.isInteger(df) && df > 0, 'degrees of freedom must be a positive whole number')
  if (!(x > 0)) return 0
  const a = df / 2
  const z = x / 2
  if (z >= a + 1) return 1 - chiSquareSurvival(x, df)
  const lnZ = Math.log(z)
  // term k: exp(-z) z^(a+k) / Gamma(a+k+1)
  let lnTerm = -z + a * lnZ - lnGammaPlusOne(a)
  let sum = Math.exp(lnTerm)
  for (let k = 1; ; k++) {
    lnTerm += lnZ - Math.log(a + k)
    const term = Math.exp(lnTerm)
    sum += term
    if (a + k > z && term <= 1e-17 * sum) break
  }
  return Math.min(sum, 1)
}

/**
 * Probability that a chi-square variable with `df` degrees of freedom exceeds `x`. Below the mode
 * it is 1 minus the series of `chiSquareCdf`; above, the continued fraction of the upper
 * incomplete gamma function (DLMF 8.9.2, https://dlmf.nist.gov/8.9#E2, contracted form) by the modified Lentz method, which keeps the relative
 * accuracy in the upper tail where `1 - chiSquareCdf` is 0.
 */
export function chiSquareSurvival(x: number, df: number): number {
  need(Number.isInteger(df) && df > 0, 'degrees of freedom must be a positive whole number')
  if (!(x > 0)) return 1
  if (x === Number.POSITIVE_INFINITY) return 0
  const a = df / 2
  const z = x / 2
  if (z < a + 1) return 1 - chiSquareCdf(x, df)
  const tiny = 1e-300
  let b = z + 1 - a
  let c = 1 / tiny
  let d = 1 / b
  let h = d
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < tiny) d = tiny
    c = b + an / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 1e-16) break
  }
  return Math.exp(-z + a * Math.log(z) - (lnGammaPlusOne(a) - Math.log(a))) * h
}

/** The `x` with `chiSquareCdf(x, df) = p`, p in (0, 1), by bisection. */
export function chiSquareQuantile(p: number, df: number): number {
  need(p > 0 && p < 1, 'probability must lie in (0, 1)')
  let hi = df + 10 * Math.sqrt(df) + 50
  while (chiSquareCdf(hi, df) < p) hi *= 2
  return bisect((x) => chiSquareCdf(x, df) < p, 0, hi, 200, true)
}
