import { shownLanguage } from './shown.ts'

/**
 * Numbers in the language shown. Inside the app a number is its canonical text: a point as the
 * decimal mark, no grouping, what `Number(text)` reads. That text is what is stored, linked,
 * exported and sent to the packages. Only the screen writes the language's decimal mark, and only
 * what a person types or pastes is read through {@link parseNumber}.
 */

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

/** A number shown on screen as the canonical text, for a file or the clipboard; other text as it is. */
export function canonicalNumberText(text: string, language = shownLanguage()): string {
  const mark = decimalMark(language)
  return mark !== '.' && new RegExp(`^[+-]?\\d*\\${mark}\\d+$`).test(text)
    ? text.replace(mark, '.')
    : text
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

/** The result of reading typed text as a number. */
export type ParsedNumber =
  | { kind: 'empty' }
  /** `text` is the canonical form of what was typed: the sign, digits, a point and the exponent as given. */
  | { kind: 'number'; value: number; text: string }
  | { kind: 'invalid' }
  /** A lone foreign separator before three digits: `decimal` and `grouped` are the two readings. */
  | { kind: 'ambiguous'; decimal: number; grouped: number }

/** What the field accepts: the bounds in the unit the text is typed in. */
export interface NumberRange {
  min?: number | undefined
  max?: number | undefined
  /** Only whole numbers are valid. */
  integer?: boolean | undefined
}

const shape = /^([+-]?)([\d.,]*\d[\d.,]*)(?:([eE])([+-]?\d{1,4}))?$/
const grouped = (sep: string) => new RegExp(`^\\d{1,3}(?:\\${sep}\\d{3})+$`)

const accepts = (x: number, { min, max, integer }: NumberRange) =>
  (min === undefined || x >= min) &&
  (max === undefined || x <= max) &&
  (!integer || Number.isInteger(x))

/** The canonical mantissa of digits with both marks: the last is the decimal mark, the other groups in threes. */
function withBothMarks(body: string): string[] {
  const at = Math.max(body.lastIndexOf('.'), body.lastIndexOf(','))
  const group = body[at] === '.' ? ',' : '.'
  const [whole, fraction] = [body.slice(0, at), body.slice(at + 1)]
  return grouped(group).test(whole) && /^\d*$/.test(fraction)
    ? [`${whole.replaceAll(group, '')}.${fraction}`]
    : []
}

/**
 * The canonical mantissas the digits and marks of `body` can be read as: none when they are no
 * number, two (the decimal reading first) when a mark could be a decimal mark or a group.
 */
function readings(body: string, own: string): string[] {
  const dots = body.split('.').length - 1
  const commas = body.split(',').length - 1
  if (dots + commas === 0) return [body]
  if (dots > 0 && commas > 0) return withBothMarks(body)
  const sep = dots > 0 ? '.' : ','
  if (dots + commas > 1)
    return sep !== own && grouped(sep).test(body) ? [body.replaceAll(sep, '')] : []
  const [whole = '', fraction = ''] = body.split(sep)
  const decimal = `${whole}.${fraction}`
  return sep !== own && fraction.length === 3 && /^[1-9]\d{0,2}$/.test(whole)
    ? [decimal, whole + fraction]
    : [decimal]
}

/**
 * Reads typed or pasted text. Both marks are accepted whatever the language: "1,5" and "1.5".
 *
 * - Empty text is empty. Letters (a unit), spaces and anything else that is no number are invalid;
 *   an exponent ("1e-3", "1,5E3") is read.
 * - A leading mark (",5"), a trailing mark ("1,") and a sign are read.
 * - With both marks the last one is the decimal mark and the other must group digits in threes
 *   ("1.234,5", "1,234.5").
 * - A mark that repeats groups digits in threes, which the language's own decimal mark never does
 *   ("1.234.567" in German, "1,234,567" in English); else the text is invalid.
 * - The language's own mark, once, is the decimal mark: "1.234" in English and "1,234" in German
 *   are 1.234.
 * - The other mark, once, is a decimal mark ("1,5" in English). With exactly three digits after
 *   it and one to three before ("1,234" in English, "1.234" in German) it could also group: the
 *   reading that falls inside `range` is taken when only one does, else the text is ambiguous.
 */
export function parseNumber(
  input: string,
  range: NumberRange = {},
  language = shownLanguage(),
): ParsedNumber {
  const text = input.trim().replace('\u2212', '-')
  if (text === '') return { kind: 'empty' }
  const m = shape.exec(text)
  if (!m) return { kind: 'invalid' }
  const [, sign = '', body = '', e = '', exp = ''] = m
  const done = (mantissa: string): ParsedNumber => {
    const value = Number(sign + mantissa + e + exp)
    return Number.isFinite(value)
      ? { kind: 'number', value, text: sign + mantissa + e + exp }
      : { kind: 'invalid' }
  }
  const [first, second] = readings(body, decimalMark(language))
  if (first === undefined) return { kind: 'invalid' }
  const decimal = done(first)
  if (second === undefined) return decimal
  // the other mark before three digits: a decimal or a group
  const asGroup = done(second)
  if (decimal.kind !== 'number' || asGroup.kind !== 'number') return decimal
  const [d, g] = [accepts(decimal.value, range), accepts(asGroup.value, range)]
  if (d === g)
    return d ? { kind: 'ambiguous', decimal: decimal.value, grouped: asGroup.value } : decimal
  return d ? decimal : asGroup
}

/** The message for an {@link ParsedNumber} that is ambiguous, in the language shown. */
export const ambiguousMessage = (p: Extract<ParsedNumber, { kind: 'ambiguous' }>) =>
  `Ambiguous: write ${plainNumber(p.decimal)} for a decimal or ${plainNumber(p.grouped)} for a whole number.`
