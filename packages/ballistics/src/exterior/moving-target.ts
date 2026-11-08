/**
 * Lead for a moving target, `apps/docs/docs/models/exterior-moving-target.md`. SI in and out.
 */
import { InputError } from '../issue.ts'

/** A target's motion: speed m/s and heading rad (0 away from the shooter, pi/2 crossing to the right). */
export interface TargetMotion {
  speed: number
  heading: number
}

/** The aim point of a moving target: the lateral lead m and the angle rad from the line of sight to it. */
export interface MovingTargetLead {
  lateral: number
  angle: number
}

/**
 * The lead for a target at `range` m (along the line of sight) that moves during the time of flight
 * `timeOfFlight` s of the bullet to that range. The lateral lead is the target's displacement across
 * the line of sight, positive to the right; the angle is the lead divided by the range, as an
 * arctangent. The range and the time of flight stay those of the trajectory: the part of the motion
 * along the line of sight changes neither.
 */
export function movingTargetLead(
  target: TargetMotion,
  range: number,
  timeOfFlight: number,
): MovingTargetLead {
  if (!(Number.isFinite(target.speed) && target.speed >= 0))
    throw new InputError({ code: 'targetSpeedNegative', params: {} })
  if (!Number.isFinite(target.heading))
    throw new InputError({ code: 'targetHeadingNotNumber', params: {} })
  if (!(range > 0 && Number.isFinite(range)))
    throw new InputError({ code: 'rangeNotPositive', params: {} })
  if (!(timeOfFlight >= 0 && Number.isFinite(timeOfFlight)))
    throw new InputError({ code: 'timeOfFlightNegative', params: {} })
  const lateral = target.speed * timeOfFlight * Math.sin(target.heading)
  return { lateral, angle: Math.atan2(lateral, range) }
}
