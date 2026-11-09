/** With 2 and `m` degrees of freedom, in closed form: the distribution function is 1 - I_k(m/2, 1) with k = m / (m + 2x) (NIST/SEMATECH 1.3.6.6.5), and I_k(a, 1) = k^a (DLMF 8.17.1 and 8.17.2 at b = 1) (`apps/docs/docs/models/groups.md`, "Dispersion and prediction ellipses"). */
import { need } from './issue.ts'

/** The `x` at which the distribution function of F(2, m) is `p`; p in (0, 1), m above 0. */
export function fQuantileTwoNumeratorDegrees(p: number, m: number): number {
  need(p > 0 && p < 1, { code: 'probabilityOutsideUnit', params: {} })
  need(m > 0, { code: 'degreesOfFreedomNotPositive', params: {} })
  // expm1 keeps precision for large m, where (1 - p)^(-2/m) is close to 1
  return (m / 2) * Math.expm1((-2 / m) * Math.log1p(-p))
}
