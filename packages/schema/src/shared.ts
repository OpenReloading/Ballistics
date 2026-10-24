import { z } from 'zod'
import type { Provenance } from './provenance.ts'
import { quantity } from './units.ts'

/** A length above zero in the stored unit (mm). */
export const positiveLength = () => quantity('length', z.number().positive())

/** SHA-256 of a file: 64 lowercase hex digits. */
export const sha256 = z.string().regex(/^[0-9a-f]{64}$/)

/** ISO 3166-1 alpha-2 country code. */
export const countryCode = z.string().regex(/^[A-Z]{2}$/)

/** A colour as `#rrggbb`. */
export const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/)

/** Id of an item inside a user data record (a group, an optic, a saved load). */
export const localId = z.string().min(1).max(64)

/** A string of user data up to `max` characters. */
export const text = (max: number) => z.string().max(max)

/**
 * Adds an issue at `country` when the record has one and no source lists it in `fields`. The
 * country of a powder or bullet is the manufacturer's as a cited source names it (the supplier address of
 * a safety data sheet, a contact page), not where a lot was made; a source without `fields`
 * supports no country.
 */
export function needsCountrySource(
  r: { country?: string; provenance: Provenance },
  ctx: z.RefinementCtx,
) {
  if (r.country && !r.provenance.sources.some((s) => s.fields?.includes('country')))
    ctx.addIssue({
      code: 'custom',
      path: ['country'],
      message: 'needs a source with fields country',
    })
}
