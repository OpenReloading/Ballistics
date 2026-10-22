/**
 * Helpers of the static modified point-mass model (M2b), described in
 * `apps/docs/docs/models/exterior-modified-point-mass.md` (Lieske and Reiter, BRL
 * Report 1314, after Kneubuehl 2018, section 5.5.2.3; McCoy 1999). SI in and out; angles in rad.
 */
import type { DragTable } from '../drag-tables.ts'
import { dragCoefficient } from './drag.ts'

/** A constant, or `[Mach, value]` nodes interpolated linearly and held at the end values. */
export type CoefficientOverMach = number | DragTable

/** Aerodynamic inputs of the modified point mass (`apps/docs/docs/models/exterior-modified-point-mass.md`, "Coefficients over Mach"). */
export interface Aerodynamics {
  /** Lift-force slope C_L-alpha, 1/rad. */
  liftSlope: CoefficientOverMach
  /** Overturning-moment slope C_M-alpha, 1/rad, > 0; estimated from Miller's rule if absent. */
  momentSlope?: CoefficientOverMach
  /** Magnus-force slope C_N-p-alpha, 1/rad; 0 when absent. */
  magnusForceSlope?: CoefficientOverMach
  /** Spin-damping coefficient C_l-p, negative; constant spin when absent. */
  spinDamping?: CoefficientOverMach
  /** Axial moment of inertia, kg m2; uniform-cylinder estimate when absent. */
  axialInertia?: number
  /** Transverse moment of inertia about the centre of mass, kg m2; estimated when absent. */
  transverseInertia?: number
}

/** Three-component vector, SI units of the quantity it holds. */
export type Vec3 = readonly [number, number, number]

/** Value of a coefficient at a Mach number. */
export function coefficientAt(c: CoefficientOverMach, mach: number): number {
  return typeof c === 'number' ? c : dragCoefficient(c, mach)
}

/**
 * Static yaw of repose, rad, as a vector perpendicular to the air-relative velocity `va`:
 * -2 Ix p (va x accel) / (rho A d CMa V^4), with `accel` the point-mass acceleration
 * (`apps/docs/docs/models/exterior-modified-point-mass.md`, "Yaw of repose").
 */
export function yawOfRepose(
  va: Vec3,
  accel: Vec3,
  spin: number,
  i: { axialInertia: number; momentSlope: number; density: number; diameter: number },
): [number, number, number] {
  const v2 = va[0] ** 2 + va[1] ** 2 + va[2] ** 2
  if (v2 === 0) return [0, 0, 0]
  const area = (Math.PI / 4) * i.diameter ** 2
  const f = (-2 * i.axialInertia * spin) / (i.density * area * i.diameter * i.momentSlope * v2 * v2)
  return [
    f * (va[1] * accel[2] - va[2] * accel[1]),
    f * (va[2] * accel[0] - va[0] * accel[2]),
    f * (va[0] * accel[1] - va[1] * accel[0]),
  ]
}

/** Moments of inertia of a uniform solid cylinder, kg m2 (Kneubuehl 2018, Eq. 2.2:24). */
export function cylinderInertia(
  mass: number,
  diameter: number,
  length: number,
): { axial: number; transverse: number } {
  return {
    axial: (mass * diameter ** 2) / 8,
    transverse: mass * (diameter ** 2 / 16 + length ** 2 / 12),
  }
}

/** Inputs of {@link gyroscopicStability}, SI. */
export interface GyroscopicStabilityInput {
  axialInertia: number
  transverseInertia: number
  spin: number
  density: number
  speed: number
  diameter: number
  momentSlope: number
}

/**
 * Gyroscopic stability factor of linear theory: 2 Ix^2 p^2 / (pi Iy rho V^2 d^3 CMa)
 * (Kneubuehl 2018, Eq. 5.6:10; McCoy 1999).
 */
export function gyroscopicStability(i: GyroscopicStabilityInput): number {
  return (
    (2 * i.axialInertia ** 2 * i.spin ** 2) /
    (Math.PI * i.transverseInertia * i.density * i.speed ** 2 * i.diameter ** 3 * i.momentSlope)
  )
}

/** Inputs of {@link momentSlopeFromStability}, SI. */
export interface MomentSlopeInput extends Omit<GyroscopicStabilityInput, 'momentSlope'> {
  stability: number
}

/** Overturning-moment slope that gives the stated gyroscopic stability factor. */
export function momentSlopeFromStability(i: MomentSlopeInput): number {
  return (
    (2 * i.axialInertia ** 2 * i.spin ** 2) /
    (Math.PI * i.transverseInertia * i.density * i.speed ** 2 * i.diameter ** 3 * i.stability)
  )
}

/** Inputs of {@link linearJump}, SI. */
export interface LinearJumpInput {
  axialInertia: number
  spin: number
  mass: number
  diameter: number
  speed: number
  liftSlope: number
  momentSlope: number
  crosswind: number
}

/**
 * Vertical aerodynamic jump from a crosswind at the muzzle by linear theory, rad, positive up:
 * -(Ix p / (m d V)) (CLa / CMa) (W / V)
 * (`apps/docs/docs/models/exterior-modified-point-mass.md`, "Aerodynamic jump"; ČOS 109001 eq. (17)). `spin` is
 * signed by the twist hand and `crosswind` m/s is positive when the wind blows to the right, so
 * right-hand twist with wind from the left gives a downward jump.
 */
export function linearJump(i: LinearJumpInput): number {
  return (
    -((i.axialInertia * i.spin) / (i.mass * i.diameter * i.speed)) *
    (i.liftSlope / i.momentSlope) *
    (i.crosswind / i.speed)
  )
}
