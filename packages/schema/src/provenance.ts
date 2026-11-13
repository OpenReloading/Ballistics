import { z } from 'zod'
import type { Exact } from './exact.ts'
import { sha256 } from './fields.ts'
import { recordId } from './ids.ts'

const provenanceKindParser = z.enum(['published', 'measured', 'derived', 'fitted', 'computed'])

/**
 * How a value came about: read from a publication, measured, derived from other values, fitted to
 * data or computed by a model. A source may state its own kind.
 */
export const provenanceKind: z.ZodEnum<
  z.core.util.ToEnum<'published' | 'measured' | 'derived' | 'fitted' | 'computed'>
> = provenanceKindParser satisfies Exact<typeof provenanceKind, typeof provenanceKindParser>

const sourceOriginParser = z.enum(['manufacturer', 'public', 'community'])

/**
 * Who stands behind a source: the `manufacturer` (data it supplied or published; terms it states
 * go in `terms`), `public` data under an open license or in the public domain (it can come from a
 * manufacturer too), or `community` contributions.
 * Inferred type: {@link SourceOrigin}.
 */
export const sourceOrigin: z.ZodEnum<z.core.util.ToEnum<'manufacturer' | 'public' | 'community'>> =
  sourceOriginParser satisfies Exact<typeof sourceOrigin, typeof sourceOriginParser>

/** Whether a source's `terms` is a link: it starts with http:// or https://. Any other text is a note. */
export const isWebLink = (text: string): boolean => /^https?:\/\//.test(text)

// `new URL` instead of `URL.canParse`, which the oldest supported browsers lack.
const parsesAsUrl = (text: string) => {
  try {
    // oxlint-disable-next-line no-new -- constructing is the check: it throws on a text that is no URL
    new URL(text)
    return true
  } catch {
    return false
  }
}

