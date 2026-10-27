'use client'

import { useDeferredValue, useMemo } from 'react'
import {
  type DisciplineRow,
  disciplineMatches,
  type FederationRow,
  federationMatches,
} from '../lib/disciplines.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText } from '../lib/lists.ts'
import { titleFromKebab } from '../lib/record-fields.ts'
import type { Origin } from '../lib/sources.ts'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { HomepageLink } from './homepage-link.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import { SourceFilter } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyList } from './states.tsx'

/** Disciplines and federations are rule-book records only: the catalogue is the lists' one source. */
const ruleBookSources: readonly Origin[] = ['openreloading']

/** The discipline directory: name, number, federation, distance, category, caliber classes, faces. */
export function DisciplineList({ items }: { items: DisciplineRow[] }) {
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const shown = useMemo(() => items.filter((r) => disciplineMatches(r, filters)), [items, filters])
  const named = [state.organization, state.query.trim() && `matching "${state.query.trim()}"`]
  const classes = (r: DisciplineRow) => r.classes.map((c) => c.name).join(', ')
  const columns: DirectoryColumn<DisciplineRow>[] = [
    { key: 'name', label: 'Name', value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'number',
      label: 'Number',
      width: '8rem',
      value: (r) => r.number ?? '',
      cell: (r) => r.number,
    },
    {
      key: 'federation',
      label: 'Federation',
      width: '7rem',
      value: (r) => r.federation,
      cell: (r) => r.federation,
    },
    {
      key: 'distance',
      label: 'Distance',
      unit: 'm',
      num: true,
      width: '6rem',
      value: (r) => r.distance,
      cell: (r) => r.distance,
    },
    {
      key: 'category',
      label: 'Category',
      width: '9rem',
      value: (r) => r.category ?? '',
      cell: (r) => r.category && titleFromKebab(r.category),
    },
    { key: 'classes', label: 'Caliber classes', width: '14rem', value: classes, cell: classes },
    {
      key: 'faces',
      label: 'Faces',
      num: true,
      width: '5rem',
      value: (r) => r.faces,
      cell: (r) => r.faces,
    },
  ]
  const facts = (r: DisciplineRow) =>
    [r.federation, r.number, `${r.distance} m`, r.category && titleFromKebab(r.category)]
      .filter(Boolean)
      .join(' · ')
  return (
    <>
      <PageBar
        title={listTitles.disciplines}
        translated
        status={
          <BarCount
            widest={`${items.length} of ${countText(items.length, items.length, 'disciplines')}`}
          >
            {countText(shown.length, items.length, 'disciplines')}
          </BarCount>
        }
      />
      <LibraryTabs />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder="Name, number, federation or caliber, 2.53…"
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
          scope={
            state.organization
              ? {
                  label: `Federation ${state.organization}`,
                  onRemove: () => set({ organization: '' }),
                }
              : undefined
          }
        >
          <SourceFilter
            src={state.sources}
            counts={{ openreloading: items.length, user: 0 }}
            sources={ruleBookSources}
            onChange={(src) => set({ sources: src })}
          />
        </DirectoryFilters>
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => `/disciplines/${r.id}`}
          facts={facts}
          label={(r) => r.name}
          caption={
            named.filter(Boolean).length === 0
              ? 'All disciplines'
              : `Disciplines, ${named.filter(Boolean).join(', ')}`
          }
          noun="disciplines"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="disciplines" filters={filterText(named)} onClear={clear} />}
        />
      </div>
    </>
  )
}

/** The federation directory: name, abbreviation, country, rule books, disciplines and faces. */
export function FederationList({ items }: { items: FederationRow[] }) {
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const shown = useMemo(() => items.filter((r) => federationMatches(r, filters)), [items, filters])
  const query = state.query.trim()
  const columns: DirectoryColumn<FederationRow>[] = [
    { key: 'name', label: 'Name', value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'abbreviation',
      label: 'Abbreviation',
      width: '8rem',
      value: (r) => r.abbreviation,
      cell: (r) => r.abbreviation,
    },
    {
      key: 'country',
      label: 'Country',
      width: '8rem',
      value: (r) => r.country,
      cell: (r) => r.country,
    },
    {
      key: 'disciplines',
      label: 'Disciplines',
      num: true,
      width: '7rem',
      value: (r) => r.disciplines,
      cell: (r) => r.disciplines,
    },
    {
      key: 'website',
      label: 'Homepage',
      width: '12rem',
      value: (r) => r.website ?? '',
      cell: (r, tabIndex) => r.website && <HomepageLink url={r.website} tabIndex={tabIndex} />,
    },
  ]
  const facts = (r: FederationRow) =>
    [r.abbreviation, r.country, countText(r.disciplines, r.disciplines, 'disciplines')].join(' · ')
  return (
    <>
      <PageBar
        title={listTitles.federations}
        translated
        status={
          <BarCount
            widest={`${items.length} of ${countText(items.length, items.length, 'federations')}`}
          >
            {countText(shown.length, items.length, 'federations')}
          </BarCount>
        }
      />
      <LibraryTabs />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder="Name, abbreviation or country, DSB…"
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
        >
          <SourceFilter
            src={state.sources}
            counts={{ openreloading: items.length, user: 0 }}
            sources={ruleBookSources}
            onChange={(src) => set({ sources: src })}
          />
        </DirectoryFilters>
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => `/federations/${r.id}`}
          facts={facts}
          label={(r) => r.name}
          caption={query ? `Federations, matching "${query}"` : 'All federations'}
          noun="federations"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={
            <EmptyList
              noun="federations"
              filters={filterText([query && `matching "${query}"`])}
              onClear={clear}
            />
          }
        />
      </div>
    </>
  )
}
