/** Muzzle velocity from a speed measured downrange, `apps/docs/docs/models/exterior-drag.md`, "Speed measured downrange"; SI in and out. */
import { nth } from '@open-reloading/statistics'
import { InputError, need } from '../issue.ts'
import { overlay, type Settings } from '../settings.ts'
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

/** Over the bullet's own drag law in `trajectory` (horizontal bore, point mass, no wind, Earth rotation, spin drift or jump); each pass moves the guess by the miss, which shrinks by about the relative loss per pass, as the slope is near one. */
export function muzzleVelocityFromDownrange(
  reading: DownrangeReading,
  options?: Settings<TrajectoryOptions>,
): number {
  const { projectile, air, distance, velocity } = reading
  need(distance >= 0 && Number.isFinite(distance), { code: 'distanceNegative', params: {} })
  need(velocity > 0 && Number.isFinite(velocity), { code: 'velocityNotPositive', params: {} })
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
      throw new InputError({ code: 'distanceNotReached', params: { distance, stop: t.stop } })
    return nth(t.points, 0).velocity
  }
  let v0 = velocity
  for (let pass = 0; pass < 20; pass++) {
    const step = velocity - flown(v0)
    v0 += step
    need(v0 > 0, { code: 'measuredSpeedTooLow', params: {} })
    if (Math.abs(step) < convergence) return v0
  }
  throw new InputError({ code: 'muzzleVelocityNotConverged', params: {} })
}
