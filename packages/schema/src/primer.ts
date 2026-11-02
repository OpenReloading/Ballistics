import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { quantity } from './units.ts'

/**
 * Sizes of a primer.
 * Inferred type: {@link PrimerSize}.
 */
export const primerSizes = z.enum([
  'small-rifle',
  'large-rifle',
  'small-pistol',
  'large-pistol',
  'shotshell',
])

/** A size of {@link primerSizes}. */
export type PrimerSize = z.infer<typeof primerSizes>

/** Cup metals of a primer. */
export const primerCupMaterials = z.enum(['brass', 'nickel-plated-brass', 'copper', 'steel'])

/** Priming compounds of a primer. */
export const primerCompounds = z.enum(['lead-styphnate', 'lead-free'])

/** A compound of {@link primerCompounds}. */
export type PrimerCompound = z.infer<typeof primerCompounds>

/** The cup of a primer: its metal and wall thickness, where the source gives them. */
const primerCup = z.strictObject({
  material: primerCupMaterials.describe('Metal of the cup.').optional(),
  thickness: quantity('length', z.number().positive())
    .describe('Wall thickness of the cup.')
    .optional(),
})

/** One figure of output or sensitivity a source publishes, kept as the source states it. */
const primerFigure = z.strictObject({
  property: z
    .string()
    .min(1)
    .describe('What the figure describes, as the source names it, for example a drop height.'),
  value: z.string().min(1).describe('The figure as the source prints it, with its unit.'),
})

/**
 * A primer as its manufacturer sells it. No primer value enters a solver.
 * Inferred type: {@link Primer}.
 */
export const primer = z.strictObject({
  id: recordId,
  /** Id of the manufacturer record. */
  manufacturer: recordId,
  name: z.string().min(1).describe('Name of the product as the manufacturer prints it.'),
  productNumber: z.string().min(1).describe('Product number.').optional(),
  size: primerSizes.describe('Size class of the primer.'),
  magnum: z
    .boolean()
    .describe('Whether the manufacturer sells the primer as a magnum primer.')
    .optional(),
  cup: primerCup.describe('The cup of the primer.').optional(),
  compound: primerCompounds.describe('The priming compound.').optional(),
  intendedUse: z
    .string()
    .min(1)
    .describe('What the manufacturer sells the primer for, in the words of this record.')
    .optional(),
  performance: z
    .array(primerFigure)
    .min(1)
    .describe('Output or sensitivity figures the source publishes.')
    .optional(),
  note: z.string().min(1).describe('Notes on the product.').optional(),
  provenance,
})

/** A primer record. */
export interface Primer extends z.infer<typeof primer> {}
