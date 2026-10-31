'use client'

import { Button } from '@mantine/core'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import {
  type CartridgeRow,
  cartridgeCells,
  cartridgeMatches,
  cartridgeRank,
  cartridgeSearchText,
  compareCartridgeNames,
  noValues,
  type PackedCartridge,
  unpackCartridges,
} from '../lib/cartridge-rows.ts'
import { listTitles } from '../lib/list-titles.ts'
import { caseTypeText } from '../lib/list-values.ts'
import { countText, filterText, matchingText, widestCount } from '../lib/lists.ts'
import {
  countOrigins,
  designerHref,
  inOrigins,
  onlyText,
  originNames,
  readOrigins,
  userCartridgeRows,
} from '../lib/sources.ts'
import { userCartridges } from '../lib/variants.ts'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import {
  DeleteRow,
  SourceFilter,
  sourceColumn,
  useResolved,
  useUserRecords,
} from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { GapBadge } from './standard-badge.tsx'
import { EmptyList } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

/** The cartridge directory: page bar with the count, search row, windowed table. */
export function CartridgeList({ packed }: { packed: PackedCartridge[] }) {
  const tr = useTranslation()
  const { t } = tr
  const [records, removeRow] = useUserRecords()
  const mine = useResolved(records, userCartridges)
  // the browser's designs first: a few rows would sit unseen behind the catalogue rows
  const items = useMemo(
    () => [
      ...userCartridgeRows(mine),
      ...unpackCartridges(packed).toSorted((a, b) => compareCartridgeNames(a.name, b.name)),
    ],
    [mine, packed],
  )
  const counts = useMemo(() => countOrigins(items), [items])
  const { system } = useUnits()
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const texts = useMemo(() => items.map(cartridgeSearchText), [items])
  const shown = useMemo(() => {
    const found = items.filter(
      (c, i) => inOrigins(c, filters.sources) && cartridgeMatches(c, filters.query, texts[i]),
    )
    // a search ranks the typed name first; a header sort replaces that order
    return filters.query.trim() === '' || filters.sort
      ? found
      : found.toSorted(
          (a, b) =>
            cartridgeRank(b, filters.query) - cartridgeRank(a, filters.query) ||
            compareCartridgeNames(a.name, b.name),
        )
  }, [items, texts, filters])
  const cells = useMemo(
    () => new Map(items.map((c) => [c.id, cartridgeCells(c, system)])),
    [items, system],
  )
  const cell = (c: CartridgeRow) => cells.get(c.id) ?? cartridgeCells(c, system)

  const on = readOrigins(state.sources)
  const count = countText(tr, shown.length, items.length, 'cartridges')
  const named = [onlyText(t, on), matchingText(t, state.query)].filter(Boolean)
  const lengthUnit = system.length.symbol
  const pressureUnit = system.pressure.symbol
  const columns: DirectoryColumn<CartridgeRow>[] = [
    {
      key: 'name',
      label: msg('Name'),
      value: (c) => c.name,
      compare: (a, b) => compareCartridgeNames(a.name, b.name),
      cell: (c) => (
        <>
          {c.name}
          {c.aliases.length > 0 && <span className="aliases"> {c.aliases.join(', ')}</span>}
          {noValues(c) && (
            <>
              {' '}
              <GapBadge />
            </>
          )}
        </>
      ),
    },
    {
      key: 'cal',
      label: msg('Caliber'),
      unit: 'in',
      help: msg('The common caliber of the bullet diameter G1.'),
      width: '5rem',
      value: (c) => c.maxBulletDiameter,
      cell: (c) => cell(c).caliber,
    },
    {
      key: 'type',
      label: msg('Case type'),
      width: '6.5rem',
      value: (c) => c.caseType,
      cell: (c) => (c.caseType ? caseTypeText(t, c.caseType) : ''),
    },
    {
      key: 'maxBulletDiameter',
      label: msg('Bullet diameter G1'),
      unit: lengthUnit,
      help: msg('Bullet diameter G1, the cartridge value of the CIP sheet (the smallest variant).'),
      num: true,
      width: '8.5rem',
      value: (c) => c.maxBulletDiameter,
      cell: (c) => cell(c).maxBulletDiameter,
    },
    {
      key: 'caseLength',
      label: msg('Case length L3'),
      unit: lengthUnit,
      help: msg('Case length L3, the cartridge maximum of the CIP sheet (the shortest variant).'),
      num: true,
      width: '7.5rem',
      value: (c) => c.caseLength,
      cell: (c) => cell(c).caseLength,
    },
    {
      key: 'cartridgeLength',
      label: msg('Max length L6'),
      unit: lengthUnit,
      help: msg(
        'Maximum cartridge length L6 (COAL), the cartridge maximum of the CIP sheet (the shortest variant).',
      ),
      num: true,
      width: '7rem',
      value: (c) => c.cartridgeLength,
      cell: (c) => cell(c).cartridgeLength,
    },
    {
      key: 'pmax',
      label: msg('Pmax'),
      unit: pressureUnit,
      help: msg(
        'Maximum mean pressure Pmax of the CIP sheet (the highest of its variants), by the method the sheet names.',
      ),
      num: true,
      width: '5.5rem',
      value: (c) => c.pmax,
      cell: (c) => cell(c).pmax,
    },
    // the column of the browser's own rows, while there are any
    ...(counts.user > 0 ? [sourceColumn((c: CartridgeRow) => c.name, removeRow)] : []),
  ]
  const facts = (c: CartridgeRow) => {
    const v = cell(c)
    return [
      c.origin === 'user' && t(originNames.user),
      v.caliber,
      v.caseLength && `L3 ${v.caseLength} ${lengthUnit}`,
      v.cartridgeLength && `L6 ${v.cartridgeLength} ${lengthUnit}`,
      v.pmax && `${v.pmax} ${pressureUnit}`,
      c.caseType && caseTypeText(t, c.caseType),
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return (
    <>
      <PageBar
        title={listTitles.cartridges}
        translated
        status={<BarCount widest={widestCount(tr, items.length, 'cartridges')}>{count}</BarCount>}
        actions={
          <>
            <Button
              component={Link}
              href="/cartridges/designer"
              leftSection={<Plus aria-hidden="true" />}
            >
              {t('New cartridge')}
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
          placeholder={t('Name or alias, 308, 7,62 or .308…')}
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
          href={(c) =>
            c.origin === 'user' ? designerHref('cartridges', c.id) : `/cartridges/${c.id}`
          }
          facts={facts}
          phoneAction={(c, tabIndex) =>
            c.origin === 'user' ? (
              <DeleteRow row={c} name={c.name} onDelete={removeRow} tabIndex={tabIndex} />
            ) : null
          }
          breakBefore={state.sort ? undefined : (c, previous) => c.origin !== previous.origin}
          label={(c) => c.name}
          caption={
            named.length === 0
              ? t('All cartridges')
              : t('Cartridges, {filters}', { filters: named.join(', ') })
          }
          noun="cartridges"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="cartridges" filters={filterText(named)} onClear={clear} />}
        />
      </div>
    </>
  )
}
