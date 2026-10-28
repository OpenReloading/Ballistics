import { interior as core } from '@open-reloading/core'

/** The core model with a muzzle velocity that is not a number for charges above 2.3 g. */
export function interior(load, options) {
  const result = core(load, options)
  return result.valid && load.charge > 2.3e-3 ? { ...result, muzzleVelocity: Number.NaN } : result
}
