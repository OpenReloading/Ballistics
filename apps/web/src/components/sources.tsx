import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from '@mantine/core'
import { isWebLink, type Provenance, type Source } from '@rangefoundry/schema'
import Link from '@/platform/link.tsx'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish, ungrouped } from '../i18n/lingui.ts'
import { fieldLabel } from '../lib/field-labels.ts'
import englishMessages from '../locales/en/components/sources.json' with { type: 'json' }
import { Day } from './day.tsx'
import { Noted } from './field-table.tsx'
import { CopyHash } from './record-actions.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { SourceLink, sourceTitle } from './source-link.tsx'

loadEnglish(englishMessages)

/** A record note without its notice: a page carries one model note at most, prints none. */
const note = (text: string) => text.replaceAll(', not load data', '')

type Has = (k: keyof Source) => boolean

/** How a record's or a source's values came about: the title of its Sources panel, its Kind column. */
export const provenanceKinds: Record<Provenance['kind'], MessageDescriptor> = {
  published: /*i18n*/ { id: 'recordSources.kind.published', message: 'published' },
  measured: /*i18n*/ { id: 'recordSources.kind.measured', message: 'measured' },
  derived: /*i18n*/ { id: 'recordSources.kind.derived', message: 'derived' },
  fitted: /*i18n*/ { id: 'recordSources.kind.fitted', message: 'fitted' },
  computed: /*i18n*/ { id: 'recordSources.kind.computed', message: 'computed' },
}

/** The optional columns in their order. */
const columns = {
  origin: /*i18n*/ { id: 'recordSources.column.origin', message: 'Origin' },
  kind: /*i18n*/ { id: 'recordSources.column.kind', message: 'Kind' },
  retrieved: /*i18n*/ { id: 'recordSources.column.retrieved', message: 'Retrieved' },
  license: /*i18n*/ { id: 'recordSources.column.license', message: 'License' },
  terms: /*i18n*/ { id: 'recordSources.column.terms', message: 'Terms' },
  fields: /*i18n*/ { id: 'recordSources.column.covers', message: 'Covers' },
  note: /*i18n*/ { id: 'recordSources.column.note', message: 'Note' },
} satisfies Partial<Record<keyof Source, MessageDescriptor>>

const columnKeys = Object.keys(columns) as (keyof typeof columns)[]

/** Who stands behind a source, as the schema names it. */
const origins: Record<string, MessageDescriptor> = {
  manufacturer: /*i18n*/ { id: 'recordSources.origin.manufacturer', message: 'manufacturer' },
  public: /*i18n*/ { id: 'recordSources.origin.public', message: 'public' },
  community: /*i18n*/ { id: 'recordSources.origin.community', message: 'community' },
}

function SourcesHead({ has }: { has: Has }) {
  const { i18n } = useLingui()
  return (
    <TableTr role="row">
      <TableTh scope="col" role="columnheader">
        {i18n._({ id: 'recordSources.column.source', message: 'Source' })}
      </TableTh>
      {columnKeys.filter(has).map((key) => (
        <TableTh key={key} scope="col" role="columnheader">
          {i18n._(columns[key])}
        </TableTh>
      ))}
    </TableTr>
  )
}

function SourceMeta({ source: s }: { source: Source }) {
  return (
    <span className="source-meta">
      {s.publisher && <span>{s.publisher}</span>}
      {s.edition && <span>{s.edition}</span>}
      {s.sha256 && <CopyHash hash={s.sha256} />}
    </span>
  )
}

/** The kinds whose values this project works out from the cited source. */
const workedKinds: readonly Provenance['kind'][] = ['derived', 'computed', 'fitted']

/** A source whose publisher's terms apply: it names the publisher and links its terms, under no license. */
const isPublished = (s: Source) =>
  s.publisher !== undefined &&
  s.terms !== undefined &&
  isWebLink(s.terms) &&
  s.license === undefined &&
  s.origin !== 'public' &&
  s.origin !== 'community'

