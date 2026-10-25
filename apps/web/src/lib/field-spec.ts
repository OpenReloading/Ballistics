/** Form fields: specs, typed text and SI values, validation messages. */
import { fromSi, type QuantityKind, toSi } from '@open-reloading/schema'
import {
  exactFieldText,
  parseTwist,
  type Quantity,
  roundedFieldText,
  type UnitSystem,
} from './units.ts'

/** A form field: the text as typed or converted, and its SI value (undefined while empty or invalid). */
export type FieldValue = { text: string; si: number | undefined }

export interface FieldSpec {
  key: string
  label: string
  /** Field help, shown as the field description. */
  help?: string
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
  initial?: number
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

/** Field state from typed text. */
export function fieldValueFromText(q: Quantity, system: UnitSystem, text: string): FieldValue {
  const x = q === 'twist' ? (parseTwist(text) ?? Number.NaN) : Number(text)
  return {
    text,
    si: text.trim() === '' || !Number.isFinite(x) ? undefined : system[q].toSi(x),
  }
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
 * The validation message of a field, undefined when valid. `min` and `max` are inclusive bounds in
 * display units, as the HTML attributes. The message names the unit of `shown`, the units the field
 * shows (its own unit after an inline switch), not the Settings.
 */
export function fieldError(
  spec: FieldSpec,
  value: FieldValue | undefined,
  shown: UnitSystem,
): string | undefined {
  const text = value?.text.trim() ?? ''
  if (text === '') return spec.required ? `Enter a number for ${spec.label}.` : undefined
  if (value?.si === undefined)
    return spec.quantity === 'twist'
      ? 'Enter a twist as 1:8 or 8.'
      : `Enter a number for ${spec.label}.`
  const symbol = shown[spec.quantity].symbol
  const unit = symbol ? ` ${symbol}` : ''
  const x = spec.quantity === 'twist' ? (parseTwist(text) ?? Number.NaN) : Number(text)
  return rangeError(spec, x, unit)
}

/** The message of the first bound that the number `x` breaks, undefined when it holds them all. */
function rangeError(spec: FieldSpec, x: number, unit: string): string | undefined {
  if (spec.min !== undefined && x < spec.min)
    return `${spec.label} must be at least ${spec.min}${unit}.`
  if (spec.max !== undefined && x > spec.max)
    return `${spec.label} must be at most ${spec.max}${unit}.`
  if (spec.positive && x <= 0) return `${spec.label} must be greater than 0${unit}.`
  if (spec.integer && !Number.isInteger(x)) return `${spec.label} must be a whole number.`
}
