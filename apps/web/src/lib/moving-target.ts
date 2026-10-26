import { movingTargetLead, type TrajectoryPoint } from '@open-reloading/core'

/** The lead at one range of the trajectory table (SI: m, s, rad). */
export interface MovingTargetRow {
  range: number
  /** Time of flight to the range. */
  time: number
  /** Lateral lead, positive to the right. */
  lateral: number
  angle: number
  /** The lead in target lengths; without a target length none. */
  lengths?: number | undefined
}

/**
 * The lead at each range of `points` for a target moving at `speed` m/s on `heading` rad
 * (`movingTargetLead` of core), the time of flight read from each point. `targetLength` (m) turns
 * the lateral lead into target lengths.
 */
export function movingTargetRows(
  points: readonly TrajectoryPoint[],
  speed: number,
  heading: number,
  targetLength?: number,
): MovingTargetRow[] {
  return points
    .filter((p) => p.range > 0)
    .map((p) => {
      const { lateral, angle } = movingTargetLead({ speed, heading }, p.range, p.time)
      return {
        range: p.range,
        time: p.time,
        lateral,
        angle,
        ...(targetLength && { lengths: lateral / targetLength }),
      }
    })
}