const sourceParser = z.object({
  title: z
    .string()
    .min(1)
    .describe('Title of the source: the document, or the site and table.')
    .optional(),
  entry: z
    .enum(['range', 'targetDesigner'])
    .describe(
      'Where the user entered the values in the app, in place of a title: `range` (range mode) or `targetDesigner`. The app names the source in the language of the reader.',
    )
    .optional(),
  publisher: z
    .string()
    .min(1)
    .describe('Who issued the data: a maker, a standards body or the authors.')
    .optional(),
  edition: z
    .string()
    .min(1)
    .describe('Edition, print or date as the document states it.')
    .optional(),
  page: z.string().min(1).describe('Page or section of the document.').optional(),
  url: z
    .url({ protocol: /^https?$/ })
    .describe('An http or https URL of the source.')
    .optional(),
  retrieved: z.iso.date().describe('Date the source was retrieved, ISO 8601.').optional(),
  sha256: sha256.describe('SHA-256 of the retrieved file, 64 lowercase hex digits.').optional(),
  fields: z
    .array(z.string().min(1))
    .min(1)
    .describe('Dot paths of the record fields this source supports. Absent: the whole record.')
    .optional(),
  kind: provenanceKind
    .describe('Kind of this source values when it differs from the provenance kind of the record.')
    .optional(),
  license: z
    .string()
    .regex(/^(LicenseRef-)?[A-Za-z0-9.+-]+$/)
    .describe(
      'SPDX id of the license the data is used under, or `LicenseRef-<name>` for the publisher own terms described in `terms`.',
    )
    .optional(),
  terms: z
    .string()
    .min(1)
    .refine((t) => !isWebLink(t) || parsesAsUrl(t), {
      message: 'a text starting with http:// or https:// must be a URL',
    })
    .describe(
      'URL or note of the publisher terms where no SPDX license covers the use. Text starting with http:// or https:// is a link.',
    )
    .optional(),
  origin: sourceOrigin
    .describe('Who stands behind the source: manufacturer, public or community.')
    .optional(),
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
 * One cited source: title, publisher, page, URL, retrieval date, SHA-256 of the file and the terms
 * its data is used under.
 * Inferred type: {@link Source}.
 */
export const source: z.ZodObject<{
  title: z.ZodOptional<z.ZodString>
  /** Where the user entered the values in the app; the app names such a source in the reader's language. */
  entry: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'range' | 'targetDesigner'>>>
  /** Who issued the data: a maker, a standards body or the authors ("Example Bullets Inc."). */
  publisher: z.ZodOptional<z.ZodString>
  /** Edition, print or date as the document states it. */
  edition: z.ZodOptional<z.ZodString>
  page: z.ZodOptional<z.ZodString>
  /** An http or https URL: pages render it as a link. */
  url: z.ZodOptional<z.ZodURL>
  retrieved: z.ZodOptional<z.ZodISODate>
  sha256: z.ZodOptional<z.ZodString>
  /** Dot paths of the record fields this source supports; absent means the whole record. */
  fields: z.ZodOptional<z.ZodArray<z.ZodString>>
  /** Kind of this source's values when it differs from the record's provenance kind. */
  kind: z.ZodOptional<typeof provenanceKind>
  /**
   * SPDX id of the license the data is used under ("CC-BY-4.0"; "LicenseRef-US-Gov-PD" for a US Government work),
   * or `LicenseRef-<name>` for the publisher's own terms, described in `terms`.
   * Without a license, a source of a record distributed by `@rangefoundry/catalog` is covered by its
   * data license, CC BY 4.0 (`packages/catalog/LICENSE`), except one with `origin: manufacturer`: data a
   * manufacturer published carries no project license, only the terms the manufacturer states.
   * For other producers' records the producer sets the default.
   */
  license: z.ZodOptional<z.ZodString>
  /**
   * URL or note of the publisher's terms, where no SPDX license covers the use. A
   * text starting with http:// or https:// is a link (`isWebLink`) and must be a URL. Any other
   * text is a note.
   */
  terms: z.ZodOptional<z.ZodString>
  /** Who stands behind the source; `title` names the actual source (for example the site and the table). */
  origin: z.ZodOptional<typeof sourceOrigin>
  /** The fit run behind a `fitted` source: model version id the report names, report of its evaluation. */
  run: z.ZodOptional<z.ZodObject<{ version: z.ZodString; report: z.ZodString }>>
  note: z.ZodOptional<z.ZodString>
}> = sourceParser
  .refine((s) => s.title !== undefined || s.entry !== undefined, {
    message: 'a source needs a title or an entry',
    path: ['title'],
  })
  // the JSON Schemas cannot carry the refine: they state the same rule
  .meta({ anyOf: [{ required: ['title'] }, { required: ['entry'] }] }) satisfies Exact<
  typeof source,
  typeof sourceParser
>

const sourceRecordParser = sourceParser
  .omit({ page: true, fields: true, kind: true, run: true, entry: true })
  .extend({ id: recordId, title: sourceParser.shape.title.unwrap() })
  .strict()

/**
 * A source that several records cite, stored once (`records/sources/<id>.json`). Records name it
 * by id in a {@link sourceReference}.
 * Inferred type: {@link SourceRecord}.
 */
export const sourceRecord: z.ZodObject<
  Omit<(typeof source)['shape'], 'page' | 'fields' | 'kind' | 'run' | 'entry' | 'title'> & {
    id: typeof recordId
    title: z.ZodString
  },
  z.core.$strict
> = sourceRecordParser satisfies Exact<typeof sourceRecord, typeof sourceRecordParser>

const sourceReferenceParser = sourceParser
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
 * A record's citation of a {@link sourceRecord}: its id and the parts of this record (page, fields,
 * kind, note, and the URL, SHA-256 and retrieval date of a file of its own). Resolved on reading,
 * each part set here replaces the one of the source record, a note goes before the source
 * record's note.
 * Inferred type: {@link SourceReference}.
 */
export const sourceReference: z.ZodObject<
  Pick<
    (typeof source)['shape'],
    'page' | 'url' | 'retrieved' | 'sha256' | 'fields' | 'kind' | 'run' | 'note'
  > & { source: typeof recordId },
  z.core.$strict
> = sourceReferenceParser satisfies Exact<typeof sourceReference, typeof sourceReferenceParser>

const provenanceParser = z.object({
  kind: provenanceKind.describe('How the values came about.'),
  sources: z.array(source).min(1).describe('The sources of the values, at least one.'),
  note: z.string().min(1).describe('Note on the provenance.').optional(),
})

/**
 * Where the values of a record come from: a kind and at least one source.
 * Inferred type: {@link Provenance}.
 */
export const provenance: z.ZodObject<{
  kind: typeof provenanceKind
  sources: z.ZodArray<typeof source>
  note: z.ZodOptional<z.ZodString>
}> = provenanceParser satisfies Exact<typeof provenance, typeof provenanceParser>

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
