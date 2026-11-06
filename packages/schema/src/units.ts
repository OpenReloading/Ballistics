import {
  fromSi as brandedFromSi,
  toSi as brandedToSi,
  type QuantityKind,
  units,
} from '@open-reloading/units'
import { z } from 'zod'
import type { Exact } from './exact.ts'

export {
  type QuantityKind,
  type SiMap,
  type StoredUnits,
  siMaps,
  units,
} from '@open-reloading/units'

// unbranded, as before the table moved: the branded forms are those of @open-reloading/units
/** A value of quantity `kind` in its stored unit, in SI. */
export const toSi: (kind: QuantityKind, stored: number) => number = brandedToSi

/** A value of quantity `kind` in SI, in its stored unit: the inverse of {@link toSi}. */
export const fromSi: (kind: QuantityKind, si: number) => number = brandedFromSi

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.keys loses the key type: these are the keys of units
const quantityKindParser = z.enum(Object.keys(units) as [QuantityKind, ...QuantityKind[]])

/** Schema of a {@link QuantityKind}: one of the keys of {@link units}, such as `length` or `pressure`. */
export const quantityKind: z.ZodEnum<z.core.util.ToEnum<QuantityKind>> =
  quantityKindParser satisfies Exact<typeof quantityKind, typeof quantityKindParser>

/** The schema {@link quantity} returns. */
export type QuantitySchema = z.ZodObject<{ value: z.ZodNumber; raw: z.ZodOptional<z.ZodString> }>

/**
 * A value in the unit of its quantity, plus the value as written in the source when it differed.
 * `value` may carry bounds (`z.number().positive()`), which the JSON Schema keeps.
 */
export function quantity(kind: QuantityKind, value: z.ZodNumber = z.number()): QuantitySchema {
  const schema = z
    .object({
      value: value.describe(`In ${units[kind]}.`),
      raw: z
        .string()
        .min(1)
        .describe('The value as written in the source, when it differed.')
        .optional(),
    })
    .meta({ unit: units[kind] })
  return schema satisfies Exact<QuantitySchema, typeof schema>
}

/**
 * Type of the object {@link quantity} returns: `value` in the stored unit and the optional source
 * text `raw`.
 */
export type QuantityValue = z.infer<ReturnType<typeof quantity>>
