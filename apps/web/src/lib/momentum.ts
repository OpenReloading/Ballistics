import type { FreeRecoil } from '@open-reloading/ballistics'
import { formatNumber } from '../i18n/number.ts'
import { footPound, metersPerFoot, type UnitSystem } from './units.ts'

/** 1 lbf in N: the foot-pound over the foot. */
const poundForce = footPound / metersPerFoot

/** The impulse unit of US recoil tables; it follows the energy unit, not a Settings choice. */
export function momentumUnit(system: UnitSystem) {
  return system.energy.symbol === 'J'
    ? { symbol: 'N·s', fromSi: (si: number) => si }
    : { symbol: 'lbf·s', fromSi: (si: number) => si / poundForce }
}

/** A momentum in kg·m/s in the unit of the page, with 2 decimals, without the symbol. */
export const momentumText = (system: UnitSystem, si: number) =>
  formatNumber(momentumUnit(system).fromSi(si), 2)

/** SI: `bulletMass` kg, `muzzleVelocity` m/s, the parts kg·m/s; the gas's share is the rest of `FreeRecoil.momentum`. */
export function momentumParts(recoil: FreeRecoil, bulletMass: number, muzzleVelocity: number) {
  const bullet = bulletMass * muzzleVelocity
  return { total: recoil.momentum, bullet, gas: recoil.momentum - bullet }
}
