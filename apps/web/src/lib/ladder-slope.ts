import { icao, type Projectile, trajectory, zeroAngles } from '@rangefoundry/ballistics'
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

/** m/s: wide enough to hide the integrator tolerance, narrow enough that height stays linear in velocity. */
const half = 10

/** Height change at `distance` (m) per m/s of muzzle velocity: two trajectories ±`half` with the zero's bore angles, ICAO air, no wind; undefined without a muzzle velocity, sight height or zero range, or when the solver refuses (`apps/docs/docs/models/interior-ladder-impact.md`, "Drop slope"). */
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
