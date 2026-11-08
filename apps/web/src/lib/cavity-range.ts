import { pressureToleranceDefaults } from '@open-reloading/ballistics'

/** The highest volume tolerance the API takes (`tolerances.volumeFraction`). */
const volumeFractionMax = 0.2

/** Widens the range to the hollow base's cavity depth bracket, at most the API's 0.2 (`apps/docs/docs/models/case-capacity.md`, "Cavity depth"). */
export function cavityVolumeFraction(
  range: { low: number; high: number } | undefined,
  volume: number | undefined,
): number | undefined {
  if (!range || !(volume !== undefined && volume > 0)) return
  const move = Math.max(volume - range.low, range.high - volume)
  if (!(move > 0)) return
  return Math.min(pressureToleranceDefaults.volumeFraction + move / volume, volumeFractionMax)
}
