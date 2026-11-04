import {
  type NumberRange,
  type ParsedNumber,
  parseNumber as parseWithMark,
} from '@open-reloading/units'
import { shownLanguage } from './shown.ts'
import { type Translator, translator } from './translate.ts'

/**
 * Numbers in the language shown. Inside the app a number is its canonical text: a point as the
 * decimal mark, no grouping, what `Number(text)` reads. That text is what is stored, linked,
 * exported and sent to the packages. Only the screen writes the language's decimal mark, and only
 * what a person types or pastes is read through {@link parseNumber}.
 */

export type { NumberRange, ParsedNumber }

const marks = new Map<string, '.' | ','>()

/** The decimal mark of `language` ("." or ","); the language shown by default. */
export function decimalMark(language = shownLanguage()): '.' | ',' {
  let mark = marks.get(language)
  if (!mark) {
    const part = new Intl.NumberFormat(language)
      .formatToParts(1.1)
      .find((p) => p.type === 'decimal')
    mark = part?.value === ',' ? ',' : '.'
    marks.set(language, mark)
  }
  return mark
}

/**
 * A canonical number text on screen: its point written as the language's decimal mark. A text with
 * no point or more than one (not a number) stays as it is, English always.
 */
export function localizeNumber(text: string, language = shownLanguage()): string {
  const mark = decimalMark(language)
  return mark === '.' || text.split('.').length !== 2 ? text : text.replace('.', mark)
}

/**
 * Text made of numbers written with a point (built on the server, which writes English): each
 * point between digits written as the language's decimal mark. For text that is only numbers and
 * their units: a name or an identifier such as "2.21.1" is no such text.
 */
export function localizeDecimals(text: string, language = shownLanguage()): string {
  const mark = decimalMark(language)
  return mark === '.' ? text : text.replace(/(?<=\d)\.(?=\d)/g, mark)
}

/**
 * Text of numbers and their units as shown on screen ("2,40 gr"), with each decimal mark between
 * digits written as a point, for a file or the clipboard: the inverse of {@link localizeDecimals}.
 */
export function canonicalNumberText(text: string, language = shownLanguage()): string {
  const mark = decimalMark(language)
  return mark === '.' ? text : text.replaceAll(new RegExp(`(?<=\\d)\\${mark}(?=\\d)`, 'g'), '.')
}

const formats = new Map<string, Intl.NumberFormat>()

/** `x` with exactly `digits` decimals, no grouping and no minus sign on a value that rounds to 0. */
export function formatNumber(x: number, digits: number, language = shownLanguage()): string {
  const key = `${language}:${digits}`
  let format = formats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(language, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: 'negative',
      useGrouping: false,
    })
    formats.set(key, format)
  }
  return format.format(x)
}

/** `x.toFixed(digits)` on screen: the same digits, the language's decimal mark. */
export const fixedNumber = (x: number, digits: number, language = shownLanguage()) =>
  localizeNumber(x.toFixed(digits), language)

/** A number as `String(x)` writes it, on screen. */
export const plainNumber = (x: number, language = shownLanguage()) =>
  localizeNumber(String(x), language)

/**
 * Reads typed or pasted text with either decimal mark; the mark of `language` settles a lone mark
 * before three digits (`parseNumber` of `@open-reloading/units` has the rules).
 */
export const parseNumber = (
  input: string,
  range: NumberRange = {},
  language = shownLanguage(),
): ParsedNumber => parseWithMark(input, decimalMark(language), range)

/**
 * English text with its numbers in the language shown: what a caller that has no `t` gets, as
 * before its text was translated.
 */
export const untranslated = (): Translator['t'] => translator({}, shownLanguage()).t

/** The message for an {@link ParsedNumber} that is ambiguous, in the language of `t`. */
export const ambiguousMessage = (
  p: Extract<ParsedNumber, { kind: 'ambiguous' }>,
  t: Translator['t'] = untranslated(),
) =>
  t('Ambiguous: write {decimal} for a decimal or {grouped} for a whole number.', {
    decimal: p.decimal,
    grouped: p.grouped,
  })
