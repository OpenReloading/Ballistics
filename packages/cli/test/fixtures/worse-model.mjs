import { interior as core } from '@open-reloading/core'

/** The core model with every muzzle velocity 10 % too high. */
export function interior(load, options) {
  const result = core(load, options)
  return result.valid ? { ...result, muzzleVelocity: result.muzzleVelocity * 1.1 } : result
}
