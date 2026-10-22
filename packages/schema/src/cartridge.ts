import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { plausibilityException, pressureMethod, specValue } from './standards.ts'

/**
 * A cartridge as its C.I.P. sheet defines it: the names, the table, the dates and the values the
 * sheet prints. Inferred type: {@link Cartridge}.
 */
export const cartridge = z.object({
  id: recordId,
  /** The name as printed on the sheet. */
  name: z.string().min(1),
  /** Other names printed in the sheet's title or header, never derived from file names. */
  aliases: z.array(z.string().min(1)).min(1).optional(),
  /** Table of the C.I.P. TDCC, for example `I` (rimless) to `VII` (shotshell). */
  table: z.string().min(1),
  /** Country of origin as printed. */
  country: z.string().min(1).optional(),
  published: z.iso.date(),
  revised: z.iso.date().optional(),
  pressureMethod: pressureMethod.optional(),
  /** `verified`: every value checked by hand against the sheet. */
  verification: z.enum(['verified', 'unverified']),
  values: z.array(specValue),
  exceptions: z.array(plausibilityException).min(1).optional(),
  provenance,
})

/** A cartridge record: names, table, dates and values of its C.I.P. sheet. */
export interface Cartridge extends z.infer<typeof cartridge> {}

/** Id of a cartridge's sheet revision, `cip-<id>-<revised or published>`, as figure ids use it. */
export const sheetId = (c: Pick<Cartridge, 'id' | 'published' | 'revised'>) =>
  `cip-${c.id}-${c.revised ?? c.published}`
