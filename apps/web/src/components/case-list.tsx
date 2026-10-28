'use client'

import { Button } from '@mantine/core'
import { toSi } from '@open-reloading/schema'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { type CaseRow, caseMatches, userCaseRows } from '../lib/case-rows.ts'
import { listTitles } from '../lib/list-titles.ts'
import { kebabValue } from '../lib/list-values.ts'
import { countText, filterText, matchingText, widestCount } from '../lib/lists.ts'
import { productLabel } from '../lib/manufacturers.ts'
import {
  countOrigins,
  inOrigins,
  onlyText,
  originNames,
  readOrigins,
  userRecordId,
} from '../lib/sources.ts'
import { formatQuantity, waterVolume } from '../lib/units.ts'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import { DeleteRow, SourceFilter, sourceColumn, useUserRecords } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyList } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

/**
 * The case directory: manufacturer, name, cartridge, material, empty mass and the stated water
 * capacity of the catalogue's products, with the user's groups of cases as Mine rows (opened in the
 * case group editor, whose cartridge names come from `cartridgeNames`, by cartridge id).
 */
export function CaseList({
  rows: catalogue,
  cartridgeNames,
}: {
  rows: CaseRow[]
  cartridgeNames: Record<string, string>
}) {
  const tr = useTranslation()
  const { t } = tr
  const { system } = useUnits()
  const [records, removeRow] = useUserRecords()
  // the browser's groups first: a few rows would sit unseen behind the catalogue's
  const rows = useMemo(
    () => [...userCaseRows(records, new Map(Object.entries(cartridgeNames))), ...catalogue],
    [records, cartridgeNames, catalogue],
  )
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const counts = useMemo(() => countOrigins(rows), [rows])
  const shown = useMemo(
    () => rows.filter((r) => inOrigins(r, filters.sources) && caseMatches(r, filters.query)),
    [rows, filters],
  )
  const query = state.query.trim()
  const on = readOrigins(state.sources)
  const named = [onlyText(t, on), matchingText(t, query)].filter(Boolean)
  const columns: DirectoryColumn<CaseRow>[] = [
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
      key: 'cartridge',
      label: msg('Cartridge'),
      width: '9rem',
      value: (r) => r.cartridgeName,
      cell: (r) => r.cartridgeName,
    },
    {
      key: 'material',
      label: msg('Material'),
      width: '10rem',
      value: (r) => r.material,
      cell: (r) => kebabValue(t, r.material),
    },
    {
      key: 'mass',
      label: msg('Mass'),
      unit: system.mass.symbol,
      num: true,
      width: '6rem',
      value: (r) => r.mass,
      cell: (r) =>
        r.mass === undefined ? '' : formatQuantity('mass', system, toSi('mass', r.mass)),
    },
    {
      key: 'capacity',
      label: msg('Water capacity'),
      unit: system.capacity.symbol,
      help: msg('The water the manufacturer states fills the case to the mouth.'),
      num: true,
      width: '8rem',
      value: (r) => r.waterCapacity,
      cell: (r) =>
        r.waterCapacity === undefined
          ? ''
          : formatQuantity('capacity', system, waterVolume(r.waterCapacity)),
    },
    ...(counts.user > 0 ? [sourceColumn<CaseRow>(productLabel, removeRow)] : []),
  ]
  const facts = (r: CaseRow) =>
    [
      r.origin === 'user' && t(originNames.user),
      r.manufacturerName,
      r.cartridgeName,
      kebabValue(t, r.material),
    ]
      .filter(Boolean)
      .join(' · ')
  return (
    <>
      <PageBar
        title={listTitles.cases}
        translated
        status={
          <BarCount widest={widestCount(tr, rows.length, 'cases')}>
            {countText(tr, shown.length, rows.length, 'cases')}
          </BarCount>
        }
        actions={
          <>
            <Button component={Link} href="/cases/editor" leftSection={<Plus aria-hidden="true" />}>
              {t('New case group')}
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
          placeholder={t('Manufacturer, name or cartridge…')}
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
        >
          <SourceFilter
            src={state.sources}
            counts={counts}
            onChange={(src) => set({ sources: src })}
          />
        </DirectoryFilters>
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) =>
            r.origin === 'user'
              ? `/cases/editor?record=${encodeURIComponent(userRecordId(r.id) ?? r.id)}`
              : `/cases/${r.id}`
          }
          facts={facts}
          label={productLabel}
          caption={
            named.length === 0
              ? t('All cases')
              : t('Cases, {filters}', { filters: named.join(', ') })
          }
          noun="cases"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          phoneAction={(r, tabIndex) =>
            r.origin === 'user' ? (
              <DeleteRow row={r} name={productLabel(r)} onDelete={removeRow} tabIndex={tabIndex} />
            ) : null
          }
          breakBefore={state.sort ? undefined : (r, previous) => r.origin !== previous.origin}
          empty={<EmptyList noun="cases" filters={filterText(named)} onClear={clear} />}
        />
      </div>
    </>
  )
}
