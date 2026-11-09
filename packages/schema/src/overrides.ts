import { z } from 'zod'
import { bullet } from './bullet.ts'
import { cartridge } from './cartridge.ts'
import type { Exact } from './exact.ts'
import { isPlain, type Plain } from './plain.ts'
import { type Powder, powder } from './powder.ts'
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

/** The key a value of a cartridge's `values` has: side, symbol and variant. */
export const valueKey = (v: { side?: string; symbol: string; variant?: string }): string =>
  JSON.stringify([v.side ?? null, v.symbol, v.variant ?? null])

/** A spec value: its key and its value. */
type Keyed = Parameters<typeof valueKey>[0] & { value?: unknown }

/** A spec value with a `value` of `null` removes the value of its key. */
const removes = (v: { value?: unknown }) => v.value === null

function mergeValues(base: Keyed[], over: Keyed[]): Keyed[] {
  const given = new Map(over.map((v) => [valueKey(v), v]))
  const kept = base.flatMap((v) => {
    const key = valueKey(v)
    const o = given.get(key)
    given.delete(key)
    if (o === undefined) return [v]
    return removes(o) ? [] : [o]
  })
  return [...kept, ...[...given.values()].filter((v) => !removes(v))]
}

function merge(base: unknown, over: object): Plain {
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
 * entry whose `value` is `null` removes that value. Behind every user variant of a catalogue record
 * (`basedOn` with `overrides`). Overrides on an empty base give a record of the overridden fields
 * alone.
 */
export function applyOverrides<T extends object>(base: T, overrides: object | null | undefined): T {
  if (!overrides) return base
  const merged = merge(base, overrides)
  const values: unknown = Reflect.get(base, 'values')
  const over: unknown = Reflect.get(overrides, 'values')
  if (Array.isArray(over))
    merged['values'] = Array.isArray(values)
      ? mergeValues(values, over)
      : over.filter((v: Keyed) => !removes(v))
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- overrides are a partial of T, so the merge has its fields
  return merged as T
}

/** The description of a field, also when it was given before the field was made optional. */
const descriptionOf = (v: z.ZodType) =>
  v.description ??
  (v instanceof z.ZodOptional ? z.globalRegistry.get(v.unwrap())?.description : undefined)

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

/** Every field optional and nullable, nested objects likewise; rules across fields (`superRefine`) are dropped, as an override is a part of a record; a field without a description gets one from its path; with `bare` a number has no bounds (the draft of a record in the making). */
function overridesOf(
  schema: z.ZodType,
  record: string,
  path: string[] = [],
  bare = false,
): z.ZodType {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every schema here is built with the classic API
  const inner = schema instanceof z.ZodOptional ? (schema.unwrap() as z.ZodType) : schema
  // a draft holds what was typed, so a number loses the bounds the finished record has
  if (bare && inner instanceof z.ZodNumber) return z.number()
  if (inner instanceof z.ZodArray && inner.element instanceof z.ZodObject)
    return z.array(describedFields(inner.element, record, [...path, '[]']))
  if (!(inner instanceof z.ZodObject)) return inner
  return z.object(
    Object.fromEntries(
      Object.entries(inner.shape as Record<string, z.ZodType>).map(([k, v]) => {
        const at = [...path, k]
        return [
          k,
          overridesOf(v, record, at, bare)
            .nullable()
            .optional()
            .describe(describeAt(descriptionOf(v), record, at)),
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

const {
  id: _powderId,
  manufacturer: _powderManufacturer,
  name: _powderName,
  country: _powderCountry,
  provenance: _powderProvenance,
  composition: _powderComposition,
  listedCartridges: _powderListed,
  ...powderShape
} = powder.shape

/** `A` when `A` and `B` are the same type, optional keys included (which mutual assignability misses), else `never`. */
/* oxlint-disable typescript/no-unnecessary-type-parameters -- the identity test compares two generic signatures, so each G appears once */
type Identical<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? A : never
/* oxlint-enable typescript/no-unnecessary-type-parameters */

const compositionDraftParser = z.object({
  name: z
    .string()
    .describe('Name of the ingredient as the safety data sheet prints it.')
    .optional(),
  cas: z.string().describe('CAS registry number of the ingredient.').optional(),
  min: z.number().describe('Lower end of the mass percent range.').optional(),
  max: z.number().describe('Upper end of the mass percent range.').optional(),
})

/** One ingredient of a powder draft: the printed name, CAS number and mass percent range, each still optional. */
const compositionDraft: z.ZodObject<{
  name: z.ZodOptional<z.ZodString>
  cas: z.ZodOptional<z.ZodString>
  min: z.ZodOptional<z.ZodNumber>
  max: z.ZodOptional<z.ZodNumber>
}> = compositionDraftParser satisfies Exact<typeof compositionDraft, typeof compositionDraftParser>

/**
 * The fields of a powder in the powder designer while the draft is unfinished: any of the powder
 * record's fields but `id`, `manufacturer`, `name`, `country`, `provenance` and `listedCartridges`
 * (it needs a source naming it, which the designer does not write), every one optional, nested
 * objects likewise, in stored units, the numbers without the powder record's bounds (a half-typed
 * value stays in the draft). The designer builds a {@link Powder} from it and checks that against
 * `powder`.
 * Inferred type: {@link PowderDraft}.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- overridesOf builds the schema at run time, so its type is stated here
export const powderDraft = overridesOf(
  z.object({
    ...powderShape,
    // the entry type PowderDraft writes out is that of compositionDraft, or the type resolves to never
    composition: z.array(compositionDraft).max(40) satisfies z.ZodType<
      Identical<NonNullable<PowderDraft['composition']>[number], z.infer<typeof compositionDraft>>[]
    >,
  }),
  'powder',
  [],
  true,
) as z.ZodType<PowderDraft>

/**
 * The overrides of a bullet record: any of its fields but `id`, `manufacturer` (the user bullet's
 * own `manufacturer`) and `provenance`, in the stored units, `null` removes a field.
 * Inferred type: {@link BulletOverrides}.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- overridesOf builds the schema at run time, so its type is stated here
export const bulletOverrides = overridesOf(z.object(bulletShape), 'bullet') as z.ZodType<
  Overrides<Omit<z.infer<typeof bullet>, 'id' | 'manufacturer' | 'provenance'>>
>

const cartridgeValueOverrideParser = z
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
 * One entry of the `values` of {@link cartridgeOverrides}: a whole spec value that replaces the one
 * with its side, symbol and variant, or, with a `value` of `null`, removes it.
 */
export const cartridgeValueOverride: z.ZodObject<
  Omit<(typeof specValue)['shape'], 'value'> & {
    value: z.ZodOptional<z.ZodNullable<z.ZodNumber>>
  }
> = cartridgeValueOverrideParser satisfies Exact<
  typeof cartridgeValueOverride,
  typeof cartridgeValueOverrideParser
>

/**
 * The overrides of a cartridge record: any of its fields but `id` and `provenance`, in the stored
 * units, `null` removes a field. `values` lists the values to replace, add or remove.
 * Inferred type: {@link CartridgeOverrides}.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- overridesOf builds the schema at run time, so its type is stated here
export const cartridgeOverrides = overridesOf(
  z.object({ ...cartridgeShape, values: z.array(cartridgeValueOverride).max(500) }),
  'cartridge',
) as z.ZodType<
  Overrides<Omit<z.infer<typeof cartridge>, 'id' | 'provenance' | 'values'>> & {
    values?: z.infer<typeof cartridgeValueOverride>[]
  }
>

/** The fields of a powder in the powder designer: a partial of {@link Powder} in stored units. */
export type PowderDraft = Overrides<
  Omit<
    Powder,
    'id' | 'manufacturer' | 'name' | 'country' | 'provenance' | 'composition' | 'listedCartridges'
  >
> & {
  composition?:
    | {
        name?: string | undefined
        cas?: string | undefined
        min?: number | undefined
        max?: number | undefined
      }[]
    | null
}
/** The overrides of a bullet: a partial of {@link Bullet} in stored units. */
export type BulletOverrides = z.infer<typeof bulletOverrides>
/** The overrides of a cartridge: a partial of {@link Cartridge} in stored units. */
export type CartridgeOverrides = z.infer<typeof cartridgeOverrides>
