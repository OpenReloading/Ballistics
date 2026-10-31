'use client'

import { Button } from '@mantine/core'
import { toSi } from '@open-reloading/schema'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { facetNames } from '../lib/facets.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText, matchingText, widestCount } from '../lib/lists.ts'
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
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { FacetFilters, useFacets } from './facet-filters.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import { DeleteRow, SourceFilter, sourceColumn, useUserRecords } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyList } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

/**
 * The target face directory: name, federation or issuer, distances, outer diameter, rings,
 * disciplines. The face designs of this browser are Mine rows, opened in the face designer.
 */
export function TargetFaceList({
  items: catalogue,
  disciplines,
}: {
  items: TargetFaceRow[]
  /** The names of the disciplines by id, for the Discipline filter. */
  disciplines: readonly { id: string; name: string }[]
}) {
  const tr = useTranslation()
  const { t, tn } = tr
  const { system } = useUnits()
  const [records, removeRow] = useUserRecords()
  // the browser's faces first: a few rows would sit unseen behind the catalogue's
  const items = useMemo(() => [...userFaceRows(records), ...catalogue], [records, catalogue])
  const counts = useMemo(() => countOrigins(items), [items])
  const [state, set, clear] = useListState(faceFacetKeys)
  const filters = useDeferredValue(state)
  const facets = useMemo(
    () => faceFacets(new Map(disciplines.map((d) => [d.id, d.name]))),
    [disciplines],
  )
  const searched = useMemo(
    () => items.filter((r) => inOrigins(r, filters.sources) && targetFaceMatches(r, filters.query)),
    [items, filters],
  )
  const { shown, options } = useFacets(items, searched, facets, filters)
  const named = [
    onlyText(t, readOrigins(state.sources)),
    ...facetNames(facets, state.facets ?? {}, t),
    matchingText(t, state.query),
  ]
  const outer = (r: TargetFaceRow) =>
    r.outer === undefined ? '' : formatQuantity('length', system, toSi('length', r.outer))
  const distances = (r: TargetFaceRow) =>
    r.distances.map((d) => formatQuantity('range', system, d)).join(', ')
  const columns: DirectoryColumn<TargetFaceRow>[] = [
    { key: 'name', label: msg('Name'), value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'organization',
      label: msg('Federation'),
      width: '7rem',
      value: (r) => r.organization,
      cell: (r) => r.organization,
    },
    {
      key: 'distance',
      label: msg('Distance'),
      unit: system.range.symbol,
      width: '8rem',
      value: (r) => r.distances[0],
      cell: distances,
    },
    {
      key: 'outer',
      label: msg('Outer diameter'),
      unit: system.length.symbol,
      num: true,
      width: '8rem',
      value: (r) => r.outer,
      cell: outer,
    },
    {
      key: 'rings',
      label: msg('Rings'),
      num: true,
      width: '5rem',
      value: (r) => r.rings,
      cell: (r) => r.rings,
    },
    {
      key: 'disciplines',
      label: msg('Disciplines'),
      num: true,
      width: '7rem',
      value: (r) => r.disciplines,
      cell: (r) => r.disciplines,
    },
    ...(counts.user > 0 ? [sourceColumn<TargetFaceRow>((r) => r.name, removeRow)] : []),
  ]
  const facts = (r: TargetFaceRow) =>
    [
      r.origin === 'user' && t(originNames.user),
      r.organization,
      r.distances.length > 0 ? `${distances(r)} ${system.range.symbol}` : '',
      r.outer !== undefined && `${outer(r)} ${system.length.symbol}`,
      tn(r.rings, '{count} ring', '{count} rings'),
    ]
      .filter(Boolean)
      .join(' · ')
  return (
    <>
      <PageBar
        title={listTitles.targets}
        translated
        status={
          <BarCount widest={widestCount(tr, items.length, 'faces')}>
            {countText(tr, shown.length, items.length, 'faces')}
          </BarCount>
        }
        actions={
          <>
            <Button
              component={Link}
              href="/targets/designer"
              leftSection={<Plus aria-hidden="true" />}
            >
              {t('New target')}
            </Button>
            <UnitsIconButton />
          </>
        }
      />
      <LibraryTabs />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder={t('Name, federation or event, 25 m…')}
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
        >
          <SourceFilter
            src={state.sources}
            counts={counts}
            onChange={(src) => set({ sources: src })}
          />
          <FacetFilters
            facets={facets}
            options={options}
            state={state}
            onChange={(next) => set({ facets: next })}
            onClear={clear}
          />
        </DirectoryFilters>
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => (r.origin === 'user' ? designerHref('targets', r.id) : `/targets/${r.id}`)}
          facts={facts}
          label={(r) => r.name}
          caption={
            named.filter(Boolean).length === 0
              ? t('All targets')
              : t('Targets, {filters}', { filters: named.filter(Boolean).join(', ') })
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
      </div>
    </>
  )
}
