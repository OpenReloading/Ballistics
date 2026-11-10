import { z } from 'zod'
import type { Exact } from './exact.ts'
import { positiveLength } from './fields.ts'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import type { QuantitySchema } from './units.ts'

const caliberClassParser = z.strictObject({
  id: recordId,
  name: z.string().min(1),
  diameter: positiveLength(),
  cartridges: z.array(recordId),
  provenance,
})

/**
 * A caliber class: a group of cartridges whose bullets have the same diameter, so a hole size
 * separates .22, 9 mm and .45 and cannot separate classes of one diameter (9 mm Luger and
 * .357 Magnum). A caliber range of a rule book names more than one class per discipline
 * (`Discipline.caliberClasses` with basis `derived`). Membership is checked against the C.I.P.
 * records by `data:validate`. Model: `apps/docs/docs/data/federations.md`.
 * Inferred type: {@link CaliberClass}.
 */
export const caliberClass: z.ZodObject<
  {
    /** Id used in the `caliberClasses` of a `Discipline`. */
    id: typeof recordId
    /** Name as a shooter says it. */
    name: z.ZodString
    /**
     * Nominal bullet diameter. For cartridges it is the maximum projectile diameter G1 of the
     * cartridge side of the CIP sheet (the heading "Projectile" of the sheet layout); .22 rimfire
     * takes the caliber 5.6 mm of the rule books, since G1 of the .22 Long Rifle sheet equals the case
     * diameter H2 (heeled bullet). Airgun pellets carry the caliber of the rule book.
     */
    diameter: QuantitySchema
    /** Ids of the cartridge records in the class; empty where the class has no CIP cartridge. */
    cartridges: z.ZodArray<typeof recordId>
    /** Where the values of the record come from: a kind and at least one source. */
    provenance: typeof provenance
  },
  z.core.$strict
> = caliberClassParser satisfies Exact<typeof caliberClass, typeof caliberClassParser>

/** A caliber class record. */
export interface CaliberClass extends z.infer<typeof caliberClass> {}
