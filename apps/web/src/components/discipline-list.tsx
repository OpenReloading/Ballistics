'use client'

import { useCallback, useDeferredValue, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { countryName } from '../lib/countries.ts'
import {
  type DisciplineRow,
  disciplineDistance,
  disciplineFacetKeys,
  disciplineFacets,
  disciplineMatches,
  type FederationRow,
  federationFacetKeys,
  federationFacets,
  federationMatches,
} from '../lib/disciplines.ts'
import { facetNames } from '../lib/facets.ts'
import { listTitles } from '../lib/list-titles.ts'
import { kebabValue } from '../lib/list-values.ts'
import { countText, filterText, matchingText, widestCount } from '../lib/lists.ts'
import type { Origin } from '../lib/sources.ts'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { FacetFilters, useFacets } from './facet-filters.tsx'
import { HomepageLink } from './homepage-link.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import { SourceFilter } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyList } from './states.tsx'

/** Disciplines and federations are rule-book records only: the catalogue is the lists' one source. */
const ruleBookSources: readonly Origin[] = ['openreloading']

/** The discipline directory: name, number, federation, distance, category, caliber classes, faces. */
export function DisciplineList({
  items,
  faces,
}: {
  items: DisciplineRow[]
  /** The faces the disciplines are shot on, for the Face filter's names. */
  faces: readonly { id: string; name: string }[]
}) {
  const tr = useTranslation()
  const { t } = tr
  const [state, set, clear] = useListState(disciplineFacetKeys)
  const filters = useDeferredValue(state)
  const facets = useMemo(
    () => disciplineFacets(items, new Map(faces.map((f) => [f.id, f.name]))),
    [items, faces],
  )
  const searched = useMemo(
    () => items.filter((r) => disciplineMatches(r, filters, t)),
    [items, filters, t],
  )
  const { shown, options } = useFacets(items, searched, facets, filters)
  const named = [...facetNames(facets, state.facets ?? {}, t), matchingText(t, state.query)]
  const classes = (r: DisciplineRow) => r.classes.map((c) => c.name).join(', ')
  const columns: DirectoryColumn<DisciplineRow>[] = [
    { key: 'name', label: msg('Name'), value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'number',
      label: msg('Number'),
      width: '8rem',
      value: (r) => r.number ?? '',
      cell: (r) => r.number,
    },
    {
      key: 'federation',
      label: msg('Federation'),
      width: '7rem',
      value: (r) => r.federation,
      cell: (r) => r.federation,
    },
    {
      key: 'distance',
      label: msg('Distance'),
      num: true,
      width: '9rem',
      value: (r) => r.distance,
      cell: disciplineDistance,
    },
    {
      key: 'category',
      label: msg('Category'),
      width: '11rem',
      value: (r) => r.category ?? '',
      cell: (r) => r.category && kebabValue(t, r.category),
    },
    {
      key: 'classes',
      label: msg('Caliber classes'),
      width: '14rem',
      value: classes,
      cell: classes,
    },
    {
      key: 'faces',
      label: msg('Targets'),
      num: true,
      width: '5rem',
      value: (r) => r.faceIds.length,
      cell: (r) => r.faceIds.length,
    },
  ]
  const facts = (r: DisciplineRow) =>
    [r.federation, r.number, disciplineDistance(r), r.category && kebabValue(t, r.category)]
      .filter(Boolean)
      .join(' · ')
  return (
    <>
      <PageBar
        title={listTitles.disciplines}
        translated
        status={
          <BarCount widest={widestCount(tr, items.length, 'disciplines')}>
            {countText(tr, shown.length, items.length, 'disciplines')}
          </BarCount>
        }
      />
      <LibraryTabs />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder={t('Name, number, federation or caliber, 2.53…')}
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
        >
          <SourceFilter
            src={state.sources}
            counts={{ openreloading: items.length, user: 0 }}
            sources={ruleBookSources}
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
          href={(r) => `/disciplines/${r.id}`}
          facts={facts}
          label={(r) => r.name}
          caption={
            named.filter(Boolean).length === 0
              ? t('All disciplines')
              : t('Disciplines, {filters}', { filters: named.filter(Boolean).join(', ') })
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
  const tr = useTranslation()
  const { t, language } = tr
  // the record prints "International" or an ISO code: a code is named in the language shown
  const country = useCallback(
    (c: string) =>
      c === 'International'
        ? t('International')
        : countryName(c, /^[A-Z]{2}$/.test(c) ? c : undefined, language),
    [t, language],
  )
  const [state, set, clear] = useListState(federationFacetKeys)
  const filters = useDeferredValue(state)
  const searched = useMemo(
    () => items.filter((r) => federationMatches(r, filters, country(r.country))),
    [items, filters, country],
  )
  const { shown, options } = useFacets(items, searched, federationFacets, filters)
  const named = [
    ...facetNames(federationFacets, state.facets ?? {}, t),
    matchingText(t, state.query),
  ]
  const columns: DirectoryColumn<FederationRow>[] = [
    { key: 'name', label: msg('Name'), value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'abbreviation',
      label: msg('Abbreviation'),
      width: '8rem',
      value: (r) => r.abbreviation,
      cell: (r) => r.abbreviation,
    },
    {
      key: 'country',
      label: msg('Country'),
      width: '8rem',
      value: (r) => country(r.country),
      cell: (r) => country(r.country),
    },
    {
      key: 'disciplines',
      label: msg('Disciplines'),
      num: true,
      width: '7rem',
      value: (r) => r.disciplines,
      cell: (r) => r.disciplines,
    },
    {
      key: 'website',
      label: msg('Homepage'),
      width: '12rem',
      value: (r) => r.website ?? '',
      cell: (r, tabIndex) => r.website && <HomepageLink url={r.website} tabIndex={tabIndex} />,
    },
  ]
  const facts = (r: FederationRow) =>
    [
      r.abbreviation,
      country(r.country),
      countText(tr, r.disciplines, r.disciplines, 'disciplines'),
    ].join(' · ')
  return (
    <>
      <PageBar
        title={listTitles.federations}
        translated
        status={
          <BarCount widest={widestCount(tr, items.length, 'federations')}>
            {countText(tr, shown.length, items.length, 'federations')}
          </BarCount>
        }
      />
      <LibraryTabs />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder={t('Name, abbreviation or country, DSB…')}
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
        >
          <SourceFilter
            src={state.sources}
            counts={{ openreloading: items.length, user: 0 }}
            sources={ruleBookSources}
            onChange={(src) => set({ sources: src })}
          />
          <FacetFilters
            facets={federationFacets}
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
          href={(r) => `/federations/${r.id}`}
          facts={facts}
          label={(r) => r.name}
          caption={
            named.filter(Boolean).length === 0
              ? t('All federations')
              : t('Federations, {filters}', { filters: named.filter(Boolean).join(', ') })
          }
          noun="federations"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="federations" filters={filterText(named)} onClear={clear} />}
        />
      </div>
    </>
  )
}
