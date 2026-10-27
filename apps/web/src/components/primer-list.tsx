'use client'

import { useDeferredValue, useMemo } from 'react'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText } from '../lib/lists.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { type PrimerRow, primerMatches } from '../lib/primer-rows.ts'
import { titleFromKebab } from '../lib/record-fields.ts'
import type { Origin } from '../lib/sources.ts'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import { SourceFilter } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyList } from './states.tsx'

/** No user record holds a primer: the catalogue is the list's one source, so the filter filters nothing. */
const primerSources: readonly Origin[] = ['openreloading']

/** The primer directory: manufacturer, name, product number, size, magnum flag and priming compound. */
export function PrimerList({ rows }: { rows: PrimerRow[] }) {
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const shown = useMemo(() => rows.filter((r) => primerMatches(r, filters.query)), [rows, filters])
  const query = state.query.trim()
  const named = [query && `matching "${query}"`].filter(Boolean)
  const columns: DirectoryColumn<PrimerRow>[] = [
    {
      key: 'manufacturer',
      label: 'Manufacturer',
      width: '10.5rem',
      dim: true,
      value: (r) => r.manufacturerName,
      cell: (r) => r.manufacturerName,
    },
    { key: 'name', label: 'Name', value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'number',
      label: 'Product number',
      width: '9rem',
      value: (r) => r.productNumber,
      cell: (r) => r.productNumber ?? '',
    },
    {
      key: 'size',
      label: 'Size',
      width: '9rem',
      value: (r) => r.size,
      cell: (r) => titleFromKebab(r.size),
    },
    {
      key: 'magnum',
      label: 'Magnum',
      width: '6rem',
      value: (r) => (r.magnum === undefined ? undefined : r.magnum ? 'yes' : 'no'),
      cell: (r) => (r.magnum === undefined ? '' : r.magnum ? 'Yes' : 'No'),
    },
    {
      key: 'compound',
      label: 'Compound',
      width: '10rem',
      value: (r) => r.compound,
      cell: (r) => (r.compound ? titleFromKebab(r.compound) : ''),
    },
  ]
  const facts = (r: PrimerRow) =>
    [r.manufacturerName, titleFromKebab(r.size), r.compound && titleFromKebab(r.compound)]
      .filter(Boolean)
      .join(' · ')
  return (
    <>
      <PageBar
        title={listTitles.primers}
        status={
          <BarCount widest={`${rows.length} of ${countText(rows.length, rows.length, 'primers')}`}>
            {countText(shown.length, rows.length, 'primers')}
          </BarCount>
        }
      />
      <LibraryTabs />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder="Manufacturer, name or size…"
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
        >
          <SourceFilter
            src={state.sources}
            counts={{ openreloading: rows.length, user: 0 }}
            sources={primerSources}
            onChange={(src) => set({ sources: src })}
          />
        </DirectoryFilters>
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => `/primers/${r.id}`}
          facts={facts}
          label={productLabel}
          caption={named.length === 0 ? 'All primers' : `Primers, ${named.join(', ')}`}
          noun="primers"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="primers" filters={filterText(named)} onClear={clear} />}
        />
      </div>
    </>
  )
}
