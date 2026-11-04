import {
  fromSi as brandedFromSi,
  toSi as brandedToSi,
  type QuantityKind,
  units,
} from '@open-reloading/units'
import { z } from 'zod'

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

/** Schema of a {@link QuantityKind}: one of the keys of {@link units}, such as `length` or `pressure`. */
export const quantityKind = z.enum(Object.keys(units) as [QuantityKind, ...QuantityKind[]])

/**
 * A value in the unit of its quantity, plus the value as written in the source when it differed.
 * `value` may carry bounds (`z.number().positive()`), which the JSON Schema keeps.
 */
export function quantity(kind: QuantityKind, value: z.ZodNumber = z.number()) {
  return z
    .object({
      value: value.describe(`In ${units[kind]}.`),
      raw: z
        .string()
        .min(1)
        .describe('The value as written in the source, when it differed.')
        .optional(),
    })
    .meta({ unit: units[kind] })
}

/**
 * Type of the object {@link quantity} returns: `value` in the stored unit and the optional source
 * text `raw`.
 */
export type QuantityValue = z.infer<ReturnType<typeof quantity>>
