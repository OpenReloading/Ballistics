import { z } from 'zod'
import type { Exact } from './exact.ts'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { type QuantitySchema, quantity } from './units.ts'

const primerSizesParser = z.enum([
  'small-rifle',
  'large-rifle',
  'small-pistol',
  'large-pistol',
  'shotshell',
])

/**
 * Sizes of a primer.
 * Inferred type: {@link PrimerSize}.
 */
export const primerSizes: z.ZodEnum<
  z.core.util.ToEnum<'small-rifle' | 'large-rifle' | 'small-pistol' | 'large-pistol' | 'shotshell'>
> = primerSizesParser satisfies Exact<typeof primerSizes, typeof primerSizesParser>

/** A size of {@link primerSizes}. */
export type PrimerSize = z.infer<typeof primerSizes>

const primerCupMaterialsParser = z.enum(['brass', 'nickel-plated-brass', 'copper', 'steel'])

/** Cup metals of a primer. */
export const primerCupMaterials: z.ZodEnum<
  z.core.util.ToEnum<'brass' | 'nickel-plated-brass' | 'copper' | 'steel'>
> = primerCupMaterialsParser satisfies Exact<
  typeof primerCupMaterials,
  typeof primerCupMaterialsParser
>

const primerCompoundsParser = z.enum(['lead-styphnate', 'lead-free'])

/** Priming compounds of a primer. */
export const primerCompounds: z.ZodEnum<z.core.util.ToEnum<'lead-styphnate' | 'lead-free'>> =
  primerCompoundsParser satisfies Exact<typeof primerCompounds, typeof primerCompoundsParser>

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

const primerParser = z.strictObject({
  id: recordId,
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

/**
 * A primer as its manufacturer sells it. No primer value enters a solver.
 * Inferred type: {@link Primer}.
 */
export const primer: z.ZodObject<
  {
    id: typeof recordId
    /** Id of the manufacturer record. */
    manufacturer: typeof recordId
    name: z.ZodString
    productNumber: z.ZodOptional<z.ZodString>
    size: typeof primerSizes
    magnum: z.ZodOptional<z.ZodBoolean>
    cup: z.ZodOptional<
      z.ZodObject<
        {
          material: z.ZodOptional<typeof primerCupMaterials>
          thickness: z.ZodOptional<QuantitySchema>
        },
        z.core.$strict
      >
    >
    compound: z.ZodOptional<typeof primerCompounds>
    intendedUse: z.ZodOptional<z.ZodString>
    performance: z.ZodOptional<
      z.ZodArray<z.ZodObject<{ property: z.ZodString; value: z.ZodString }, z.core.$strict>>
    >
    note: z.ZodOptional<z.ZodString>
    provenance: typeof provenance
  },
  z.core.$strict
> = primerParser satisfies Exact<typeof primer, typeof primerParser>

/** A primer record. */
export interface Primer extends z.infer<typeof primer> {}
