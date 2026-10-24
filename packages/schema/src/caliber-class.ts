import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { positiveLength } from './shared.ts'

/**
 * A caliber class: a group of cartridges whose bullets have the same diameter, so a hole size
 * separates .22, 9 mm and .45 and cannot separate classes of one diameter (9 mm Luger and
 * .357 Magnum). A caliber range of a rule book names more than one class per discipline
 * (`Discipline.caliberClasses` with basis `derived`). Membership is checked against the C.I.P.
 * records by `data:validate`. Model: `apps/docs/docs/data/federations.md`.
 * Inferred type: {@link CaliberClass}.
 */
export const caliberClass = z.strictObject({
  /** Id used in the `caliberClasses` of a `Discipline`. */
  id: recordId,
  /** Name as a shooter says it. */
  name: z.string().min(1),
  /**
   * Nominal bullet diameter. For cartridges it is the maximum projectile diameter G1 of the
   * cartridge side of the CIP sheet (the heading "Projectile" of the sheet layout); .22 rimfire
   * takes the calibre 5.6 mm of the rule books, since G1 of the .22 Long Rifle sheet equals the case
   * diameter H2 (heeled bullet). Airgun pellets carry the calibre of the rule book.
   */
  diameter: positiveLength(),
  /** Ids of the cartridge records in the class; empty where the class has no CIP cartridge. */
  cartridges: z.array(recordId),
  provenance,
})

/** A caliber class record: name, nominal bullet diameter and the member cartridges. */
export interface CaliberClass extends z.infer<typeof caliberClass> {}
