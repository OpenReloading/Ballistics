/**
 * Muzzle velocity from a speed measured downrange, `apps/docs/docs/models/exterior-drag.md`,
 * "Speed measured downrange". SI in and out.
 */
import { InputError, need, nth, overlay, type Settings } from '../errors.ts'
import type { Air } from './atmosphere.ts'
import {
  type Projectile,
  type TrajectoryInput,
  type TrajectoryOptions,
  trajectory,
} from './trajectory.ts'

/** A speed read at a measuring point downrange of the muzzle, with the bullet that flew and the air it flew in. */
export interface DownrangeReading {
  /** Mass, diameter and drag of the bullet. */
  projectile: Projectile
  /** Station air along the flight. */
  air: Air
  /** Muzzle to the measuring point along the line of fire, m; zero returns the reading itself. */
  distance: number
  /** Speed measured at the measuring point, m/s. */
  velocity: number
}

/** Largest change of the muzzle velocity between two passes at which the search ends, m/s. */
const convergence = 1e-6

/**
 * Muzzle velocity whose flown speed at `distance` equals the measured one, over the bullet's own
 * drag law in `trajectory` (horizontal bore, point mass, no wind, Earth rotation, spin drift or
 * jump). Each pass moves the guess by the miss; the flown speed rises with the muzzle velocity at a
 * slope near one, so the miss shrinks by a factor of about the relative loss per pass.
 */
export function muzzleVelocityFromDownrange(
  reading: DownrangeReading,
  options?: Settings<TrajectoryOptions>,
): number {
  const { projectile, air, distance, velocity } = reading
  need(distance >= 0 && Number.isFinite(distance), 'distance must not be negative')
  need(velocity > 0 && Number.isFinite(velocity), 'velocity must be positive')
  if (distance === 0) return velocity
  const o = overlay<Settings<TrajectoryOptions>>(options ?? {}, {
    model: 'point-mass',
    coriolis: false,
    spinDrift: false,
    jump: false,
  })
  const flown = (muzzleVelocity: number): number => {
    const shot: TrajectoryInput = {
      projectile,
      muzzleVelocity,
      firearm: { sightHeight: 0 },
      air,
      zero: { elevationAngle: 0, windageAngle: 0 },
    }
    const t = trajectory(shot, [distance], o)
    if (t.points.length === 0)
      throw new InputError(`distance ${distance} m not reached (${t.stop})`)
    return nth(t.points, 0).velocity
  }
  let v0 = velocity
  for (let pass = 0; pass < 20; pass++) {
    const step = velocity - flown(v0)
    v0 += step
    need(v0 > 0, 'the speed measured is lower than the bullet can keep over the distance')
    if (Math.abs(step) < convergence) return v0
  }
  throw new InputError('muzzle velocity did not converge')
}
