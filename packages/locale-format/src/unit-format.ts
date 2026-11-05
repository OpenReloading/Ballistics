import type { Quantity, UnitSystem } from './display-units.ts'
import { decimalMark, formatNumber } from './number.ts'

/**
 * A formatted number in the unit `symbol`: inch values below 1 without the zero before the decimal
 * mark (".308", "-.25", as the drawings print them; English only: German writes the zero) and a
 * zero as "0"; other units unchanged. Takes the text with either mark.
 */
export function inchText(text: string, symbol: string, language: string): string {
  if (symbol !== 'in') return text
  if (/^-?0[.,]0*$/.test(text)) return '0'
  return decimalMark(language) === '.' ? text.replace(/^(-?)0\./, '$1.') : text
}

/** An SI value in the unit of `q` in `system`, without the symbol. */
export function formatQuantity(
  q: Quantity,
  system: UnitSystem,
  si: number,
  language: string,
): string {
  const unit = system[q]
  return inchText(formatNumber(unit.fromSi(si), unit.decimals, language), unit.symbol, language)
}

/** An SI value in the unit of `q` in `system`, with the unit's symbol. */
export const withUnit = (q: Quantity, system: UnitSystem, si: number, language: string): string =>
  `${formatQuantity(q, system, si, language)} ${system[q].symbol}`

/** A time in s as milliseconds with 3 decimals: "1.234 ms". */
export const msText = (s: number, language: string): string =>
  `${formatNumber(s * 1e3, 3, language)} ms`

/** A fraction as a percentage with 1 decimal: "12.5 %". */
export const percentText = (fraction: number, language: string): string =>
  `${formatNumber(fraction * 100, 1, language)} %`

/** A bullet's travel in the bore or a diameter: the workbench shows each with its own decimals. */
export type LengthKind = 'travel' | 'diameter'

const lengthDigits: Record<LengthKind, Readonly<Record<string, number>>> = {
  travel: { mm: 1, in: 2 },
  diameter: { mm: 2, in: 3 },
}

/** A length in the display unit of `system` with the workbench decimals of its kind, without the symbol. */
export function lengthText(
  kind: LengthKind,
  system: UnitSystem,
  si: number,
  language: string,
): string {
  const unit = system.length
  return formatNumber(unit.fromSi(si), lengthDigits[kind][unit.symbol] ?? unit.decimals, language)
}

/** A length in the display unit of `system` with the workbench decimals of its kind, and the symbol. */
export function shownLength(
  kind: LengthKind,
  system: UnitSystem,
  si: number,
  language: string,
): string {
  const { symbol } = system.length
  return `${inchText(lengthText(kind, system, si, language), symbol, language)} ${symbol}`
}
