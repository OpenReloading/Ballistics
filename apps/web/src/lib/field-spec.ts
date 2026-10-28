/** Form fields: specs, typed text and SI values, validation messages. */
import { fromSi, type QuantityKind, toSi } from '@open-reloading/schema'
import { ambiguousMessage, type NumberRange, parseNumber, untranslated } from '../i18n/number.ts'
import type { Message, Translator } from '../i18n/translate.ts'
import {
  exactFieldText,
  parseTwist,
  type Quantity,
  roundedFieldText,
  typedTwist,
  type UnitSystem,
} from './units.ts'

/** A form field: the text as typed or converted, and its SI value (undefined while empty or invalid). */
export type FieldValue = { text: string; si: number | undefined }

export interface FieldSpec {
  key: string
  label: string
  /** Field help, shown as the field description. */
  help?: string | undefined
  quantity: Quantity
  required?: boolean
  /** Bounds in display units, only where they hold in every unit of the quantity. */
  min?: number
  max?: number
  /** The value must be greater than 0. */
  positive?: boolean
  /** The value must be a whole number. */
  integer?: boolean
  /** Initial SI value. */
  initial?: number | undefined
}

export type Fields = Record<string, FieldValue>

/** The stored quantity (mm, g, degrees, 1) of each quantity of a designer field. */
const storedKind = {
  length: 'length',
  mass: 'mass',
  angle: 'angle',
  ratio: 'dimensionless',
} as const satisfies Partial<Record<Quantity, QuantityKind>>

/** A designer field value in its stored unit, in SI. */
export const storedToSi = (q: keyof typeof storedKind, stored: number) =>
  toSi(storedKind[q], stored)

/** A designer field value in SI, in its stored unit. */
export const siToStored = (q: keyof typeof storedKind, si: number) => fromSi(storedKind[q], si)

/** A designer field of SI value `si`, its text rounded; empty without a value. */
export const fieldOf = (system: UnitSystem, s: FieldSpec, si: number | undefined): FieldValue => ({
  text: si === undefined ? '' : roundedFieldText(s.quantity, system, si),
  si,
})

/** Whether `a` equals `b` but for the noise of a unit round-trip; false without `b`. */
export const close = (a: number, b: number | undefined) =>
  b !== undefined && Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(b), 1e-12)

/** The range a field's typed text is read against: the bounds of its spec. */
export const rangeOf = (spec: FieldSpec): NumberRange => ({
  min: spec.min,
  max: spec.max,
  integer: spec.integer,
})

/**
 * Field state from canonical text (a point as the decimal mark, what the app stores and
 * generates). Text a person typed goes through {@link typedFieldValue}.
 */
export function fieldValueFromText(q: Quantity, system: UnitSystem, text: string): FieldValue {
  const x = q === 'twist' ? (parseTwist(text) ?? Number.NaN) : Number(text)
  return {
    text,
    si: text.trim() === '' || !Number.isFinite(x) ? undefined : system[q].toSi(x),
  }
}

/**
 * Field state from text a person typed or pasted: either decimal mark is read ({@link parseNumber}).
 * The state's text is the canonical form; text that is no number stays as typed, with no value.
 */
export function typedFieldValue(
  q: Quantity,
  system: UnitSystem,
  raw: string,
  range: NumberRange = {},
): FieldValue {
  if (q === 'twist') {
    const text = typedTwist(raw)
    return text === undefined ? { text: raw, si: undefined } : fieldValueFromText(q, system, text)
  }
  const p = parseNumber(raw, range)
  return p.kind === 'number' ? fieldValueFromText(q, system, p.text) : { text: raw, si: undefined }
}

export function initialFields(
  specs: readonly FieldSpec[],
  system: UnitSystem,
  /** The field texts: `roundedFieldText` in the calculators. */
  text: typeof exactFieldText = exactFieldText,
): Fields {
  return Object.fromEntries(
    specs.map((s) => [
      s.key,
      { text: s.initial === undefined ? '' : text(s.quantity, system, s.initial), si: s.initial },
    ]),
  )
}

/** Rewrites each field's text in `system` from its SI value; SI values stay unchanged. */
export function switchFields(
  fields: Fields,
  specs: readonly FieldSpec[],
  system: UnitSystem,
  text: typeof exactFieldText = exactFieldText,
): Fields {
  const next = { ...fields }
  for (const s of specs) {
    const f = fields[s.key]
    if (f?.si !== undefined) next[s.key] = { text: text(s.quantity, system, f.si), si: f.si }
  }
  return next
}

/** Map of field key to its SI number (`FieldValue.si`), undefined where the text does not parse. */
export function siValues(fields: Fields): Record<string, number | undefined> {
  return Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.si]))
}

/**
 * The text of a spec's `label` or `help` in the language of `t`. A spec marks its texts as messages
 * where it is defined, so the catalogue has them.
 */
export const specText = (t: Translator['t'], text: string) => t(text as Message)

/**
 * The validation message of a field in the language of `t` (English without one), undefined when
 * valid. `min` and `max` are inclusive bounds in display units, as the HTML attributes. The message
 * names the unit of `shown`, the units the field shows (its own unit after an inline switch), not
 * the Settings.
 */
export function fieldError(
  spec: FieldSpec,
  value: FieldValue | undefined,
  shown: UnitSystem,
  t: Translator['t'] = untranslated(),
): string | undefined {
  const text = value?.text.trim() ?? ''
  const label = specText(t, spec.label)
  if (text === '') return spec.required ? t('Enter a number for {label}.', { label }) : undefined
  if (value?.si === undefined) {
    if (spec.quantity === 'twist') return t('Enter a twist as 1:8 or 8.')
    const p = parseNumber(text, rangeOf(spec))
    return p.kind === 'ambiguous'
      ? ambiguousMessage(p, t)
      : t('Enter a number for {label}.', { label })
  }
  const symbol = shown[spec.quantity].symbol
  const unit = symbol ? ` ${symbol}` : ''
  const x = spec.quantity === 'twist' ? (parseTwist(text) ?? Number.NaN) : Number(text)
  return rangeError(spec, label, x, unit, t)
}

/** The message of the first bound that the number `x` breaks, undefined when it holds them all. */
function rangeError(
  spec: FieldSpec,
  label: string,
  x: number,
  unit: string,
  t: Translator['t'],
): string | undefined {
  if (spec.min !== undefined && x < spec.min)
    return t('{label} must be at least {min}{unit}.', { label, min: spec.min, unit })
  if (spec.max !== undefined && x > spec.max)
    return t('{label} must be at most {max}{unit}.', { label, max: spec.max, unit })
  if (spec.positive && x <= 0) return t('{label} must be greater than 0{unit}.', { label, unit })
  if (spec.integer && !Number.isInteger(x)) return t('{label} must be a whole number.', { label })
}
