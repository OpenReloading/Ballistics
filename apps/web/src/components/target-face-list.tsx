'use client'

import { Select } from '@mantine/core'
import { toSi } from '@open-reloading/schema'
import { useDeferredValue, useMemo } from 'react'
import { compareNames } from '../lib/face-order.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText } from '../lib/lists.ts'
import type { Origin } from '../lib/sources.ts'
import { distanceText, type TargetFaceRow, targetFaceMatches } from '../lib/target-faces.ts'
import { controlSize } from '../lib/theme.ts'
import { formatQuantity } from '../lib/units.ts'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { SourceFilter } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyList } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

/** Target faces are rule-book records only: the catalogue is the list's one source. */
const faceSources: readonly Origin[] = ['openreloading']

/** The target face directory: name, federation or issuer, distances, outer diameter, rings, disciplines. */
export function TargetFaceList({ items }: { items: TargetFaceRow[] }) {
  const { system } = useUnits()
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const organizations = useMemo(
    () => [...new Set(items.map((r) => r.organization))].sort(compareNames),
    [items],
  )
  const shown = useMemo(() => items.filter((r) => targetFaceMatches(r, filters)), [items, filters])
  const named = [state.organization, state.query.trim() && `matching "${state.query.trim()}"`]
  const outer = (r: TargetFaceRow) => formatQuantity('length', system, toSi('length', r.outer))
  const columns: DirectoryColumn<TargetFaceRow>[] = [
    { key: 'name', label: 'Name', value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'organization',
      label: 'Federation',
      width: '7rem',
      value: (r) => r.organization,
      cell: (r) => r.organization,
    },
    {
      key: 'distance',
      label: 'Distance',
      unit: 'm',
      width: '8rem',
      value: (r) => r.distances[0],
      cell: (r) => r.distances.join(', '),
    },
    {
      key: 'outer',
      label: 'Outer diameter',
      unit: system.length.symbol,
      num: true,
      width: '8rem',
      value: (r) => r.outer,
      cell: outer,
    },
    {
      key: 'rings',
      label: 'Rings',
      num: true,
      width: '5rem',
      value: (r) => r.rings,
      cell: (r) => r.rings,
    },
    {
      key: 'disciplines',
      label: 'Disciplines',
      num: true,
      width: '7rem',
      value: (r) => r.disciplines,
      cell: (r) => r.disciplines,
    },
  ]
  const facts = (r: TargetFaceRow) =>
    [
      r.organization,
      distanceText(r.distances),
      `${outer(r)} ${system.length.symbol}`,
      `${r.rings} rings`,
    ].join(' · ')
  return (
    <>
      <PageBar
        title={listTitles.targets}
        status={
          <BarCount widest={`${items.length} of ${countText(items.length, items.length, 'faces')}`}>
            {countText(shown.length, items.length, 'faces')}
          </BarCount>
        }
        actions={<UnitsIconButton />}
      />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder="Name, federation or event, 25 m…"
          active={Boolean(state.query || state.organization)}
          onClear={clear}
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
        >
          <SourceFilter
            src={state.sources}
            counts={{ openreloading: items.length, user: 0 }}
            sources={faceSources}
            onChange={(src) => set({ sources: src })}
          />
          <Select
            aria-label="Federation"
            placeholder="Federation"
            size={controlSize.row.input}
            clearable
            data={organizations}
            value={state.organization || null}
            onChange={(v) => set({ organization: v ?? '' })}
          />
        </DirectoryFilters>
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => `/targets/${r.id}`}
          facts={facts}
          label={(r) => r.name}
          caption={
            named.filter(Boolean).length === 0
              ? 'All target faces'
              : `Target faces, ${named.filter(Boolean).join(', ')}`
          }
          noun="faces"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="target faces" filters={filterText(named)} />}
        />
      </div>
    </>
  )
}
