import table from './advances.json' with { type: 'json' }
import * as face from './face.ts'
import { type LengthUnit, lengthText } from './units.ts'

const advances: Record<string, number> = table.advances
/** Advance of a character not in the table, in em. */
export const fallbackAdvance = 0.62

/** Width of a text in the drawing font at `em`, without kerning (the drawing CSS turns it off). */
export const textWidth = (text: string, em: number) =>
  [...text].reduce((sum, c) => sum + (advances[c] ?? fallbackAdvance), 0) * em

/** The angle symbols as the drawing prints them; the values tables print them the same. */
export const greek: Record<string, string> = { alpha: 'α', alpha1: 'α1', beta: 'β', delta: 'δ' }

/**
 * Diameter sign, symbol and value in `unit`; derived values in parentheses; angles in decimal
 * degrees; the ratio Rt/R as stored. `fixed`: lengths in the unit's fixed decimals (mm 2, in 4).
 */
export function labelText(
  d: { kind: string; symbol: string; value: number; derived?: true },
  unit: LengthUnit = 'mm',
  fixed = false,
) {
  if (d.kind === 'angle') {
    return `${greek[d.symbol] ?? d.symbol} ${angleText(d.value)}`
  }
  const value =
    d.symbol === 'Rt/R'
      ? String(d.value)
      : fixed && unit === 'mm'
        ? fixedMm(d.value)
        : lengthText(d.value, unit)
  const text = `${d.kind === 'diameter' ? face.diameterSign : ''}${d.symbol} ${value}`
  return d.derived ? `(${text})` : text
}

/**
 * A length in mm to 2 decimals, rounded as its decimal text reads (2.675 to 2.68, where `toFixed`
 * rounds the binary value down), the zeros kept.
 */
function fixedMm(mm: number) {
  // a number written with an exponent (1e-7) has no decimal text to round
  if (String(mm).includes('e')) return mm.toFixed(2)
  return Number(`${Math.round(Number(`${mm}e2`))}e-2`).toFixed(2)
}

/** Decimal degrees with up to four decimals, as the values tables print them: 40°, 71.4331°. */
export function angleText(degrees: number) {
  return `${Number(degrees.toFixed(4))}°`
}
