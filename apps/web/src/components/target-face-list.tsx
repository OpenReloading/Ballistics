'use client'

import { Button } from '@mantine/core'
import { toSi } from '@open-reloading/schema'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import { facetNames } from '../lib/facets.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText, matchingText, widestCount } from '../lib/lists.ts'
import type { Origin } from '../lib/sources.ts'
import {
  faceFacetKeys,
  faceFacets,
  type TargetFaceRow,
  targetFaceMatches,
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
import { SourceFilter } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyList } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

/** Target faces are rule-book records only: the catalogue is the list's one source. */
const faceSources: readonly Origin[] = ['openreloading']

/** The target face directory: name, federation or issuer, distances, outer diameter, rings, disciplines. */
export function TargetFaceList({
  items,
  disciplines,
}: {
  items: TargetFaceRow[]
  /** The names of the disciplines by id, for the Discipline filter. */
  disciplines: readonly { id: string; name: string }[]
}) {
  const tr = useTranslation()
  const { t, tn } = tr
  const { system } = useUnits()
  const [state, set, clear] = useListState(faceFacetKeys)
  const filters = useDeferredValue(state)
  const facets = useMemo(
    () => faceFacets(new Map(disciplines.map((d) => [d.id, d.name]))),
    [disciplines],
  )
  const searched = useMemo(
    () => items.filter((r) => targetFaceMatches(r, filters.query)),
    [items, filters],
  )
  const { shown, options } = useFacets(items, searched, facets, filters)
  const named = [...facetNames(facets, state.facets ?? {}, t), matchingText(t, state.query)]
  const outer = (r: TargetFaceRow) => formatQuantity('length', system, toSi('length', r.outer))
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
      unit: 'm',
      width: '8rem',
      value: (r) => r.distances[0],
      cell: (r) => r.distances.map((d) => plainNumber(d)).join(', '),
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
  ]
  const facts = (r: TargetFaceRow) =>
    [
      r.organization,
      r.distances.length > 0 ? `${r.distances.map((d) => plainNumber(d)).join(', ')} m` : '',
      `${outer(r)} ${system.length.symbol}`,
      tn(r.rings, '{count} ring', '{count} rings'),
    ].join(' · ')
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
              {t('New face')}
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
            counts={{ openreloading: items.length, user: 0 }}
            sources={faceSources}
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
          href={(r) => `/targets/${r.id}`}
          facts={facts}
          label={(r) => r.name}
          caption={
            named.filter(Boolean).length === 0
              ? t('All target faces')
              : t('Target faces, {filters}', { filters: named.filter(Boolean).join(', ') })
          }
          noun="faces"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="target faces" filters={filterText(named)} onClear={clear} />}
        />
      </div>
    </>
  )
}
