/**
 * Dynamic vivacity of a vivacity burn law, `apps/docs/docs/models/interior-burn-forms.md`, "Dynamic vivacity": the burn rate per
 * pressure (1/p) dz/dt = B_a phi(z) / p_ref, in 1/(Pa s), for exponent 1.
 */
import { need } from '../errors.ts'
import { type Burn, burnForm } from './form.ts'

/** A vivacity law whose form function is in z throughout (no `threeStage`, whose third stage is integrated in another variable). */
export type VivacityBurn = Extract<Burn, { kind: 'vivacity' }> & {
  form: { kind: 'constant' } | { kind: 'twoStage'; a: number; m: number; q: number; z1: number }
}

/** Dynamic vivacity at burnt fraction z (0 to 1), 1/(Pa s). */
export function dynamicVivacity(burn: VivacityBurn, z: number): number {
  // with n != 1 the rate per pressure depends on the pressure, so there is no single curve
  need(burn.exponent === 1, 'dynamic vivacity: exponent must be 1')
  return (burn.vivacity * burnForm(burn).phi(z)) / burn.referencePressure
}

/** Mean dynamic vivacity over burnt fraction [from, to], 1/(Pa s): Simpson's rule on each piece between the form's breakpoints. */
export function meanDynamicVivacity(burn: VivacityBurn, from = 0.1, to = 0.9): number {
  need(0 <= from && from < to && to <= 1, 'dynamic vivacity: need 0 <= from < to <= 1')
  const edges = [from, ...burnForm(burn).breaks.filter((b) => b > from && b < to), to]
  const n = 64
  let sum = 0
  for (let k = 1; k < edges.length; k++) {
    const [lo, h] = [edges[k - 1], (edges[k] - edges[k - 1]) / n]
    let s = dynamicVivacity(burn, lo) + dynamicVivacity(burn, edges[k])
    for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * dynamicVivacity(burn, lo + i * h)
    sum += (s * h) / 3
  }
  return sum / (to - from)
}
