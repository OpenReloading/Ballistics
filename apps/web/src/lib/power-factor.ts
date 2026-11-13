import { fromSi } from '@rangefoundry/schema'
import { kilogramsPerGrain, metersPerFoot } from './units.ts'

/** MIP: 0.1 * m(g) * v(m/s), so one unit is 10 g m/s; `massKg` is the stored mass in kg. */
export function powerFactor(massKg: number, velocity: number): number {
  return 0.1 * fromSi('mass', massKg) * velocity
}

/** IPSC power factor: bullet mass in grains times muzzle velocity in ft/s over 1000. */
export function ipscPowerFactor(massKg: number, velocity: number): number {
  return ((massKg / kilogramsPerGrain) * (velocity / metersPerFoot)) / 1000
}
