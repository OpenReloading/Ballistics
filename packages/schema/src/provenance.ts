import { z } from 'zod'
import { recordId } from './ids.ts'
import { sha256 } from './shared.ts'

/**
 * How a value came about: read from a publication, measured, derived from other values, fitted to
 * data or computed by a model. A source may state its own kind.
 */
export const provenanceKind = z.enum(['published', 'measured', 'derived', 'fitted', 'computed'])

/**
 * Who stands behind a source: the `manufacturer` (data it supplied or published, used with its
 * permission), `public` data under an open license or in the public domain (it can come from a
 * manufacturer too), or `community` contributions.
 * Inferred type: {@link SourceOrigin}.
 */
export const sourceOrigin = z.enum(['manufacturer', 'public', 'community'])

/** Whether a source's `terms` is a link: it starts with http:// or https://. Any other text is a note. */
export const isWebLink = (text: string) => /^https?:\/\//.test(text)

/**
 * One cited source: title, optional publisher, page, URL, retrieval date and SHA-256 of the file (64
 * lowercase hex digits), and the terms its data is used under.
 * Inferred type: {@link Source}.
 */
export const source = z.object({
  title: z.string().min(1),
  /** Who issued the data: a maker, a standards body or the authors ("Example Bullets Inc."). */
  publisher: z.string().min(1).optional(),
  /** Edition, print or date as the document states it. */
  edition: z.string().min(1).optional(),
  page: z.string().min(1).optional(),
  /** An http or https URL: pages render it as a link. */
  url: z.url({ protocol: /^https?$/ }).optional(),
  retrieved: z.iso.date().optional(),
  sha256: sha256.optional(),
  /** Dot paths of the record fields this source supports; absent means the whole record. */
  fields: z.array(z.string().min(1)).min(1).optional(),
  /** Kind of this source's values when it differs from the record's provenance kind. */
  kind: provenanceKind.optional(),
  /**
   * SPDX id of the license the data is used under ("CC-BY-4.0"; "LicenseRef-US-Gov-PD" for a US Government work),
   * or `LicenseRef-<name>` for the publisher's own terms or a written permission, described in `terms`.
   */
  license: z
    .string()
    .regex(/^(LicenseRef-)?[A-Za-z0-9.+-]+$/)
    .optional(),
  /**
   * URL or note of the publisher's terms or permission, where no SPDX license covers the use. A
   * text starting with http:// or https:// is a link (`isWebLink`) and must be a URL. Any other
   * text is a note.
   */
  terms: z
    .string()
    .min(1)
    .refine((t) => !isWebLink(t) || URL.canParse(t), {
      message: 'a text starting with http:// or https:// must be a URL',
    })
    .optional(),
  /** Who stands behind the source; `title` names the actual source (for example the site and the table). */
  origin: sourceOrigin.optional(),
  /** The fit run behind a `fitted` source: model version id the report names, report of its evaluation. */
  run: z
    .object({ version: z.string().regex(/^[0-9a-f]{16}$/), report: z.string().min(1) })
    .optional(),
  note: z.string().min(1).optional(),
})

/**
 * A source that several records cite, stored once (`records/sources/<id>.json`). Records name it
 * by id in a {@link sourceReference}.
 * Inferred type: {@link SourceRecord}.
 */
export const sourceRecord = source
  .omit({ page: true, fields: true, kind: true, run: true })
  .extend({ id: recordId })
  .strict()

/**
 * A record's citation of a {@link sourceRecord}: its id and the parts of this record (page, fields,
 * kind, note, and the URL, SHA-256 and retrieval date of a file of its own). Resolved on reading,
 * each part set here replaces the one of the source record, a note goes before the source
 * record's note.
 * Inferred type: {@link SourceReference}.
 */
export const sourceReference = source
  .pick({
    page: true,
    url: true,
    retrieved: true,
    sha256: true,
    fields: true,
    kind: true,
    run: true,
    note: true,
  })
  .extend({ source: recordId })
  .strict()

/**
 * Where the values of a record come from: a kind and at least one source.
 * Inferred type: {@link Provenance}.
 */
export const provenance = z.object({
  kind: provenanceKind,
  sources: z.array(source).min(1),
  note: z.string().min(1).optional(),
})

/** One cited source of a record's values, with the terms of use. */
export interface Source extends z.infer<typeof source> {}
/** A source stored once and cited by id. */
export interface SourceRecord extends z.infer<typeof sourceRecord> {}
/** A record's citation of a source record by id, with the parts of this record. */
export interface SourceReference extends z.infer<typeof sourceReference> {}
/** Who stands behind a source: `manufacturer`, `public` or `community`. */
export type SourceOrigin = z.infer<typeof sourceOrigin>
/** The provenance block of a record: kind and at least one source. */
export interface Provenance extends z.infer<typeof provenance> {}
