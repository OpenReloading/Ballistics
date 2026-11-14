import { interior as core } from '@rangefoundry/ballistics'

/** The core model, refusing a load whose burn coefficient is above 1.1 1/s as it refuses a bad input. */
export function interior(load, options) {
  return load.propellant.burn.vivacity > 1.1
    ? { valid: false, reason: 'input' }
    : core(load, options)
}
