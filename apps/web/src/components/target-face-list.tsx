'use client'

import { useLingui } from '@lingui/react'
import { Button } from '@mantine/core'
import { toSi } from '@rangefoundry/schema'
import { Plus } from 'lucide-react'
import { useCallback, useDeferredValue, useMemo } from 'react'
import Link from '@/platform/link.tsx'
import { loadEnglish, ungrouped } from '../i18n/lingui.ts'
import { plainNumber } from '../i18n/number.ts'
import { facetNames } from '../lib/facets.ts'
import { listTitles } from '../lib/list-titles.ts'
import { filterText, matchingText } from '../lib/lists.ts'
import {
  countOrigins,
  designerHref,
  inOrigins,
  onlyText,
  originNames,
  readOrigins,
} from '../lib/sources.ts'
import {
  faceFacetKeys,
  faceFacets,
  type TargetFaceRow,
  targetFaceMatches,
  userFaceRows,
} from '../lib/target-faces.ts'
import { formatQuantity } from '../lib/units.ts'
import englishMessages from '../locales/en/components/target-face-list.json' with { type: 'json' }
import { DirectoryPage } from './directory-page.tsx'
import { type DirectoryColumn, DirectoryTable, useListState } from './directory-table.tsx'
import { FacetFilters, useFacets } from './facet-filters.tsx'
import { DeleteRow, sourceColumn, useUserRecords } from './list-sources.tsx'
import { EmptyList } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

loadEnglish(englishMessages)

/** The face designs of this browser are Mine rows, opened in the face designer. */
export function TargetFaceList({
  items: catalogue,
  disciplines,
}: {
  items: TargetFaceRow[]
  /** The names of the disciplines by id, for the Discipline filter. */
  disciplines: readonly { id: string; name: string }[]
}) {
  const { i18n } = useLingui()
  const { system } = useUnits()
  const [records, removeRow] = useUserRecords()
  // the browser's faces first: a few rows would sit unseen behind the catalogue's
  const items = useMemo(() => [...userFaceRows(records), ...catalogue], [records, catalogue])
  const counts = useMemo(() => countOrigins(items), [items])
  const [state, set, clear] = useListState(faceFacetKeys)
  const filters = useDeferredValue(state)
  // to 2 decimals: 50 yd is 45.72 m
  const distance = useCallback(
    (m: number) => plainNumber(Number(system.range.fromSi(m).toFixed(2))),
    [system],
  )
  const facets = useMemo(
    () =>
      faceFacets(
        new Map(disciplines.map((d) => [d.id, d.name])),
        (m) => `${distance(m)} ${system.range.symbol}`,
      ),
    [disciplines, distance, system],
  )
  const searched = useMemo(
    () => items.filter((r) => inOrigins(r, filters.sources) && targetFaceMatches(r, filters.query)),
    [items, filters],
  )
  const { shown, options } = useFacets(items, searched, facets, filters)
  const named = [
    onlyText(i18n, readOrigins(state.sources)),
    ...facetNames(facets, state.facets ?? {}, i18n),
    matchingText(i18n, state.query),
  ]
  const outer = (r: TargetFaceRow) =>
    r.outer === undefined ? '' : formatQuantity('length', system, toSi('length', r.outer))
  const distances = (r: TargetFaceRow) => r.distances.map((m) => distance(m)).join(', ')
  const columns: DirectoryColumn<TargetFaceRow>[] = [
    {
      key: 'name',
      label: /*i18n*/ { id: 'targets.column.name', message: 'Name' },
      value: (r) => r.name,
      cell: (r) => r.name,
    },
    {
      key: 'organization',
      label: /*i18n*/ { id: 'targets.column.organization', message: 'Federation' },
      width: '7rem',
      value: (r) => r.organization,
      cell: (r) => r.organization,
    },
    {
      key: 'distance',
      label: /*i18n*/ { id: 'targets.column.distance', message: 'Distance' },
      unit: system.range.symbol,
      width: '8rem',
      value: (r) => r.distances[0],
      cell: distances,
    },
    {
      key: 'outer',
      label: /*i18n*/ { id: 'targets.column.outer', message: 'Outer diameter' },
      unit: system.length.symbol,
      num: true,
      width: '8rem',
      value: (r) => r.outer,
      cell: outer,
    },
    {
      key: 'rings',
      label: /*i18n*/ { id: 'targets.column.rings', message: 'Rings' },
      num: true,
      width: '5rem',
      value: (r) => r.rings,
      cell: (r) => r.rings,
    },
    {
      key: 'disciplines',
      label: /*i18n*/ { id: 'targets.column.disciplines', message: 'Disciplines' },
      num: true,
      width: '7rem',
      value: (r) => r.disciplines,
      cell: (r) => r.disciplines,
    },
    ...(counts.user > 0 ? [sourceColumn<TargetFaceRow>((r) => r.name, removeRow)] : []),
  ]
  const facts = (r: TargetFaceRow) =>
    [
      r.origin === 'user' && i18n._(originNames.user),
      r.organization,
      r.distances.length > 0 ? `${distances(r)} ${system.range.symbol}` : '',
      r.outer !== undefined && `${outer(r)} ${system.length.symbol}`,
      i18n._(
        'targets.rings',
        { count: r.rings },
        { message: '{count, plural, one {# ring} other {# rings}}', formats: ungrouped },
      ),
    ]
      .filter(Boolean)
      .join(' · ')
  return (
    <DirectoryPage
      title={listTitles.targets}
      noun="faces"
      shown={shown.length}
      total={items.length}
      actions={
        <>
          <Button
            component={Link}
            href="/targets/designer"
            leftSection={<Plus aria-hidden="true" />}
          >
            {i18n._({ id: 'targets.new', message: 'New target' })}
          </Button>
          <UnitsIconButton />
        </>
      }
      state={state}
      set={set}
      placeholder={i18n._({ id: 'targets.search', message: 'Name, federation or event, 25 m…' })}
      columns={columns}
      counts={counts}
      filters={
        <FacetFilters
          facets={facets}
          options={options}
          state={state}
          onChange={(next) => set({ facets: next })}
          onClear={clear}
        />
      }
      table={
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => (r.origin === 'user' ? designerHref('targets', r.id) : `/targets/${r.id}`)}
          facts={facts}
          label={(r) => r.name}
          caption={
            named.filter(Boolean).length === 0
              ? i18n._({ id: 'targets.all', message: 'All targets' })
              : i18n._({
                  id: 'targets.filtered',
                  message: 'Targets, {filters}',
                  values: { filters: named.filter(Boolean).join(', ') },
                })
          }
          noun="faces"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          phoneAction={(r, tabIndex) =>
            r.origin === 'user' ? (
              <DeleteRow row={r} name={r.name} onDelete={removeRow} tabIndex={tabIndex} />
            ) : null
          }
          breakBefore={state.sort ? undefined : (r, previous) => r.origin !== previous.origin}
          empty={<EmptyList noun="target faces" filters={filterText(named)} onClear={clear} />}
        />
      }
    />
  )
}
