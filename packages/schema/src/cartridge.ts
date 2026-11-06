import { z } from 'zod'
import type { Exact } from './exact.ts'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { plausibilityException, pressureMethod, specValue } from './standards.ts'

const caseTypesParser = z.enum(['rimless', 'semi-rimmed', 'rimmed', 'rebated', 'belted'])

/**
 * The case head of a cartridge, derived from the sheet's R1 (rim), P1 (body at the head) and R3 (belt):
 * the API answers it as `caseType`, the web app lists it as a filter.
 * Inferred type: {@link CaseType}.
 */
export const caseTypes: z.ZodEnum<
  z.core.util.ToEnum<'rimless' | 'semi-rimmed' | 'rimmed' | 'rebated' | 'belted'>
> = caseTypesParser satisfies Exact<typeof caseTypes, typeof caseTypesParser>

/** The case head of a cartridge. */
export type CaseType = z.infer<typeof caseTypes>

const cartridgeParser = z.object({
  id: recordId,
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1).optional(),
  table: z.string().min(1),
  country: z.string().min(1).optional(),
  published: z.iso.date(),
  revised: z.iso.date().optional(),
  pressureMethod: pressureMethod.optional(),
  verification: z.enum(['verified', 'unverified']),
  values: z.array(specValue),
  exceptions: z.array(plausibilityException).min(1).optional(),
  provenance,
})

/**
 * A cartridge as its C.I.P. sheet defines it: the names, the table, the dates and the values the
 * sheet prints. Inferred type: {@link Cartridge}.
 */
export const cartridge: z.ZodObject<{
  id: typeof recordId
  /** The name as printed on the sheet. */
  name: z.ZodString
  /** Other names printed in the sheet's title or header, never derived from file names. */
  aliases: z.ZodOptional<z.ZodArray<z.ZodString>>
  /** Table of the C.I.P. sheets, for example `I` (rimless) to `VII` (shotshell). */
  table: z.ZodString
  /** Country of origin as printed. */
  country: z.ZodOptional<z.ZodString>
  published: z.ZodISODate
  revised: z.ZodOptional<z.ZodISODate>
  pressureMethod: z.ZodOptional<typeof pressureMethod>
  /** `verified`: every value checked by hand against the sheet. */
  verification: z.ZodEnum<z.core.util.ToEnum<'verified' | 'unverified'>>
  values: z.ZodArray<typeof specValue>
  exceptions: z.ZodOptional<z.ZodArray<typeof plausibilityException>>
  /** Where the values of the record come from: a kind and at least one source. */
  provenance: typeof provenance
}> = cartridgeParser satisfies Exact<typeof cartridge, typeof cartridgeParser>

/** A cartridge record: the values of its C.I.P. sheet. */
export interface Cartridge extends z.infer<typeof cartridge> {}

/** Id of a cartridge's sheet revision, `cip-<id>-<revised or published>`, as figure ids use it. */
export const sheetId = (c: Pick<Cartridge, 'id' | 'published' | 'revised'>): string =>
  `cip-${c.id}-${c.revised ?? c.published}`