/** Whose facts the record states and whose terms apply, and that the project works out the values the Kind column marks derived, computed or fitted. */
function SourcesLead({ provenance }: { provenance: Provenance }) {
  const { i18n } = useLingui()
  const publishers = [
    ...new Set(provenance.sources.filter(isPublished).map((s) => s.publisher as string)),
  ]
  const worked = provenance.sources.some((s) => workedKinds.includes(s.kind ?? provenance.kind))
  if (publishers.length === 0 && !worked) return null
  const names = new Intl.ListFormat(i18n.locale, { type: 'conjunction' }).format(publishers)
  const sentences = [
    publishers.length > 0 &&
      i18n._({
        id: 'recordSources.lead',
        message:
          '{count, plural, one {Facts as {publishers} publishes them. {publishers} has not reviewed this record; its terms apply.} other {Facts as {publishers} publish them. They have not reviewed this record; their terms apply.}}',
        values: { count: publishers.length, publishers: names },
      }),
    worked &&
      i18n._({
        id: 'recordSources.worked',
        message:
          'Values of kind derived, computed or fitted are worked out by this project from the cited source; the Kind column shows which.',
      }),
  ]
  return <p>{sentences.filter(Boolean).join(' ')}</p>
}

const fieldCount = /*i18n*/ {
  id: 'recordSources.fieldCount',
  message: '{count, plural, one {# field} other {# fields}}',
}

/** The fields a source covers: their count, the list of their labels on hover and on focus. */
function CoversCell({ fields, kind }: { fields: string[] | undefined; kind: string | undefined }) {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  if (!fields) return i18n._({ id: 'recordSources.wholeRecord', message: 'whole record' })
  return (
    <Noted
      value={i18n._(
        fieldCount.id,
        { count: fields.length },
        { message: fieldCount.message, formats: ungrouped },
      )}
      notes={[fields.map((f) => fieldLabel(f, kind, t, i18n)).join(', ')]}
    />
  )
}

/** `inGroup`: under its document's head row, headed by its page (or "No page stated"), the document's own data being in the head. */
function SourceRow({
  source: s,
  has,
  kind,
  recordKind,
  inGroup,
}: {
  source: Source
  has: Has
  kind: string | undefined
  recordKind: Provenance['kind']
  inGroup?: boolean
}) {
  const { i18n } = useLingui()
  const origin = s.origin && origins[s.origin]
  return (
    <TableTr role="row" className={inGroup ? 'source-page-row' : undefined}>
      {inGroup ? (
        <TableTh scope="row" role="rowheader" className="source-page">
          {s.page
            ? i18n._({ id: 'recordSources.page', message: 'Page {page}', values: { page: s.page } })
            : i18n._({ id: 'recordSources.noPage', message: 'No page stated' })}
        </TableTh>
      ) : (
        <TableTh scope="row" role="rowheader">
          <span className="source-title">
            <SourceLink source={s} />
          </span>
          <SourceMeta source={s} />
        </TableTh>
      )}
      {has('origin') && (
        <TableTd role="cell" data-label={i18n._(columns.origin)}>
          {origin ? i18n._(origin) : s.origin}
        </TableTd>
      )}
      {has('kind') && (
        <TableTd role="cell" data-label={i18n._(columns.kind)}>
          {i18n._(provenanceKinds[s.kind ?? recordKind])}
        </TableTd>
      )}
      {has('retrieved') && (
        <TableTd role="cell" className="nowrap" data-label={i18n._(columns.retrieved)}>
          {s.retrieved && <Day day={s.retrieved} />}
        </TableTd>
      )}
      {has('license') && (
        <TableTd role="cell" data-label={i18n._(columns.license)}>
          {s.license}
        </TableTd>
      )}
      {has('terms') && (
        <TableTd role="cell" data-label={i18n._(columns.terms)}>
          {s.terms &&
            (isWebLink(s.terms) ? (
              <a href={s.terms}>{i18n._({ id: 'recordSources.terms', message: 'Terms' })}</a>
            ) : (
              s.terms
            ))}
        </TableTd>
      )}
      {has('fields') && (
        <TableTd role="cell" className="nowrap" data-label={i18n._(columns.fields)}>
          <CoversCell fields={s.fields} kind={kind} />
        </TableTd>
      )}
      {has('note') && (
        <TableTd role="cell" data-label={i18n._(columns.note)}>
          {s.note && note(s.note)}
        </TableTd>
      )}
    </TableTr>
  )
}

