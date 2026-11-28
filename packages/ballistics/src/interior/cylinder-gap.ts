import type { InteriorLeakage } from './model.ts'

/** Discharge coefficient of a revolver's cylinder gap: the low end of 0.7 to 1, the smaller leak and so the higher pressure (`apps/docs/docs/models/interior-leakage-heat.md`, "Cylinder gap"). */
export const cylinderGapDischarge = 0.7

/** The leak of a revolver's cylinder gap `gap` (m) at a bore of diameter `boreDiameter` (m): the area pi d g opens linearly while the bullet base crosses the gap from `exit`, the travel (m) at which the base leaves the cylinder, and stays open to the muzzle at `travel` (m); none for a gap of 0 or one the base does not cross before the muzzle (`apps/docs/docs/models/interior-leakage-heat.md`, "Cylinder gap"). */
export function cylinderGapLeakage({
  boreDiameter,
  gap,
  exit,
  travel,
}: {
  boreDiameter: number
  gap: number
  exit: number
  travel: number
}): InteriorLeakage | undefined {
  if (!(gap > 0) || !(exit + gap < travel)) return undefined
  const area = Math.PI * boreDiameter * gap
  return {
    area: [
      { travel: exit, area: 0 },
      { travel: exit + gap, area },
      { travel, area },
    ],
    discharge: cylinderGapDischarge,
  }
}
