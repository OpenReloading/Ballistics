'use client'

import { useLingui } from '@lingui/react'
import { useCallback, useDeferredValue, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish } from '../i18n/lingui.ts'
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
import { countText, filterText, matchingText } from '../lib/lists.ts'
import type { Origin } from '../lib/sources.ts'
import englishMessages from '../locales/en/components/discipline-list.json' with { type: 'json' }
import { DirectoryPage } from './directory-page.tsx'
import { type DirectoryColumn, DirectoryTable, useListState } from './directory-table.tsx'
import { FacetFilters, useFacets } from './facet-filters.tsx'
import { HomepageLink } from './homepage-link.tsx'
import { EmptyList } from './states.tsx'

loadEnglish(englishMessages)

/** Disciplines and federations are rule-book records only: the catalogue is the lists' one source. */
const ruleBookSources: readonly Origin[] = ['rangefoundry']

/** The discipline directory: name, number, federation, distance, category, caliber classes, faces. */
export function DisciplineList({
  items,
  faces,
}: {
  items: DisciplineRow[]
  /** The faces the disciplines are shot on, for the Face filter's names. */
  faces: readonly { id: string; name: string }[]
}) {
  const { i18n } = useLingui()
  const [state, set, clear] = useListState(disciplineFacetKeys)
  const filters = useDeferredValue(state)
  const facets = useMemo(
    () => disciplineFacets(items, new Map(faces.map((f) => [f.id, f.name]))),
    [items, faces],
  )
  const searched = useMemo(
    () => items.filter((r) => disciplineMatches(r, filters, i18n)),
    [items, filters, i18n],
  )
  const { shown, options } = useFacets(items, searched, facets, filters)
  const named = [...facetNames(facets, state.facets ?? {}, i18n), matchingText(i18n, state.query)]
  const classes = (r: DisciplineRow) => r.classes.map((c) => c.name).join(', ')
  const columns: DirectoryColumn<DisciplineRow>[] = [
    {
      key: 'name',
      label: /*i18n*/ { id: 'disciplines.column.name', message: 'Name' },
      value: (r) => r.name,
      cell: (r) => r.name,
    },
    {
      key: 'number',
      label: /*i18n*/ { id: 'disciplines.column.number', message: 'Number' },
      width: '8rem',
      value: (r) => r.number ?? '',
      cell: (r) => r.number,
    },
    {
      key: 'federation',
      label: /*i18n*/ { id: 'disciplines.column.federation', message: 'Federation' },
      width: '7rem',
      value: (r) => r.federation,
      cell: (r) => r.federation,
    },
    {
      key: 'distance',
      label: /*i18n*/ { id: 'disciplines.column.distance', message: 'Distance' },
      num: true,
      width: '9rem',
      value: (r) => r.distance,
      cell: disciplineDistance,
    },
    {
      key: 'category',
      wide: true,
      label: /*i18n*/ { id: 'disciplines.column.category', message: 'Category' },
      width: '11rem',
      value: (r) => r.category ?? '',
      cell: (r) => r.category && kebabValue(i18n, r.category),
    },
    {
      key: 'classes',
      wide: true,
      label: /*i18n*/ { id: 'disciplines.column.classes', message: 'Caliber classes' },
      width: '14rem',
      value: classes,
      cell: classes,
    },
    {
      key: 'faces',
      label: /*i18n*/ { id: 'disciplines.column.faces', message: 'Targets' },
      num: true,
      width: '5rem',
      value: (r) => r.faceIds.length,
      cell: (r) => r.faceIds.length,
    },
  ]
  const facts = (r: DisciplineRow) =>
    [r.federation, r.number, disciplineDistance(r), r.category && kebabValue(i18n, r.category)]
      .filter(Boolean)
      .join(' · ')
  return (
    <DirectoryPage
      title={listTitles.disciplines}
      noun="disciplines"
      shown={shown.length}
      total={items.length}
      state={state}
      set={set}
      placeholder={i18n._({
        id: 'disciplines.search',
        message: 'Name, number, federation or caliber, 2.53…',
      })}
      columns={columns}
      counts={{ rangefoundry: items.length, user: 0 }}
      sources={ruleBookSources}
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
          href={(r) => `/disciplines/${r.id}`}
          facts={facts}
          label={(r) => r.name}
          caption={
            named.filter(Boolean).length === 0
              ? i18n._({ id: 'disciplines.all', message: 'All disciplines' })
              : i18n._({
                  id: 'disciplines.filtered',
                  message: 'Disciplines, {filters}',
                  values: { filters: named.filter(Boolean).join(', ') },
                })
          }
          noun="disciplines"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="disciplines" filters={filterText(named)} onClear={clear} />}
        />
      }
    />
  )
}

