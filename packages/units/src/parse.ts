/** The decimal mark of a language: the language's own reading of a lone mark. */
export type DecimalMark = '.' | ','

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

const shape = /^([+-]?)([\d.,]+)(?:([eE])([+-]?\d{1,4}))?$/
const grouped = (sep: string) => new RegExp(`^\\d{1,3}(?:\\${sep}\\d{3})+$`)

const accepts = (x: number, { min, max, integer }: NumberRange) =>
  (min === undefined || x >= min) &&
  (max === undefined || x <= max) &&
  (integer !== true || Number.isInteger(x))

/** The canonical mantissa of digits with both marks: the last is the decimal mark, the other groups in threes. */
function withBothMarks(body: string): string[] {
  const at = Math.max(body.lastIndexOf('.'), body.lastIndexOf(','))
  const group = body[at] === '.' ? ',' : '.'
  const [whole, fraction] = [body.slice(0, at), body.slice(at + 1)]
  return grouped(group).test(whole) && /^\d*$/.test(fraction)
    ? [`${whole.replaceAll(group, '')}.${fraction}`]
    : []
}

/** The readings of digits with one mark once: a decimal, and a group when the other mark stands before three digits. */
function withOneMark(body: string, sep: string, own: DecimalMark): string[] {
  const [whole = '', fraction = ''] = body.split(sep)
  const decimal = `${whole}.${fraction}`
  return sep !== own && fraction.length === 3 && /^[1-9]\d{0,2}$/.test(whole)
    ? [decimal, whole + fraction]
    : [decimal]
}

/**
 * The canonical mantissas the digits and marks of `body` can be read as: none when they are no
 * number, two (the decimal reading first) when a mark could be a decimal mark or a group.
 */
function readings(body: string, own: DecimalMark): string[] {
  const dots = body.split('.').length - 1
  const commas = body.split(',').length - 1
  if (dots + commas === 0) return [body]
  if (dots > 0 && commas > 0) return withBothMarks(body)
  const sep = dots > 0 ? '.' : ','
  if (dots + commas === 1) return withOneMark(body, sep, own)
  return sep !== own && grouped(sep).test(body) ? [body.replaceAll(sep, '')] : []
}

/** The decimal reading, or the group reading when only that falls inside `range`, or both when both do. */
function settle(decimal: ParsedNumber, asGroup: ParsedNumber, range: NumberRange): ParsedNumber {
  if (decimal.kind !== 'number' || asGroup.kind !== 'number') return decimal
  const d = accepts(decimal.value, range)
  if (d === accepts(asGroup.value, range))
    return d ? { kind: 'ambiguous', decimal: decimal.value, grouped: asGroup.value } : decimal
  return d ? decimal : asGroup
}

/**
 * Reads typed or pasted text. Both marks are accepted whatever the language: "1,5" and "1.5".
 * `own` is the decimal mark of the language the text was typed in.
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
  own: DecimalMark,
  range: NumberRange = {},
): ParsedNumber {
  const text = input.trim().replace('−', '-')
  if (text === '') return { kind: 'empty' }
  const [, sign = '', body = '', e = '', exp = ''] = shape.exec(text) ?? []
  if (!/\d/.test(body)) return { kind: 'invalid' }
  const done = (mantissa: string | undefined): ParsedNumber => {
    const value = Number(sign + mantissa + e + exp)
    return mantissa !== undefined && Number.isFinite(value)
      ? { kind: 'number', value, text: sign + mantissa + e + exp }
      : { kind: 'invalid' }
  }
  const [first, second] = readings(body, own)
  return second === undefined ? done(first) : settle(done(first), done(second), range)
}
