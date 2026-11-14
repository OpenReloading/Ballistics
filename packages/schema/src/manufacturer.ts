import { z } from 'zod'
import type { Exact } from './exact.ts'
import { countryCode } from './fields.ts'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'

const manufacturerParser = z.strictObject({
  id: recordId,
  name: z.string().min(1),
  country: countryCode.optional(),
  website: z.url({ protocol: /^https$/ }).optional(),
  aliases: z.array(z.string().min(1)).min(1).optional(),
  provenance: provenance.optional(),
})

/**
 * A company that makes powders or bullets, or whose products other records name (a chronograph
 * session's device), as its products and site name it. The id is the slug
 * of the name without the legal form and never changes; a renamed manufacturer keeps its id and
 * the old name goes to `aliases`. Model: `apps/docs/docs/data/manufacturers.md`.
 * Inferred type: {@link Manufacturer}.
 */
export const manufacturer: z.ZodObject<
  {
    id: typeof recordId
    /** Name as the manufacturer prints it on its products or site. */
    name: z.ZodString
    /**
     * Country of the company behind the name, ISO 3166-1 alpha-2, as its own contact page, imprint
     * or safety data sheet names it; a basic fact that needs no source.
     */
    country: z.ZodOptional<z.ZodString>
    /** The manufacturer's own site, or the brand's page on its owner's site, https. */
    website: z.ZodOptional<z.ZodURL>
    /** Other names: former names and brand names it sells under; searched and checked for duplicates. */
    aliases: z.ZodOptional<z.ZodArray<z.ZodString>>
    /** Where the values of the record come from, wherever the record has a source: a kind and at least one source. */
    provenance: z.ZodOptional<typeof provenance>
  },
  z.core.$strict
> = manufacturerParser satisfies Exact<typeof manufacturer, typeof manufacturerParser>

/** A manufacturer record. */
export interface Manufacturer extends z.infer<typeof manufacturer> {}
