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
  title: z.string().min(1).describe('Title of the source: the document, or the site and table.'),
  /** Who issued the data: a maker, a standards body or the authors ("Example Bullets Inc."). */
  publisher: z
    .string()
    .min(1)
    .describe('Who issued the data: a maker, a standards body or the authors.')
    .optional(),
  /** Edition, print or date as the document states it. */
  edition: z
    .string()
    .min(1)
    .describe('Edition, print or date as the document states it.')
    .optional(),
  page: z.string().min(1).describe('Page or section of the document.').optional(),
  /** An http or https URL: pages render it as a link. */
  url: z
    .url({ protocol: /^https?$/ })
    .describe('An http or https URL of the source.')
    .optional(),
  retrieved: z.iso.date().describe('Date the source was retrieved, ISO 8601.').optional(),
  sha256: sha256.describe('SHA-256 of the retrieved file, 64 lowercase hex digits.').optional(),
  /** Dot paths of the record fields this source supports; absent means the whole record. */
  fields: z
    .array(z.string().min(1))
    .min(1)
    .describe('Dot paths of the record fields this source supports. Absent: the whole record.')
    .optional(),
  /** Kind of this source's values when it differs from the record's provenance kind. */
  kind: provenanceKind
    .describe('Kind of this source values when it differs from the provenance kind of the record.')
    .optional(),
  /**
   * SPDX id of the license the data is used under ("CC-BY-4.0"; "LicenseRef-US-Gov-PD" for a US Government work),
   * or `LicenseRef-<name>` for the publisher's own terms or a written permission, described in `terms`.
   */
  license: z
    .string()
    .regex(/^(LicenseRef-)?[A-Za-z0-9.+-]+$/)
    .describe(
      'SPDX id of the license the data is used under, or `LicenseRef-<name>` for the publisher own terms or a written permission described in `terms`.',
    )
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
    .describe(
      'URL or note of the publisher terms or permission where no SPDX license covers the use. Text starting with http:// or https:// is a link.',
    )
    .optional(),
  /** Who stands behind the source; `title` names the actual source (for example the site and the table). */
  origin: sourceOrigin
    .describe('Who stands behind the source: manufacturer, public or community.')
    .optional(),
  /** The fit run behind a `fitted` source: model version id the report names, report of its evaluation. */
  run: z
    .object({
      version: z
        .string()
        .regex(/^[0-9a-f]{16}$/)
        .describe('Model version id the report names.'),
      report: z.string().min(1).describe('Report of the evaluation of the fit.'),
    })
    .describe('The fit run behind a `fitted` source.')
    .optional(),
  note: z.string().min(1).describe('Note on the source.').optional(),
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
  kind: provenanceKind.describe('How the values came about.'),
  sources: z.array(source).min(1).describe('The sources of the values, at least one.'),
  note: z.string().min(1).describe('Note on the provenance.').optional(),
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
