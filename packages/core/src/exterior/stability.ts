/**
 * Gyroscopic and dynamic stability, spin drift and aerodynamic jump,
 * `apps/docs/docs/models/exterior-stability.md`. SI in and out; the empirical fits are
 * stated in customary units and converted here.
 */
import { InputError } from '../errors.ts'
import type { Air } from './atmosphere.ts'

const grain = 0.45359237 / 7000
const inch = 0.0254
const foot = 0.3048
/** Pa per inch of mercury (conventional). */
const inHg = 3386.389
/** 1 MOA (one sixtieth of a degree) in rad. */
export const radPerMoa = Math.PI / 10800
const mph = 0.44704

/** Inputs of {@link millerStability}: mass kg, diameter, length and twist m, velocity m/s. */
export interface MillerStabilityInput {
  mass: number
  diameter: number
  length: number
  twist: number
  velocity: number
  air: Air
}

/**
 * Miller's gyroscopic stability factor with the velocity and atmosphere corrections: mass kg,
 * diameter, length and twist m (twist per turn), velocity m/s, air at the muzzle.
 */
export function millerStability(i: MillerStabilityInput): number {
  const { mass, diameter, length, twist, velocity, air } = i
  if (!(mass > 0 && diameter > 0 && length > 0 && twist > 0 && velocity > 0))
    throw new InputError('mass, diameter, length, twist and velocity must be positive')
  const t = twist / diameter
  const l = length / diameter
  const d = diameter / inch
  const sg = (30 * (mass / grain)) / (t ** 2 * d ** 3 * l * (1 + l ** 2))
  const fv = (velocity / foot / 2800) ** (1 / 3)
  // absolute temperature over 59 degF (288.15 K), 29.92 inHg over the station pressure
  const fa = (air.temperature / 288.15) * ((29.92 * inHg) / air.pressure)
  return sg * fv * fa
}

/** Inputs of {@link dynamicStabilityFactor}: coefficients, mass kg, diameter m, moments of inertia kg m2. */
export interface DynamicStabilityInput {
  liftSlope: number
  drag: number
  magnusMoment: number
  pitchDamping: number
  mass: number
  diameter: number
  axialInertia: number
  transverseInertia: number
}

/**
 * Dynamic stability factor of linear theory from aerodynamic coefficients (McCoy): lift-force
 * slope, drag, Magnus-moment slope, pitch-damping sum (Cmq + Cm-alpha-dot), mass kg, diameter m,
 * axial and transverse moments of inertia kg m2.
 */
export function dynamicStabilityFactor(c: DynamicStabilityInput): number {
  const md2 = c.mass * c.diameter ** 2
  return (
    (2 * (c.liftSlope + (md2 / c.axialInertia) * c.magnusMoment)) /
    (c.liftSlope - c.drag - (md2 / c.transverseInertia) * c.pitchDamping)
  )
}

/** Linear-theory stability: Sg > 1 and 1/Sg < Sd (2 - Sd). */
export function isStable(sg: number, sd: number): boolean {
  return sg > 1 && 1 / sg < sd * (2 - sd)
}

/**
 * Litz's spin-drift fit (B. Litz, Applied Ballistics for Long Range Shooting, 3rd edition,
 * Applied Ballistics, LLC, 2015), m, positive toward the twist hand's side (right for right-hand
 * twist).
 */
export function spinDrift(sg: number, time: number, hand: 'right' | 'left'): number {
  const drift = 1.25 * (sg + 1.2) * time ** 1.83 * inch
  return hand === 'right' ? drift : -drift
}

/**
 * Litz's aerodynamic-jump fit (B. Litz, Applied Ballistics for Long Range Shooting, 3rd edition,
 * Applied Ballistics, LLC, 2015) as a vertical angle, rad, positive up. `crosswind` m/s is positive
 * when the wind blows to the right (comes from the left), which lowers a right-hand-twist bullet
 * (McCoy, BRL-MR-3877 eq. (12), as `linearJump`).
 */
export function aerodynamicJump(
  sg: number,
  lengthCalibres: number,
  crosswind: number,
  hand: 'right' | 'left',
): number {
  const perMph = 0.01 * sg - 0.0024 * lengthCalibres + 0.032
  const jump = perMph * radPerMoa * (crosswind / mph)
  return hand === 'right' ? -jump : jump
}
