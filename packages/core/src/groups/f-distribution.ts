/**
 * Quantile of the F distribution with 2 and `m` degrees of freedom,
 * `apps/docs/docs/models/groups.md`, "Dispersion and prediction ellipses". Its distribution function is 1 - I_k(m/2, 1) with k = m / (m + 2x) (NIST/SEMATECH
 * 1.3.6.6.5); with second parameter 1 the regularized incomplete beta function is I_k(a, 1) = k^a
 * (DLMF 8.17.1 and 8.17.2 at b = 1: B_k(a, 1) = k^a / a, B(a, 1) = 1 / a), so the quantile is closed form.
 */
import { need } from '../errors.ts'

/** The `x` with P(F(2, m) <= x) = p, p in (0, 1), m > 0. */
export function fQuantileTwoNumeratorDegrees(p: number, m: number): number {
  need(p > 0 && p < 1, 'probability must lie in (0, 1)')
  need(m > 0, 'degrees of freedom must be positive')
  // expm1 keeps precision for large m, where (1 - p)^(-2/m) is close to 1
  return (m / 2) * Math.expm1((-2 / m) * Math.log1p(-p))
}
