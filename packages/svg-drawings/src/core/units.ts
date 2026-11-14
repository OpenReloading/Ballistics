/** The unit of a figure's length texts; the geometry stays in mm. */
export type LengthUnit = 'mm' | 'in'

/** Radians per degree. */
export const deg = Math.PI / 180

/** mm per unit. */
export const perUnit: Record<LengthUnit, number> = { mm: 1, in: 25.4 }

/**
 * A stored mm value as a label prints it: mm as stored; inches to 4 decimals (the web app's inch
 * digits), without a zero before the point below 1 in, as inch drawings print them.
 */
export const lengthText = (mm: number, unit: LengthUnit = 'mm') =>
  unit === 'mm' ? String(mm) : (mm / perUnit.in).toFixed(4).replace(/^0\./, '.')

/**
 * The longest 1, 2 or 5 times a power of ten of the unit that fits `room` mm, at least 1 mm or
 * 0.1 in; in the unit.
 */
export function scaleLength(room: number, unit: LengthUnit = 'mm') {
  const k = perUnit[unit]
  const e0 = unit === 'mm' ? 0 : -1
  let best = 10 ** e0
  for (let e = e0; e <= 3; e++)
    for (const s of [1, 2, 5]) if (s * 10 ** e * k <= room * 0.5) best = s * 10 ** e
  return Number(best.toPrecision(1))
}

/** The note that names the unit of a figure's length texts, "Dimensions in mm" or "inches". */
export const unitNote = (unit: LengthUnit = 'mm') =>
  `Dimensions in ${unit === 'mm' ? 'mm' : 'inches'}`
