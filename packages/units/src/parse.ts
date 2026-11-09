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

/** The canonical mantissas the digits and marks of `body` can be read as: none when they are no number, two (the decimal reading first) when a mark could be a decimal mark or a group. */
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

/** Typed or pasted text with either mark, `own` the decimal mark of the language it was typed in: empty text is empty, anything that is no number (a unit, spaces) invalid, an exponent, a leading or trailing mark and a sign are read, with both marks the other must group digits in threes, and a repeated mark groups in threes, which the language's own decimal mark never does; every rule and the ambiguous `1,234` in `apps/docs/docs/translating.md`, "What a typed number means". */
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
