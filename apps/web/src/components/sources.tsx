import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from '@mantine/core'
import { isWebLink } from '@open-reloading/schema'
import type { Provenance, Source } from '../lib/api-types.ts'
import { dayText } from '../lib/dates.ts'
import { Noted } from './field-table.tsx'
import { CopyHash } from './record-actions.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { SourceLink } from './source-link.tsx'

/** A record note without its notice: a page carries one model note at most, prints none. */
const note = (text: string) => text.replaceAll(', not load data', '')

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
            <TableTr role="row">
              <TableTh scope="col" role="columnheader">
                Source
              </TableTh>
              {has('origin') && (
                <TableTh scope="col" role="columnheader">
                  Origin
                </TableTh>
              )}
              {has('retrieved') && (
                <TableTh scope="col" role="columnheader">
                  Retrieved
                </TableTh>
              )}
              {has('license') && (
                <TableTh scope="col" role="columnheader">
                  License
                </TableTh>
              )}
              {has('fields') && (
                <TableTh scope="col" role="columnheader">
                  Covers
                </TableTh>
              )}
              {has('note') && (
                <TableTh scope="col" role="columnheader">
                  Note
                </TableTh>
              )}
            </TableTr>
          </TableThead>
          <TableTbody role="rowgroup">
            {list.map((s) => (
              <TableTr key={`${s.title} ${s.url ?? ''} ${s.page ?? ''}`} role="row">
                <TableTh scope="row" role="rowheader">
                  <span className="source-title">
                    <SourceLink source={s} />
                  </span>
                  <span className="source-meta">
                    {s.publisher && <span>{s.publisher}</span>}
                    {s.edition && <span>{s.edition}</span>}
                    {s.terms && (
                      <span>
                        {isWebLink(s.terms) ? <a href={s.terms}>Terms</a> : `Terms: ${s.terms}`}
                      </span>
                    )}
                    {s.sha256 && <CopyHash hash={s.sha256} />}
                  </span>
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
                    {s.fields ? (
                      <Noted
                        value={`${s.fields.length} ${s.fields.length === 1 ? 'field' : 'fields'}`}
                        notes={[s.fields.join(', ')]}
                      />
                    ) : (
                      'whole record'
                    )}
                  </TableTd>
                )}
                {has('note') && (
                  <TableTd role="cell" data-label="Note">
                    {s.note && note(s.note)}
                  </TableTd>
                )}
              </TableTr>
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
