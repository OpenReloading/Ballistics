import { pressureToleranceDefaults } from '@open-reloading/core'
import {
  bulletDimensions,
  bulletOutline,
  cavityVolumeBracket,
  revolutionVolume,
} from '@open-reloading/drawing/bullet'
import { type Bullet, fromSi, toSi } from '@open-reloading/schema'

/** The highest volume tolerance the API takes (`tolerances.volumeFraction`). */
const volumeFractionMax = 0.2

/**
 * The volume tolerance of a run whose volume follows the seated bullet, so that the pressure range
 * reaches the cavity depth bracket of a hollow base (`apps/docs/docs/models/case-capacity.md`,
 * "Cavity depth"): the larger move of the bullet volume below the mouth over the bracket, relative
 * to the run's volume, when it is above the default; else undefined. `depth` is the seating depth,
 * `volume` the run's volume behind the bullet, both SI. A typed cavity depth has no bracket.
 */
export function cavityVolumeFraction(
  bullet: Partial<Bullet> | undefined,
  depth: number | undefined,
  volume: number | undefined,
): number | undefined {
  const shape = bullet && bulletDimensions(bullet as Bullet)
  if (!shape || depth === undefined || !(volume !== undefined && volume > 0)) return
  const cut = Math.min(Math.max(fromSi('length', depth), 0), shape.length)
  const bracket = cavityVolumeBracket(shape, cut)
  const outline = bulletOutline(shape)
  if (!bracket || 'reason' in outline) return
  const nominal = revolutionVolume(outline.points, cut)
  // mm3 to m3: the cube of one mm in m
  const move = Math.max(nominal - bracket.low, bracket.high - nominal) * toSi('length', 1) ** 3
  const fraction = move / volume
  return fraction > pressureToleranceDefaults.volumeFraction
    ? Math.min(fraction, volumeFractionMax)
    : undefined
}
