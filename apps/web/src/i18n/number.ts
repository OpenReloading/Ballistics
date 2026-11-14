import * as locale from '@rangefoundry/locale-format'
import {
  type NumberRange,
  type ParsedNumber,
  parseNumber as parseWithMark,
} from '@rangefoundry/units'
import { shownLanguage } from './shown.ts'
import { type Translator, translator } from './translate.ts'

/** The formatting of `@rangefoundry/locale-format` in the language shown; inside the app a number is its canonical text (a point as the decimal mark, no grouping, what `Number(text)` reads), stored, linked, exported and sent to the packages as such: only the screen writes the language's mark, and only what a person types or pastes is read through {@link parseNumber}. */

export type { NumberRange, ParsedNumber }

/** The decimal mark of `language` ("." or ","); the language shown by default. */
export const decimalMark = (language = shownLanguage()) => locale.decimalMark(language)

/** `localizeNumber` of `@rangefoundry/locale-format`, in the language shown by default. */
export const localizeNumber = (text: string, language = shownLanguage()) =>
  locale.localizeNumber(text, language)

/** `localizeDecimals` of `@rangefoundry/locale-format` for text built on the server, which writes English; in the language shown by default. */
export const localizeDecimals = (text: string, language = shownLanguage()) =>
  locale.localizeDecimals(text, language)

/** `canonicalNumberText` of `@rangefoundry/locale-format`, in the language shown by default. */
export const canonicalNumberText = (text: string, language = shownLanguage()) =>
  locale.canonicalNumberText(text, language)

/** `x` with exactly `digits` decimals, no grouping and no minus sign on a value that rounds to 0. */
export const formatNumber = (x: number, digits: number, language = shownLanguage()) =>
  locale.formatNumber(x, digits, language)

/** `x.toFixed(digits)` on screen: the same digits, the language's decimal mark. */
export const fixedNumber = (x: number, digits: number, language = shownLanguage()) =>
  locale.fixedNumber(x, digits, language)

/** A number as `String(x)` writes it, on screen. */
export const plainNumber = (x: number, language = shownLanguage()) =>
  locale.plainNumber(x, language)

/** Either decimal mark; the mark of `language` settles a lone mark before three digits (`parseNumber` of `@rangefoundry/units` has the rules). */
export const parseNumber = (
  input: string,
  range: NumberRange = {},
  language = shownLanguage(),
): ParsedNumber => parseWithMark(input, decimalMark(language), range)

/** English text with its numbers in the language shown: what a caller that has no `t` gets, as before its text was translated. */
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