/** The federation directory: name, abbreviation, country, rule books, disciplines and faces. */
export function FederationList({ items }: { items: FederationRow[] }) {
  const tr = useTranslation()
  const { i18n } = useLingui()
  const { language } = tr
  // the record prints "International" or an ISO code: a code is named in the language shown
  const country = useCallback(
    (c: string) =>
      c === 'International'
        ? i18n._({ id: 'disciplines.international', message: 'International' })
        : countryName(c, /^[A-Z]{2}$/.test(c) ? c : undefined, language),
    [i18n, language],
  )
  const [state, set, clear] = useListState(federationFacetKeys)
  const filters = useDeferredValue(state)
  const searched = useMemo(
    () => items.filter((r) => federationMatches(r, filters, country(r.country))),
    [items, filters, country],
  )
  const { shown, options } = useFacets(items, searched, federationFacets, filters)
  const named = [
    ...facetNames(federationFacets, state.facets ?? {}, i18n),
    matchingText(i18n, state.query),
  ]
  const columns: DirectoryColumn<FederationRow>[] = [
    {
      key: 'name',
      label: /*i18n*/ { id: 'disciplines.column.name', message: 'Name' },
      value: (r) => r.name,
      cell: (r) => r.name,
    },
    {
      key: 'abbreviation',
      label: /*i18n*/ { id: 'disciplines.column.abbreviation', message: 'Abbreviation' },
      width: '8rem',
      value: (r) => r.abbreviation,
      cell: (r) => r.abbreviation,
    },
    {
      key: 'country',
      label: /*i18n*/ { id: 'disciplines.column.country', message: 'Country' },
      width: '8rem',
      value: (r) => country(r.country),
      cell: (r) => country(r.country),
    },
    {
      key: 'disciplines',
      label: /*i18n*/ { id: 'disciplines.column.disciplines', message: 'Disciplines' },
      num: true,
      width: '7rem',
      value: (r) => r.disciplines,
      cell: (r) => r.disciplines,
    },
    {
      key: 'website',
      label: /*i18n*/ { id: 'disciplines.column.website', message: 'Homepage' },
      width: '12rem',
      value: (r) => r.website ?? '',
      cell: (r, tabIndex) => r.website && <HomepageLink url={r.website} tabIndex={tabIndex} />,
    },
  ]
  const facts = (r: FederationRow) =>
    [
      r.abbreviation,
      country(r.country),
      countText(i18n, r.disciplines, r.disciplines, 'disciplines'),
    ].join(' · ')
  return (
    <DirectoryPage
      title={listTitles.federations}
      noun="federations"
      shown={shown.length}
      total={items.length}
      state={state}
      set={set}
      placeholder={i18n._({
        id: 'disciplines.federationsSearch',
        message: 'Name, abbreviation or country, DSB…',
      })}
      columns={columns}
      counts={{ rangefoundry: items.length, user: 0 }}
      sources={ruleBookSources}
      filters={
        <FacetFilters
          facets={federationFacets}
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
          href={(r) => `/federations/${r.id}`}
          facts={facts}
          label={(r) => r.name}
          caption={
            named.filter(Boolean).length === 0
              ? i18n._({ id: 'disciplines.federationsAll', message: 'All federations' })
              : i18n._({
                  id: 'disciplines.federationsFiltered',
                  message: 'Federations, {filters}',
                  values: { filters: named.filter(Boolean).join(', ') },
                })
          }
          noun="federations"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="federations" filters={filterText(named)} onClear={clear} />}
        />
      }
    />
  )
}
