'use client'

import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from '@mantine/core'
import { isWebLink, type Provenance, type Source } from '@open-reloading/schema'
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

function SourceRow({ source: s, has }: { source: Source; has: Has }) {
  const { t } = useTranslation()
  const origin = s.origin && origins[s.origin]
  return (
    <TableTr role="row">
      <TableTh scope="row" role="rowheader">
        <span className="source-title">
          <SourceLink source={s} />
        </span>
        <SourceMeta source={s} />
      </TableTh>
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

/**
 * The sources of a record as a table, one row per source: the title (linked) with publisher,
 * edition, terms and hash (copyable) under it, the origin, the retrieval day, the license, the
 * record fields it covers (the list on hover; "whole record" beside a source with a field list),
 * its note; then the provenance note. A column no source fills is left out. Below 48em a source is a block, each value after its column's name
 * (`data-label`), so every table element carries its ARIA role.
 */
export function Sources({ provenance }: { provenance: Provenance }) {
  const { t } = useTranslation()
  const list = provenance.sources
  const has = (k: keyof Source) => list.some((s) => s[k] !== undefined)
  return (
    <>
      <ScrollRegion label={t('Sources table')}>
        <Table className="sources" role="table">
          <TableThead role="rowgroup">
            <SourcesHead has={has} />
          </TableThead>
          <TableTbody role="rowgroup">
            {list.map((s) => (
              <SourceRow key={`${s.title} ${s.url ?? ''} ${s.page ?? ''}`} source={s} has={has} />
            ))}
          </TableTbody>
        </Table>
      </ScrollRegion>
      {provenance.note && <p>{note(provenance.note)}</p>}
    </>
  )
}

/** The compact form for a line of a tool: the titles (linked), separated by semicolons. */
export function SourceTitles({ sources }: { sources: Source[] }) {
  return sources.map((s, i) => (
    <span key={`${s.title} ${s.url ?? ''} ${s.page ?? ''}`}>
      {i > 0 && '; '}
      <SourceLink source={s} />
    </span>
  ))
}
