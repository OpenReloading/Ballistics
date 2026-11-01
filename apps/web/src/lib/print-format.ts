import { localizeNumber } from '../i18n/number.ts'
import type { FieldValue } from './field-spec.ts'
import { fixedFieldText, inchText, type Quantity, type UnitSystem } from './units.ts'

/** A number text of the unit `symbol` as the print writes it: the language's mark, ".308" for inches. */
const printed = (text: string, symbol: string) => {
  const local = inchText(localizeNumber(text), symbol)
  return symbol ? `${local} ${symbol}` : local
}

/**
 * An SI value as the print writes it: with the decimals of a workbench field showing it
 * (`fixedFieldText`: 2.8000 in, 71.12 mm, 37.0 gr), the language's mark and the unit.
 */
export const printedValue = (q: Quantity, system: UnitSystem, si: number) =>
  printed(fixedFieldText(q, system, si), system[q].symbol)

/**
 * A field as the print writes it: the text the field shows, so the print has its digits (0.3000 in,
 * not .30 in), with the unit; undefined while empty or not a number.
 */
export function printedField(q: Quantity, system: UnitSystem, v: FieldValue | undefined) {
  if (v?.si === undefined || !Number.isFinite(v.si)) return
  const text = v.text.trim()
  return text ? printed(text, system[q].symbol) : printedValue(q, system, v.si)
}
