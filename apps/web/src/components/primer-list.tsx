'use client'

import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { listTitles } from '../lib/list-titles.ts'
import { kebabValue } from '../lib/list-values.ts'
import { filterText, matchingText } from '../lib/lists.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { type PrimerRow, primerMatches } from '../lib/primer-rows.ts'
import type { Origin } from '../lib/sources.ts'
import { DirectoryPage } from './directory-page.tsx'
import { type DirectoryColumn, DirectoryTable, useListState } from './directory-table.tsx'
import { EmptyList } from './states.tsx'

/** No user record holds a primer: the catalogue is the list's one source, so the filter filters nothing. */
const primerSources: readonly Origin[] = ['rangefoundry']

/** The primer directory: manufacturer, name, product number, size, magnum flag and priming compound. */
export function PrimerList({ rows }: { rows: PrimerRow[] }) {
  const { t } = useTranslation()
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const shown = useMemo(
    () => rows.filter((r) => primerMatches(r, filters.query, t)),
    [rows, filters, t],
  )
  const named = [matchingText(t, state.query)].filter(Boolean)
  const columns: DirectoryColumn<PrimerRow>[] = [
    {
      key: 'manufacturer',
      label: msg('Manufacturer'),
      width: '10.5rem',
      dim: true,
      value: (r) => r.manufacturerName,
      cell: (r) => r.manufacturerName,
    },
    { key: 'name', label: msg('Name'), value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'number',
      wide: true,
      label: msg('Product number'),
      width: '9rem',
      value: (r) => r.productNumber,
      cell: (r) => r.productNumber ?? '',
    },
    {
      key: 'size',
      label: msg('Size'),
      width: '9rem',
      value: (r) => r.size,
      cell: (r) => kebabValue(t, r.size),
    },
    {
      key: 'magnum',
      label: msg('Magnum'),
      width: '6rem',
      value: (r) => (r.magnum === undefined ? undefined : r.magnum ? 'yes' : 'no'),
      cell: (r) => (r.magnum === undefined ? '' : r.magnum ? t('Yes') : t('No')),
    },
    {
      key: 'compound',
      wide: true,
      label: msg('Compound'),
      width: '10rem',
      value: (r) => r.compound,
      cell: (r) => (r.compound ? kebabValue(t, r.compound) : ''),
    },
  ]
  const facts = (r: PrimerRow) =>
    [r.manufacturerName, kebabValue(t, r.size), r.compound && kebabValue(t, r.compound)]
      .filter(Boolean)
      .join(' · ')
  return (
    <DirectoryPage
      title={listTitles.primers}
      noun="primers"
      shown={shown.length}
      total={rows.length}
      state={state}
      set={set}
      placeholder={t('Manufacturer, name or size…')}
      columns={columns}
      counts={{ rangefoundry: rows.length, user: 0 }}
      sources={primerSources}
      table={
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => `/primers/${r.id}`}
          facts={facts}
          label={productLabel}
          caption={
            named.length === 0
              ? t('All primers')
              : t('Primers, {filters}', { filters: named.join(', ') })
          }
          noun="primers"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="primers" filters={filterText(named)} onClear={clear} />}
        />
      }
    />
  )
}
