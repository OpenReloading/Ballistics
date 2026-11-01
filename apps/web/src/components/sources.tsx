'use client'

import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from '@mantine/core'
import { isWebLink, type Provenance, type Source } from '@open-reloading/schema'
import Link from 'next/link'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg } from '../i18n/translate.ts'
import { Day } from './day.tsx'
import { Noted } from './field-table.tsx'
import { CopyHash } from './record-actions.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { SourceLink } from './source-link.tsx'

/** A record note without its notice: a page carries one model note at most, prints none. */
const note = (text: string) => text.replaceAll(', not load data', '')

type Has = (k: keyof Source) => boolean

/** How a record's values came about, in the title of its Sources panel. */
export const provenanceKinds: Record<Provenance['kind'], Message> = {
  published: msg('published'),
  measured: msg('measured'),
  derived: msg('derived'),
  fitted: msg('fitted'),
  computed: msg('computed'),
}

const columns: [keyof Source, Message][] = [
  ['origin', msg('Origin')],
  ['retrieved', msg('Retrieved')],
  ['license', msg('License')],
  ['fields', msg('Covers')],
  ['note', msg('Note')],
]

/** Who stands behind a source, as the schema names it. */
const origins: Record<string, Message> = {
  manufacturer: msg('manufacturer'),
  public: msg('public'),
  community: msg('community'),
}

function SourcesHead({ has }: { has: Has }) {
  const { t } = useTranslation()
  return (
    <TableTr role="row">
      <TableTh scope="col" role="columnheader">
        {t('Source')}
      </TableTh>
      {columns
        .filter(([key]) => has(key))
        .map(([key, label]) => (
          <TableTh key={key} scope="col" role="columnheader">
            {t(label)}
          </TableTh>
        ))}
    </TableTr>
  )
}

function SourceMeta({ source: s }: { source: Source }) {
  const { t } = useTranslation()
  return (
    <span className="source-meta">
      {s.publisher && <span>{s.publisher}</span>}
      {s.edition && <span>{s.edition}</span>}
      {s.terms && (
        <span>
          {isWebLink(s.terms) ? (
            <a href={s.terms}>{t('Terms')}</a>
          ) : (
            t('Terms: {terms}', { terms: s.terms })
          )}
        </span>
      )}
      {s.sha256 && <CopyHash hash={s.sha256} />}
    </span>
  )
}

function CoversCell({ fields }: { fields: string[] | undefined }) {
  const { t, tn } = useTranslation()
  if (!fields) return t('whole record')
  return (
    <Noted
      value={tn(fields.length, '{count} field', '{count} fields')}
      notes={[fields.join(', ')]}
    />
  )
}

/**
 * One source as a row. `inGroup`: a row under its document's head row, headed by its page (or "No page stated"), the document's title, publisher, edition, terms and hash being in the head.
 */
function SourceRow({ source: s, has, inGroup }: { source: Source; has: Has; inGroup?: boolean }) {
  const { t } = useTranslation()
  const origin = s.origin && origins[s.origin]
  return (
    <TableTr role="row" className={inGroup ? 'source-page-row' : undefined}>
      {inGroup ? (
        <TableTh scope="row" role="rowheader" className="source-page">
          {s.page ? t('Page {page}', { page: s.page }) : t('No page stated')}
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
        <TableTd role="cell" data-label={t('Origin')}>
          {origin ? t(origin) : s.origin}
        </TableTd>
      )}
      {has('retrieved') && (
        <TableTd role="cell" className="nowrap" data-label={t('Retrieved')}>
          {s.retrieved && <Day day={s.retrieved} />}
        </TableTd>
      )}
      {has('license') && (
        <TableTd role="cell" data-label={t('License')}>
          {s.license}
        </TableTd>
      )}
      {has('fields') && (
        <TableTd role="cell" className="nowrap" data-label={t('Covers')}>
          <CoversCell fields={s.fields} />
        </TableTd>
      )}
      {has('note') && (
        <TableTd role="cell" data-label={t('Note')}>
          {s.note && note(s.note)}
        </TableTd>
      )}
    </TableTr>
  )
}

/** The document a source cites: the sources of one document share these. */
const documentKey = (s: Source) =>
  [s.title, s.url, s.publisher, s.edition, s.sha256, s.terms].map((v) => v ?? '').join('\u0000')

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

/**
 * A document cited at several pages: a head row with its title and data (a cell across the row: a
 * header there would head no data cell), a row per page under it.
 */
function SourceGroup({ sources, has, span }: { sources: Source[]; has: Has; span: number }) {
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
            {first.url ? <a href={first.url}>{first.title}</a> : first.title}
          </span>
          <SourceMeta source={first} />
        </TableTd>
      </TableTr>
      {sources.map((s, i) => (
        <SourceRow key={keys[i]} source={s} has={has} inGroup />
      ))}
    </TableTbody>
  )
}

/**
 * The sources of a record as a table, one row per source: the title (linked) with publisher,
 * edition, terms and hash (copyable) under it, the origin, the retrieval day, the license, the
 * record fields it covers (the list on hover; "whole record" beside a source with a field list),
 * its note; then the provenance note. A column no source fills is left out. The sources of one
 * document cited at several pages are one group: the document once, a row per page under it. Below 48em a source is a block, each value after its column's name
 * (`data-label`), so every table element carries its ARIA role.
 */
export function Sources({ provenance }: { provenance: Provenance }) {
  const { t } = useTranslation()
  const list = provenance.sources
  const has = (k: keyof Source) => list.some((s) => s[k] !== undefined)
  const span = 1 + columns.filter(([key]) => has(key)).length
  const groups = groupSources(list)
  return (
    <>
      <ScrollRegion label={t('Sources table')}>
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
              />
            ) : (
              <TableTbody role="rowgroup" key={documentKey(group[0] as Source)}>
                <SourceRow source={group[0] as Source} has={has} />
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
  const { t } = useTranslation()
  return (
    <Link href={`/${kind}/${encodeURIComponent(id)}#record-sources`} target="_blank" rel="noopener">
      {label ?? t('Sources')}
      <span className="visually-hidden"> {t('in a new tab')}</span>
    </Link>
  )
}
