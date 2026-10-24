import { fromSi } from '@open-reloading/schema'
import { kilogramsPerGrain, metersPerFoot } from './units.ts'

/**
 * MIP factor: 0.1 * m * v with m the bullet mass in g and v the muzzle velocity in m/s, so one unit
 * of the result is 10 g m/s. `massKg` is the stored bullet mass, kg.
 */
export function powerFactor(massKg: number, velocity: number): number {
  return 0.1 * fromSi('mass', massKg) * velocity
}

/** IPSC power factor: bullet mass in grains times muzzle velocity in ft/s over 1000. */
export function ipscPowerFactor(massKg: number, velocity: number): number {
  return ((massKg / kilogramsPerGrain) * (velocity / metersPerFoot)) / 1000
}
