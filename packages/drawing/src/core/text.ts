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
 * degrees; the ratio Rt/R as stored.
 */
export function labelText(
  d: { kind: string; symbol: string; value: number; derived?: true | undefined },
  unit: LengthUnit = 'mm',
) {
  if (d.kind === 'angle') {
    return `${greek[d.symbol] ?? d.symbol} ${angleText(d.value)}`
  }
  const value = d.symbol === 'Rt/R' ? String(d.value) : lengthText(d.value, unit)
  const text = `${d.kind === 'diameter' ? face.diameterSign : ''}${d.symbol} ${value}`
  return d.derived ? `(${text})` : text
}

/** Decimal degrees with up to four decimals, as the values tables print them: 40°, 71.4331°. */
export function angleText(degrees: number) {
  return `${Number(degrees.toFixed(4))}°`
}
