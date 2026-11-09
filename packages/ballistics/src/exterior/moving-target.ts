/** Lead for a moving target, `apps/docs/docs/models/exterior-moving-target.md`; SI in and out. */
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

/** `range` m along the line of sight, `timeOfFlight` s to it; the lateral lead is positive to the right and the angle its arctangent over the range, as the motion along the line of sight changes neither. */
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
