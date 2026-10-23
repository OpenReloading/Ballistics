/** Length of the check ruler on the printed ladder target, mm. */
export const rulerMm = 100

/** Widest mark that fits across the narrowest usual sheet (A5 upright less its margins), mm. */
export const maxMarkMm = 120

/** The printed diameter of a mark of angular size `angle` rad at `distance` m, mm. */
export const markDiameterMm = (distance: number, angle: number) => 1000 * distance * Math.tan(angle)

/** A CSS length that prints as `mm` millimetres at 100 % print scale. */
export const cssMm = (mm: number) => `${Math.round(mm * 100) / 100}mm`

/** One aiming mark of the printed ladder target: the step's own value and the mark's printed diameter, mm. */
export interface LadderMark {
  label: string
  diameter: number
}

/** The marks of a ladder target, one per step in step order; empty for a mark that does not fit a sheet. */
export function ladderMarks(
  labels: readonly string[],
  distance: number,
  angle: number,
): LadderMark[] {
  const diameter = markDiameterMm(distance, angle)
  if (!(diameter > 0 && diameter <= maxMarkMm)) return []
  return labels.map((label) => ({ label, diameter }))
}