/** The document a source cites: the sources of one document share these. */
const documentKey = (s: Source) =>
  [s.title, s.entry, s.url, s.publisher, s.edition, s.sha256, s.terms]
    .map((v) => v ?? '')
    .join('\u0000')

/** The sources in their order, those of one document together at the place of its first. */
export function groupSources(list: readonly Source[]): Source[][] {
  const groups = new Map<string, Source[]>()
  for (const s of list) {
    const key = documentKey(s)
    const group = groups.get(key)
    if (group) group.push(s)
    else groups.set(key, [s])
  }
  return [...groups.values()]
}

/** The head row's data is one cell across the row, as a header there would head no data cell; a row per page under it. */
function SourceGroup({
  sources,
  has,
  span,
  kind,
  recordKind,
}: {
  sources: Source[]
  has: Has
  span: number
  kind: string | undefined
  recordKind: Provenance['kind']
}) {
  const { i18n } = useLingui()
  const first = sources[0] as Source
  // a page can be cited twice with other fields: the key counts repeats of the same content
  const seen = new Map<string, number>()
  const keys = sources.map((s) => {
    const base = `${s.page ?? ''} ${s.fields?.join(',') ?? ''} ${s.note ?? ''}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return `${base} ${n}`
  })
  return (
    <TableTbody role="rowgroup" className="source-group">
      <TableTr role="row">
        <TableTd role="cell" colSpan={span} className="source-document">
          <span className="source-title">
            {first.url ? (
              <a href={first.url}>{sourceTitle(first, i18n)}</a>
            ) : (
              sourceTitle(first, i18n)
            )}
          </span>
          <SourceMeta source={first} />
        </TableTd>
      </TableTr>
      {sources.map((s, i) => (
        <SourceRow key={keys[i]} source={s} has={has} kind={kind} recordKind={recordKind} inGroup />
      ))}
    </TableTbody>
  )
}

/** A column no source fills is left out (Kind while every source's kind, its own or the record's, is `published`), a document cited at several pages is one group; below 48em a source is a block, each value after its column's name (`data-label`), so every table element carries its ARIA role. */
export function Sources({
  provenance,
  kind,
}: {
  provenance: Provenance
  /** The record kind (`powders`), whose field labels name the fields a source covers. */
  kind?: string | undefined
}) {
  const { i18n } = useLingui()
  const list = provenance.sources
  const has = (k: keyof Source) =>
    k === 'kind'
      ? list.some((s) => (s.kind ?? provenance.kind) !== 'published')
      : list.some((s) => s[k] !== undefined)
  const span = 1 + columnKeys.filter(has).length
  const groups = groupSources(list)
  return (
    <>
      <SourcesLead provenance={provenance} />
      <ScrollRegion label={i18n._({ id: 'recordSources.table', message: 'Sources table' })}>
        <Table className="sources" role="table">
          <TableThead role="rowgroup">
            <SourcesHead has={has} />
          </TableThead>
          {groups.map((group) =>
            group.length > 1 ? (
              <SourceGroup
                key={documentKey(group[0] as Source)}
                sources={group}
                has={has}
                span={span}
                kind={kind}
                recordKind={provenance.kind}
              />
            ) : (
              <TableTbody role="rowgroup" key={documentKey(group[0] as Source)}>
                <SourceRow
                  source={group[0] as Source}
                  has={has}
                  kind={kind}
                  recordKind={provenance.kind}
                />
              </TableTbody>
            ),
          )}
        </Table>
      </ScrollRegion>
      {provenance.note && <p>{note(provenance.note)}</p>}
    </>
  )
}

/** A tool's link to the Sources panel of a catalogue record's page, in a new tab: the tool keeps its state. */
export function RecordSourcesLink({
  kind,
  id,
  label,
}: {
  kind: 'cartridges' | 'bullets' | 'powders'
  id: string
  /** Defaults to "Sources". */
  label?: string
}) {
  const { i18n } = useLingui()
  return (
    <Link href={`/${kind}/${encodeURIComponent(id)}#record-sources`} target="_blank" rel="noopener">
      {label ?? i18n._({ id: 'recordSources.link', message: 'Sources' })}
      <span className="visually-hidden">
        {' '}
        {i18n._({ id: 'recordSources.newTab', message: 'in a new tab' })}
      </span>
    </Link>
  )
}
