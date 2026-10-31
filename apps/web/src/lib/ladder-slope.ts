import { icao, type Projectile, trajectory, zeroAngles } from '@open-reloading/core'
import { shotFromValues } from './trajectory-input.ts'

/** The load the Trajectory tab starts from, SI: the inputs of the drop slope. */
export interface DropSlopeLoad {
  muzzleVelocity?: number | undefined
  twist?: number | undefined
  sightHeight?: number | undefined
  zeroRange?: number | undefined
  zeroTemperature?: number | undefined
  zeroPressure?: number | undefined
  zeroHumidity?: number | undefined
  dragFactor?: number | undefined
}

/**
 * Half the velocity step of the slope, m/s: wide enough that the integrator tolerance does not
 * show in the height difference, narrow enough that the height is linear in velocity across it.
 */
const half = 10

/**
 * Change of the height of impact at `distance` m per m/s of muzzle velocity: two trajectories at
 * the muzzle velocity less and plus `half`, flown with the bore angles of the zero at the load's
 * muzzle velocity, in ICAO air without wind. Undefined when the load lacks a muzzle velocity, a
 * sight height or a zero range, or the solver refuses the shot.
 * (`apps/docs/docs/models/interior-ladder-impact.md`, "Drop slope".)
 */
export function dropSlope(
  load: DropSlopeLoad,
  projectile: Projectile,
  distance: number,
): number | undefined {
  try {
    const shot = shotFromValues(
      {
        ...load,
        temperature: icao.temperature,
        pressure: icao.pressure,
        altitude: 0,
        humidity: 0,
        windSpeed: 0,
        windFrom: 0,
      },
      projectile,
      'right',
    )
    const zero = zeroAngles(shot)
    const at = (muzzleVelocity: number) =>
      trajectory({ ...shot, muzzleVelocity, zero }, [distance]).points[0]?.height
    const [slow, fast] = [at(shot.muzzleVelocity - half), at(shot.muzzleVelocity + half)]
    if (slow === undefined || fast === undefined) return undefined
    const slope = (fast - slow) / (2 * half)
    return Number.isFinite(slope) ? slope : undefined
  } catch {
    return undefined
  }
}
