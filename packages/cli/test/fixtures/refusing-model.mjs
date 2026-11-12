import { interior as core } from '@open-reloading/ballistics'
import { InputError } from '@rangefoundry/statistics'

/** The core model that refuses by a throw a burn coefficient above 0.64, between the record value 0.612 of demo-powder-dp40 and the 0.66096 the fit tests plant. */
export function interior(load, options) {
  const burn = load.propellant.burn
  if ((burn.kind === 'vivacity' ? burn.vivacity : burn.coefficient) > 0.64)
    throw new InputError({ code: 'burnAboveLimit', params: {} })
  return core(load, options)
}
