import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'

/**
 * A company that makes powders or bullets, or whose products other records name (a chronograph
 * session's device), as its products and site name it. The id is the slug
 * of the name without the legal form and never changes; a renamed manufacturer keeps its id and
 * the old name goes to `aliases`. Model: `apps/docs/docs/data/manufacturers.md`.
 * Inferred type: {@link Manufacturer}.
 */
export const manufacturer = z.strictObject({
  id: recordId,
  /** Name as the manufacturer prints it on its products or site. */
  name: z.string().min(1),
  /** The manufacturer's own site, https. */
  website: z.url({ protocol: /^https$/ }).optional(),
  /** Other names: former names and brand names it sells under; searched and checked for duplicates. */
  aliases: z.array(z.string().min(1)).min(1).optional(),
  provenance,
})

/** A manufacturer record. */
export interface Manufacturer extends z.infer<typeof manufacturer> {}
