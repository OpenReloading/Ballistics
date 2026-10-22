import { need } from './errors.ts'

/**
 * Velocity of the propellant gas leaving the muzzle over the muzzle velocity of the projectile, by
 * firearm type: 1.75 for high-powered rifles, 1.50 for pistols and revolvers (SAAMI, Gun Recoil -
 * Technical, Free Recoil Energy, Rev. 7/9/2018,
 * https://saami.org/wp-content/uploads/2025/03/Gun-Recoil-Formulae-2018-07-9.pdf; the sheet traces
 * them to the British Text Book of Small Arms, 1929). `apps/docs/docs/models/free-recoil.md`.
 */
export const gasVelocityFactor = { rifle: 1.75, pistol: 1.5 } as const

/** Input of `freeRecoil`, SI units; masses and velocities must be finite. */
export type FreeRecoilInput = {
  /** Mass of the firearm with scope and attachments, kg. */
  firearmMass: number
  /** Mass of the projectile, kg. */
  projectileMass: number
  /** Mass of the powder charge, kg; the sheet takes the mass of the gas as equal to it. */
  chargeMass: number
  /** Muzzle velocity of the projectile, m/s. */
  muzzleVelocity: number
  /** Gas velocity over `muzzleVelocity`, see `gasVelocityFactor`. */
  gasFactor: number
}

/** Result of `freeRecoil`. */
export type FreeRecoil = {
  /** Momentum of projectile and gas, equal and opposite to the firearm's, kg m/s. */
  momentum: number
  /** Velocity of the free firearm, m/s. */
  velocity: number
  /** Kinetic energy of the free firearm, J. */
  energy: number
}

/**
 * Free recoil of an unrestrained firearm by conservation of momentum: the firearm's momentum is
 * that of the projectile plus that of the powder gas, which leaves at `gasFactor` times the
 * muzzle velocity. Muzzle brakes and suppressors that redirect the gas are not covered.
 */
export function freeRecoil(input: FreeRecoilInput): FreeRecoil {
  const { firearmMass, projectileMass, chargeMass, muzzleVelocity, gasFactor } = input
  need(Number.isFinite(firearmMass) && firearmMass > 0, 'Firearm mass must be positive.')
  need(Number.isFinite(projectileMass) && projectileMass > 0, 'Projectile mass must be positive.')
  need(Number.isFinite(chargeMass) && chargeMass >= 0, 'Charge mass must not be negative.')
  need(
    Number.isFinite(muzzleVelocity) && muzzleVelocity >= 0,
    'Muzzle velocity must not be negative.',
  )
  need(Number.isFinite(gasFactor) && gasFactor >= 0, 'Gas velocity factor must not be negative.')
  const momentum = projectileMass * muzzleVelocity + chargeMass * gasFactor * muzzleVelocity
  const velocity = momentum / firearmMass
  return { momentum, velocity, energy: 0.5 * firearmMass * velocity ** 2 }
}
