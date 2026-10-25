import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from '@mantine/core'
import { isWebLink, type Provenance, type Source } from '@open-reloading/schema'
import { dayText } from '../lib/dates.ts'
import { Noted } from './field-table.tsx'
import { CopyHash } from './record-actions.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { SourceLink } from './source-link.tsx'

/** A record note without its notice: a page carries one model note at most, prints none. */
const note = (text: string) => text.replaceAll(', not load data', '')

type Has = (k: keyof Source) => boolean

function SourcesHead({ has }: { has: Has }) {
  const columns: [keyof Source, string][] = [
    ['origin', 'Origin'],
    ['retrieved', 'Retrieved'],
    ['license', 'License'],
    ['fields', 'Covers'],
    ['note', 'Note'],
  ]
  return (
    <TableTr role="row">
      <TableTh scope="col" role="columnheader">
        Source
      </TableTh>
      {columns
        .filter(([key]) => has(key))
        .map(([key, label]) => (
          <TableTh key={key} scope="col" role="columnheader">
            {label}
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
      {s.terms && (
        <span>{isWebLink(s.terms) ? <a href={s.terms}>Terms</a> : `Terms: ${s.terms}`}</span>
      )}
      {s.sha256 && <CopyHash hash={s.sha256} />}
    </span>
  )
}

function CoversCell({ fields }: { fields: string[] | undefined }) {
  if (!fields) return 'whole record'
  return (
    <Noted
      value={`${fields.length} ${fields.length === 1 ? 'field' : 'fields'}`}
      notes={[fields.join(', ')]}
    />
  )
}

function SourceRow({ source: s, has }: { source: Source; has: Has }) {
  return (
    <TableTr role="row">
      <TableTh scope="row" role="rowheader">
        <span className="source-title">
          <SourceLink source={s} />
        </span>
        <SourceMeta source={s} />
      </TableTh>
      {has('origin') && (
        <TableTd role="cell" data-label="Origin">
          {s.origin}
        </TableTd>
      )}
      {has('retrieved') && (
        <TableTd role="cell" className="nowrap" data-label="Retrieved">
          {s.retrieved && <time dateTime={s.retrieved}>{dayText(s.retrieved)}</time>}
        </TableTd>
      )}
      {has('license') && (
        <TableTd role="cell" data-label="License">
          {s.license}
        </TableTd>
      )}
      {has('fields') && (
        <TableTd role="cell" className="nowrap" data-label="Covers">
          <CoversCell fields={s.fields} />
        </TableTd>
      )}
      {has('note') && (
        <TableTd role="cell" data-label="Note">
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
  const list = provenance.sources
  const has = (k: keyof Source) => list.some((s) => s[k] !== undefined)
  return (
    <>
      <ScrollRegion label="Sources table">
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
