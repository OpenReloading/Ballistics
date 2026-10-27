'use client'

import { toSi } from '@open-reloading/schema'
import { useDeferredValue, useMemo } from 'react'
import { type CaseRow, caseMatches } from '../lib/case-rows.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText } from '../lib/lists.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { titleFromKebab } from '../lib/record-fields.ts'
import type { Origin } from '../lib/sources.ts'
import { formatQuantity, waterVolume } from '../lib/units.ts'
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
import { UnitsIconButton, useUnits } from './units-settings.tsx'

/** No user record holds a case: the catalogue is the list's one source, so the filter filters nothing. */
const caseSources: readonly Origin[] = ['openreloading']

/** The case directory: manufacturer, name, cartridge, material, empty mass and the stated water capacity. */
export function CaseList({ rows }: { rows: CaseRow[] }) {
  const { system } = useUnits()
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const shown = useMemo(() => rows.filter((r) => caseMatches(r, filters.query)), [rows, filters])
  const query = state.query.trim()
  const named = [query && `matching "${query}"`].filter(Boolean)
  const columns: DirectoryColumn<CaseRow>[] = [
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
      key: 'cartridge',
      label: 'Cartridge',
      width: '9rem',
      value: (r) => r.cartridgeName,
      cell: (r) => r.cartridgeName,
    },
    {
      key: 'material',
      label: 'Material',
      width: '10rem',
      value: (r) => r.material,
      cell: (r) => titleFromKebab(r.material),
    },
    {
      key: 'mass',
      label: 'Mass',
      unit: system.mass.symbol,
      num: true,
      width: '6rem',
      value: (r) => r.mass,
      cell: (r) =>
        r.mass === undefined ? '' : formatQuantity('mass', system, toSi('mass', r.mass)),
    },
    {
      key: 'capacity',
      label: 'Water capacity',
      unit: system.capacity.symbol,
      help: 'The water the manufacturer states fills the case to the mouth.',
      num: true,
      width: '8rem',
      value: (r) => r.waterCapacity,
      cell: (r) =>
        r.waterCapacity === undefined
          ? ''
          : formatQuantity('capacity', system, waterVolume(r.waterCapacity)),
    },
  ]
  const facts = (r: CaseRow) =>
    [r.manufacturerName, r.cartridgeName, titleFromKebab(r.material)].filter(Boolean).join(' · ')
  return (
    <>
      <PageBar
        title={listTitles.cases}
        status={
          <BarCount widest={`${rows.length} of ${countText(rows.length, rows.length, 'cases')}`}>
            {countText(shown.length, rows.length, 'cases')}
          </BarCount>
        }
        actions={<UnitsIconButton />}
      />
      <LibraryTabs />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder="Manufacturer, name or cartridge…"
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
        >
          <SourceFilter
            src={state.sources}
            counts={{ openreloading: rows.length, user: 0 }}
            sources={caseSources}
            onChange={(src) => set({ sources: src })}
          />
        </DirectoryFilters>
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => `/cases/${r.id}`}
          facts={facts}
          label={productLabel}
          caption={named.length === 0 ? 'All cases' : `Cases, ${named.join(', ')}`}
          noun="cases"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="cases" filters={filterText(named)} onClear={clear} />}
        />
      </div>
    </>
  )
}
