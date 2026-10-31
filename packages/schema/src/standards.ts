import { z } from 'zod'
import { quantityKind } from './units.ts'

/**
 * Method that measured a chamber pressure, which is also the basis a pressure is compared on.
 * `transducer` is the C.I.P. method, `case-contact` a transducer that rests against the outside
 * of the case (the SAAMI method, as maker tables print it), `crusher` a copper crusher. The
 * values are not converted into one another.
 */
export const pressureMethod = z.enum(['transducer', 'piezo', 'case-contact', 'crusher', 'energy'])

/**
 * One value as a standard publishes it: a dimension, a pressure, an energy or a measuring position.
 * Symbols are the standard's own (`L3`, `P1`, `Pmax`), Greek letters spelled out (`alpha`).
 * Inferred type: {@link SpecValue}.
 */
export const specValue = z
  .object({
    side: z
      .enum(['cartridge', 'chamber'])
      .describe(
        'Column the value is printed in. Absent for pressures, energies and measuring positions.',
      )
      .optional(),
    symbol: z.string().min(1).describe("The standard's symbol, for example `L3` or `P1`."),
    quantity: quantityKind.describe('Quantity of the value. `value` is in its stored unit.'),
    value: z
      .number()
      .describe('In the stored unit of `quantity`. Absent when the source prints no single number.')
      .optional(),
    raw: z
      .string()
      .min(1)
      .describe(
        'The value as written when it differs from `value`, for example `1°30\'0"` or `25/30`.',
      )
      .optional(),
    limit: z
      .enum(['max', 'min'])
      .describe(
        'Set when the standard qualifies the value itself (`e min`, `r1 max`). Otherwise the column applies: cartridge values are maxima, chamber values minima.',
      )
      .optional(),
    tolerance: z
      .object({
        lower: z.number().max(0).describe('Lower deviation, 0 or below.').optional(),
        upper: z.number().min(0).describe('Upper deviation, 0 or above.').optional(),
      })
      .describe(
        'Signed deviations from `value` as printed, in its unit, for example `{ lower: -0.2 }`.',
      )
      .optional(),
    variant: z
      .string()
      .min(1)
      .describe('Sub-case the standard distinguishes, such as a chamber length marking (`12/70`).')
      .optional(),
    basic: z.boolean().describe('Printed as a basic dimension.').optional(),
    footnotes: z
      .array(z.string().min(1))
      .min(1)
      .describe('Footnote numbers printed next to the symbol.')
      .optional(),
  })
  .refine((v) => v.value !== undefined || v.raw !== undefined, {
    message: 'a value needs value or raw',
  })

/** A plausibility finding that was reviewed and kept, with the reason. */
export const plausibilityException = z.object({
  finding: z.string().min(1),
  note: z.string().min(1),
})

/** One printed standard value: symbol, quantity kind, value in the stored unit, limit, tolerance. */
export interface SpecValue extends z.infer<typeof specValue> {}
