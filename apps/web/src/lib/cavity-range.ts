import { pressureToleranceDefaults } from '@open-reloading/core'

/** The highest volume tolerance the API takes (`tolerances.volumeFraction`). */
const volumeFractionMax = 0.2

/**
 * The volume tolerance of a run whose volume follows the seated bullet, so that the pressure range
 * reaches the cavity depth bracket of a hollow base (`apps/docs/docs/models/case-capacity.md`,
 * "Cavity depth"): the default tolerance plus the larger move of the volume behind the bullet over
 * the bracket (`range`, the `cavityRange` of the seating), relative to that volume (`volume`), at
 * most the 0.2 the API takes; undefined without a bracket. Both m³. A typed cavity depth has no
 * bracket.
 */
export function cavityVolumeFraction(
  range: { low: number; high: number } | undefined,
  volume: number | undefined,
): number | undefined {
  if (!range || !(volume !== undefined && volume > 0)) return
  const move = Math.max(volume - range.low, range.high - volume)
  if (!(move > 0)) return
  return Math.min(pressureToleranceDefaults.volumeFraction + move / volume, volumeFractionMax)
}
