import type { FreeRecoil } from '@open-reloading/core'
import { formatNumber } from '../i18n/number.ts'
import { footPound, metersPerFoot, type UnitSystem } from './units.ts'

/** 1 lbf in N: the foot-pound over the foot. */
const poundForce = footPound / metersPerFoot

/**
 * The momentum unit of the page: N·s (kg·m/s) beside joules, lbf·s beside foot-pounds, the impulse
 * unit of US recoil tables. Not a unit of Settings: it follows the energy unit.
 */
export function momentumUnit(system: UnitSystem) {
  return system.energy.symbol === 'J'
    ? { symbol: 'N·s', fromSi: (si: number) => si }
    : { symbol: 'lbf·s', fromSi: (si: number) => si / poundForce }
}

/** A momentum in kg·m/s in the unit of the page, with 2 decimals, without the symbol. */
export const momentumText = (system: UnitSystem, si: number) =>
  formatNumber(momentumUnit(system).fromSi(si), 2)

/**
 * The momentum of the free recoil and its parts: the bullet's (mass times muzzle velocity) and the
 * gas's (the rest of `FreeRecoil.momentum`), kg·m/s.
 */
export function momentumParts(recoil: FreeRecoil, bulletMass: number, muzzleVelocity: number) {
  const bullet = bulletMass * muzzleVelocity
  return { total: recoil.momentum, bullet, gas: recoil.momentum - bullet }
}
