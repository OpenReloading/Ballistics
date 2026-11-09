import type { z } from 'zod'
import type { Provenance } from './provenance.ts'

/** The country of a powder or bullet is the manufacturer's as a cited source names it (the supplier address of a safety data sheet, a contact page), not where a lot was made; a source without `fields` supports no country. */
export function needsCountrySource(
  r: { country?: string | undefined; provenance: Provenance },
  ctx: z.RefinementCtx,
): void {
  if (r.country && !r.provenance.sources.some((s) => s.fields?.includes('country')))
    ctx.addIssue({
      code: 'custom',
      path: ['country'],
      message: 'needs a source with fields country',
    })
}
