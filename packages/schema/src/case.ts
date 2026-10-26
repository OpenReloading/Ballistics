import { z } from 'zod'
import { recordId, ref } from './ids.ts'
import { type Provenance, provenance } from './provenance.ts'
import { quantity } from './units.ts'

/** Wall materials of a cartridge case: `brass` and `nickel-plated-brass`, steel with a lacquer or a polymer coating, `aluminium`. */
export const caseMaterials = z.enum([
  'brass',
  'nickel-plated-brass',
  'lacquered-steel',
  'polymer-coated-steel',
  'aluminium',
])

/** Primer pocket of a case: Boxer (one central flash hole) or Berdan (the anvil is in the case), and its size as the source names it. */
const primerPocket = z.strictObject({
  type: z.enum(['boxer', 'berdan']),
  size: z
    .string()
    .min(1)
    .describe('Pocket size as the source states it, for example `large rifle` or `5.5 mm`.')
    .optional(),
})

/**
 * A cartridge case as its manufacturer sells it, for one cartridge: the entity of a catalogue record
 * (`records/cases`) and the case a load references. A catalogue case carries its `id` (the file name),
 * `name`, `productNumber` and `provenance`, and names catalogue records only. `waterCapacity` is the
 * capacity the manufacturer states; a capacity the user measured stays a case capacity record and
 * takes precedence.
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
    manufacturer: ref('manufacturer'),
    cartridge: ref('cartridge'),
    productNumber: z.string().min(1).describe('Product number.').optional(),
    headstamp: z
      .string()
      .min(1)
      .describe('Marking on the case head as the source states it.')
      .optional(),
    material: caseMaterials,
    primerPocket: primerPocket.optional(),
    flashHole: quantity('length', z.number().positive())
      .describe('Diameter of the flash hole (of each hole in a Berdan pocket).')
      .optional(),
    mass: quantity('mass', z.number().positive()).describe('Mass of the empty case.').optional(),
    waterCapacity: quantity('mass', z.number().positive())
      .describe('Mass of water filling the case to the mouth, as the manufacturer states it.')
      .optional(),
    annealed: z.boolean().describe('Whether the case is delivered annealed.').optional(),
    note: z.string().min(1).describe('Notes on the product.').optional(),
    provenance: provenance
      .describe('Where the values come from. Required for a catalogue case.')
      .optional(),
  })
  .superRefine((c, ctx) => {
    if (c.origin !== 'catalogue') return
    const issue = (path: PropertyKey[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    for (const k of ['id', 'name', 'productNumber', 'provenance'] as const)
      if (c[k] === undefined) issue([k], `A catalogue case needs ${k === 'id' ? 'an' : 'a'} ${k}`)
    for (const k of ['cartridge', 'manufacturer'] as const)
      if (!c[k].startsWith('catalogue:'))
        issue([k], 'A catalogue case names catalogue records only')
  })

/** A case of the catalogue (`records/cases`): {@link cartridgeCase} with `origin` `catalogue`. */
export const catalogueCase: z.ZodType<CatalogueCase> = cartridgeCase.refine(
  (c): c is CatalogueCase => c.origin === 'catalogue',
  { message: 'A catalogue record has origin catalogue', path: ['origin'] },
)

/** A cartridge case product: material, primer pocket, flash hole, mass and stated water capacity. */
export interface Case extends z.infer<typeof cartridgeCase> {}

/** A case of the catalogue: the fields {@link cartridgeCase} requires of one are present. */
export interface CatalogueCase extends Case {
  id: string
  name: string
  origin: 'catalogue'
  productNumber: string
  provenance: Provenance
}
