import { z } from 'zod'
import { catalogueRef, recordId, ref } from './ids.ts'
import { type Provenance, provenance } from './provenance.ts'
import { quantity } from './units.ts'

/** Wall materials of a cartridge case. */
export const caseMaterials = z.enum([
  'brass',
  'nickel-plated-brass',
  'lacquered-steel',
  'polymer-coated-steel',
  'aluminium',
])

/** A wall material of {@link caseMaterials}. */
export type CaseMaterial = z.infer<typeof caseMaterials>

/** Primer pocket of a case: Boxer (one central flash hole) or Berdan (the anvil is in the case), and its size as the source names it. */
const primerPocket = z.strictObject({
  type: z
    .enum(['boxer', 'berdan'])
    .describe('Boxer (one central flash hole) or Berdan (the anvil is in the case).'),
  size: z
    .string()
    .min(1)
    .describe('Pocket size as the source states it, for example `large rifle` or `5.5 mm`.')
    .optional(),
})

/**
 * A cartridge case, for one cartridge: the entity of a catalogue record (`records/cases`) as its
 * manufacturer sells it, the user record of kind `case` (a group of cases the user keeps, with
 * their measured values) and the case a load references. A catalogue case carries its `id` (the
 * file name), `manufacturer`, `name`, `productNumber` and `provenance`, and names catalogue records
 * only. `waterCapacity` is the capacity the manufacturer states; a capacity the user measured stays
 * a case capacity record that `capacity` names, and takes precedence.
 * Inferred type: {@link Case}.
 */
export const cartridgeCase = z
  .strictObject({
    id: recordId.describe('Id of a catalogue case, the file name without `.json`.').optional(),
    origin: z
      .enum(['catalogue', 'user', 'shared'])
      .describe('Where the record lives: the git catalogue, this browser, or a received file.'),
    name: z
      .string()
      .min(1)
      .describe('Name of the product as the manufacturer prints it.')
      .optional(),
    manufacturer: ref('manufacturer')
      .describe('The manufacturer of the case. Required of a catalogue case.')
      .optional(),
    cartridge: ref('cartridge'),
    basedOn: catalogueRef('case')
      .describe(
        'The catalogue case product a user case group starts from; its fields stay the record of the product.',
      )
      .optional(),
    productNumber: z.string().min(1).describe('Product number.').optional(),
    headstamp: z
      .string()
      .min(1)
      .describe('Marking on the case head as the source states it.')
      .optional(),
    material: caseMaterials.describe('Wall material of the case.'),
    primerPocket: primerPocket.describe('The primer pocket: its type and size.').optional(),
    flashHole: quantity('length', z.number().positive())
      .describe('Diameter of the flash hole (of each hole in a Berdan pocket).')
      .optional(),
    mass: quantity('mass', z.number().positive()).describe('Mass of the empty case.').optional(),
    waterCapacity: quantity('mass', z.number().positive())
      .describe('Mass of water filling the case to the mouth, as the manufacturer states it.')
      .optional(),
    annealed: z.boolean().describe('Whether the case is delivered annealed.').optional(),
    capacity: ref('case capacity')
      .describe(
        'The case capacity record that holds the water capacity the user measured on these cases.',
      )
      .optional(),
    numberOfFirings: z.int().min(0).describe('Measured: times the cases were fired.').optional(),
    trimLength: quantity('length', z.number().positive())
      .describe('Measured: the length the cases are trimmed to.')
      .optional(),
    neckWall: quantity('length', z.number().positive())
      .describe('Measured: wall thickness of the case neck.')
      .optional(),
    casesMeasured: z
      .int()
      .positive()
      .describe('Measured: the number of cases the measured values come from.')
      .optional(),
    spread: quantity('mass', z.number().nonnegative())
      .describe(
        'Measured: spread (standard deviation) of the water capacity over the cases measured.',
      )
      .optional(),
    note: z.string().min(1).describe('Notes on the product.').optional(),
    provenance: provenance
      .describe('Where the values come from. Required for a catalogue case.')
      .optional(),
  })
  .superRefine((c, ctx) => {
    if (c.origin !== 'catalogue') return
    const issue = (path: PropertyKey[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    for (const k of ['id', 'name', 'manufacturer', 'productNumber', 'provenance'] as const)
      if (c[k] === undefined) issue([k], `A catalogue case needs ${k === 'id' ? 'an' : 'a'} ${k}`)
    for (const k of ['cartridge', 'manufacturer', 'capacity'] as const)
      if (c[k] !== undefined && !c[k].startsWith('catalogue:'))
        issue([k], 'A catalogue case names catalogue records only')
  })

/** A case of the catalogue (`records/cases`): {@link cartridgeCase} with `origin` `catalogue`. */
export const catalogueCase: z.ZodType<CatalogueCase> = cartridgeCase.refine(
  (c): c is CatalogueCase => c.origin === 'catalogue',
  { message: 'A catalogue record has origin catalogue', path: ['origin'] },
)

/** A cartridge case: a product, or a group of the user's cases with measured values. */
export interface Case extends z.infer<typeof cartridgeCase> {}

/** A case of the catalogue: the fields {@link cartridgeCase} requires of one are present. */
export interface CatalogueCase extends Case {
  id: string
  name: string
  manufacturer: string
  origin: 'catalogue'
  productNumber: string
  provenance: Provenance
}
