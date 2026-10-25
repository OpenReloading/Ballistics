import { z } from 'zod'
import { bullet } from './bullet.ts'
import { cartridge } from './cartridge.ts'
import { specValue } from './standards.ts'

/**
 * The overrides of a record of type `T`: a partial of its fields, nested objects likewise. An
 * explicit `null` removes a field. Arrays are given whole.
 */
export type Overrides<T> = T extends readonly unknown[]
  ? T | null
  : T extends object
    ? { [K in keyof T]?: Overrides<T[K]> } | null
    : T | null

type Plain = Record<string, unknown>

const isPlain = (x: unknown): x is Plain => typeof x === 'object' && x !== null && !Array.isArray(x)

/** The key a value of a cartridge's `values` has: side, symbol and variant. */
export const valueKey = (v: { side?: string; symbol: string; variant?: string }) =>
  JSON.stringify([v.side ?? null, v.symbol, v.variant ?? null])

/** A spec value with a `value` of `null` removes the value of its key. */
const removes = (v: Plain) => v.value === null

function mergeValues(base: Plain[], over: Plain[]): Plain[] {
  const given = new Map(over.map((v) => [valueKey(v as Parameters<typeof valueKey>[0]), v]))
  const kept = base.flatMap((v) => {
    const key = valueKey(v as Parameters<typeof valueKey>[0])
    const o = given.get(key)
    given.delete(key)
    return o === undefined ? [v] : removes(o) ? [] : [o]
  })
  return [...kept, ...[...given.values()].filter((v) => !removes(v))]
}

function merge(base: unknown, over: Plain): Plain {
  const out: Plain = isPlain(base) ? { ...base } : {}
  for (const [k, v] of Object.entries(over)) {
    if (v === null) delete out[k]
    // an object with a `value` (a quantity) is one unit: its source text must not outlive the number
    else if (isPlain(v) && !Object.hasOwn(v, 'value')) out[k] = merge(out[k], v)
    else if (v !== undefined) out[k] = v
  }
  return out
}

/**
 * The record `base` with `overrides` applied, a new object. Objects merge by key, arrays replace
 * as a whole, an explicit `null` removes a field. A quantity (an object with a `value`) replaces as
 * a whole. The exception is `values` of a cartridge: its entries are matched by
 * `(side, symbol, variant)`, an entry replaces the one with its key or is added at the end, and an
 * entry whose `value` is `null` removes that value. The one function behind every user variant of
 * a catalogue record (`basedOn` with `overrides`). Overrides on an empty base give a record of the
 * overridden fields alone.
 */
export function applyOverrides<T extends object>(base: T, overrides: object | null | undefined): T {
  if (!overrides) return base
  const over = overrides as Plain
  const merged = merge(base, over)
  const values = (base as Plain).values
  if (Array.isArray(over.values) && Array.isArray(values))
    merged.values = mergeValues(values as Plain[], over.values as Plain[])
  else if (Array.isArray(over.values))
    merged.values = (over.values as Plain[]).filter((v) => !removes(v))
  return merged as T
}

/** The description of a field, also when it was given before the field was made optional. */
const descriptionOf = (v: z.ZodType) =>
  v.description ?? (v instanceof z.ZodOptional ? (v.unwrap() as z.ZodType).description : undefined)

const describeAt = (own: string | undefined, record: string, at: string[]) =>
  own ?? `The \`${at.join('.')}\` of the ${record} record. \`null\` removes it.`

/** An object schema whose fields all have a description, the fields themselves unchanged. */
function describedFields(schema: z.ZodObject, record: string, path: string[]): z.ZodObject {
  // a rebuilt object has lost its refinements: leave one alone that needs nothing
  const shape = schema.shape as Record<string, z.ZodType>
  if (Object.values(shape).every((v) => descriptionOf(v) !== undefined)) return schema
  return z.object(
    Object.fromEntries(
      Object.entries(schema.shape as Record<string, z.ZodType>).map(([k, v]) => [
        k,
        descriptionOf(v) === undefined
          ? v.describe(describeAt(undefined, record, [...path, k]))
          : v,
      ]),
    ),
  )
}

/**
 * The schema of the overrides of `schema`, a part of a `record`: every field optional and nullable,
 * nested objects likewise. Rules across fields (`superRefine`) are dropped, since an override is a
 * part of a record. Arrays and leaves keep their schema. A field without a description gets one
 * from its path.
 */
function overridesOf(schema: z.ZodType, record: string, path: string[] = []): z.ZodType {
  const inner = schema instanceof z.ZodOptional ? (schema.unwrap() as z.ZodType) : schema
  if (inner instanceof z.ZodArray && inner.element instanceof z.ZodObject)
    return z.array(describedFields(inner.element as z.ZodObject, record, [...path, '[]']))
  if (!(inner instanceof z.ZodObject)) return inner
  return z.object(
    Object.fromEntries(
      Object.entries(inner.shape as Record<string, z.ZodType>).map(([k, v]) => {
        const at = [...path, k]
        const own =
          v.description ??
          (v instanceof z.ZodOptional ? (v.unwrap() as z.ZodType).description : undefined)
        return [
          k,
          overridesOf(v, record, at)
            .nullable()
            .optional()
            .describe(
              own ?? `The \`${at.join('.')}\` of the ${record} record. \`null\` removes it.`,
            ),
        ]
      }),
    ),
  )
}

const {
  id: _bulletId,
  provenance: _bulletProvenance,
  manufacturer: _bulletManufacturer,
  ...bulletShape
} = bullet.shape
const {
  id: _cartridgeId,
  provenance: _cartridgeProvenance,
  values: _values,
  ...cartridgeShape
} = cartridge.shape

/**
 * The overrides of a bullet record: any of its fields but `id`, `manufacturer` (the user bullet's
 * own `manufacturer`) and `provenance`, in the stored units, `null` removes a field.
 * Inferred type: {@link BulletOverrides}.
 */
export const bulletOverrides = overridesOf(z.object(bulletShape), 'bullet') as z.ZodType<
  Overrides<Omit<z.infer<typeof bullet>, 'id' | 'manufacturer' | 'provenance'>>
>

/**
 * One entry of the `values` of {@link cartridgeOverrides}: a whole spec value that replaces the one
 * with its side, symbol and variant, or, with a `value` of `null`, removes it.
 */
export const cartridgeValueOverride = z
  .object({
    ...specValue.shape,
    value: z
      .number()
      .nullable()
      .describe(
        'In the stored unit of `quantity`. `null` removes the value of this side, symbol and variant.',
      )
      .optional(),
  })
  .refine((v) => v.value !== undefined || v.raw !== undefined, {
    message: 'a value needs value or raw',
  })

/**
 * The overrides of a cartridge record: any of its fields but `id` and `provenance`, in the stored
 * units, `null` removes a field. `values` lists the values to replace, add or remove.
 * Inferred type: {@link CartridgeOverrides}.
 */
export const cartridgeOverrides = overridesOf(
  z.object({ ...cartridgeShape, values: z.array(cartridgeValueOverride).max(500) }),
  'cartridge',
) as z.ZodType<
  Overrides<Omit<z.infer<typeof cartridge>, 'id' | 'provenance' | 'values'>> & {
    values?: z.infer<typeof cartridgeValueOverride>[]
  }
>

/** The overrides of a bullet: a partial of {@link Bullet} in stored units. */
export type BulletOverrides = z.infer<typeof bulletOverrides>
/** The overrides of a cartridge: a partial of {@link Cartridge} in stored units. */
export type CartridgeOverrides = z.infer<typeof cartridgeOverrides>
