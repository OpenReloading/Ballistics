'use client'

import { Button } from '@mantine/core'
import { bulletFits, type CartridgeDiameters } from '@open-reloading/core'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { bulletKinds, bulletSectionalDensity } from '../lib/bullet-kinds.ts'
import {
  bulletFacetKeys,
  bulletFacets,
  bulletTypeText,
  coefficientText,
  listCells,
  type PackedBullet,
  unpackBullets,
} from '../lib/bullet-list-data.ts'
import {
  type BulletRow,
  ballisticCoefficientText,
  bulletBallisticCoefficient,
  bulletCells,
  bulletKey,
  bulletMatches,
} from '../lib/bullet-rows.ts'
import { compareHref, maxComparedBullets } from '../lib/compare-ids.ts'
import { facetNames } from '../lib/facets.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText, matchingText, widestCount } from '../lib/lists.ts'
import { productLabel } from '../lib/manufacturers.ts'
import {
  countOrigins,
  designerHref,
  inOrigins,
  onlyText,
  originNames,
  readOrigins,
  userBulletRows,
} from '../lib/sources.ts'
import type { UnitSystem } from '../lib/units.ts'
import { userBullets } from '../lib/variants.ts'
import { CompareButton, SelectionSummary, usePicks } from './compare-picks.tsx'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { FacetFilters, useFacets } from './facet-filters.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import {
  DeleteRow,
  SourceFilter,
  sourceColumn,
  useResolved,
  useUserRecords,
} from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyList } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

/** A cartridge of the "Fits cartridge" filter: its id, name and the CIP values of the fit. */
type FitCartridge = { id: string; name: string; fit: CartridgeDiameters }

/** A row's cells: the shared ones and the list's own Diameter and SD. */
const rowCells = (b: BulletRow, system: UnitSystem) => ({
  ...bulletCells(b, system),
  ...listCells(b, system),
})

/** The bullet directory: page bar with the count, search row, windowed table. */
export function BulletList({
  packed,
  cartridges = [],
}: {
  packed: PackedBullet[]
  cartridges?: FitCartridge[]
}) {
  const tr = useTranslation()
  const { t } = tr
  const [records, removeRow] = useUserRecords()
  const mine = useResolved(records, userBullets)
  // the browser's designs first: a few rows would sit unseen behind 1684 catalogue rows
  const items = useMemo<BulletRow[]>(
    () => [...userBulletRows(mine, bulletKinds), ...unpackBullets(packed)],
    [mine, packed],
  )
  const { system } = useUnits()
  const [state, set, clear] = useListState(bulletFacetKeys)
  const filters = useDeferredValue(state)
  const counts = useMemo(() => countOrigins(items), [items])
  const keys = useMemo(() => items.map(bulletKey), [items])
  const fitting = useMemo(() => new Map(cartridges.map((c) => [c.id, c])), [cartridges])
  // a cartridge id the list does not know filters nothing and shows as no scope
  const fits = fitting.get(state.fits ?? '')
  const fit = fitting.get(filters.fits ?? '')?.fit
  const facets = useMemo(() => bulletFacets(t), [t])
  const searched = useMemo(
    () =>
      items.filter(
        (b, i) =>
          inOrigins(b, filters.sources) &&
          bulletMatches(b, filters.query, keys[i]) &&
          (!fit || (b.diameter !== null && bulletFits(b.diameter, fit))),
      ),
    [items, keys, filters, fit],
  )
  const { shown, options } = useFacets(items, searched, facets, filters)
  const cells = useMemo(
    () => new Map(items.map((b) => [b.id, rowCells(b, system)])),
    [items, system],
  )
  const cell = (b: BulletRow) => cells.get(b.id) ?? rowCells(b, system)
  const ids = useMemo(() => new Set(items.map((b) => b.id)), [items])
  // the Type column's text, once per row and language: also its sort key
  const types = useMemo(() => new Map(items.map((b) => [b.id, bulletTypeText(t, b)])), [items, t])
  const typeOf = (b: BulletRow) => types.get(b.id) ?? bulletTypeText(t, b)
  // the bullets ticked for Compare, in the order ticked: the compare view's columns. A bullet
  // record's Compare (`compareFrom`) links with that bullet ticked
  const [picked, , replace] = usePicks(
    maxComparedBullets,
    state.compareIds,
    (pick) => set({ compareIds: pick }),
    (id) => ids.has(id),
  )

  const on = readOrigins(state.sources)
  const count = countText(tr, shown.length, items.length, 'bullets')
  const named = [
    fits && t('fitting {name}', { name: fits.name }),
    onlyText(t, on),
    ...facetNames(facets, state.facets ?? {}, t),
    matchingText(t, state.query),
  ].filter(Boolean)
  const lengthUnit = system.length.symbol
  const columns: DirectoryColumn<BulletRow>[] = [
    {
      key: 'manufacturer',
      label: msg('Manufacturer'),
      width: '9rem',
      dim: true,
      value: (b) => b.manufacturerName,
      cell: (b) => b.manufacturerName,
    },
    { key: 'name', label: msg('Name'), value: (b) => b.name, cell: (b) => b.name },
    {
      key: 'cal',
      label: msg('Caliber'),
      width: '4.5rem',
      // no sort of its own: Diameter sorts by the same value
      cell: (b) => cell(b).caliber,
    },
    {
      key: 'diameter',
      label: msg('Diameter'),
      unit: lengthUnit,
      num: true,
      width: '5.5rem',
      value: (b) => b.diameter,
      cell: (b) => cell(b).diameterValue,
    },
    {
      key: 'mass',
      label: msg('Mass'),
      unit: system.mass.symbol,
      num: true,
      width: '5rem',
      value: (b) => b.mass,
      cell: (b) => cell(b).mass,
    },
    {
      key: 'length',
      label: msg('Length'),
      unit: lengthUnit,
      num: true,
      width: '5rem',
      wide: true,
      value: (b) => b.length,
      cell: (b) => cell(b).length,
    },
    {
      key: 'sd',
      label: msg('column\u0004SD'),
      unit: system.sectionalDensity.symbol,
      help: msg('Sectional density, computed: mass over diameter squared.'),
      num: true,
      width: '5rem',
      wide: true,
      value: (b) => bulletSectionalDensity(b),
      cell: (b) => cell(b).sectionalDensity,
    },
    {
      key: 'g1',
      label: msg('G1'),
      unit: 'lb/in²',
      help: msg("The manufacturer's first published BC of this drag model."),
      num: true,
      width: '4.5rem',
      value: (b) => b.ballisticCoefficientG1,
      cell: (b) => coefficientText(b.ballisticCoefficientG1),
    },
    {
      key: 'g7',
      label: msg('G7'),
      unit: 'lb/in²',
      help: msg("The manufacturer's first published BC of this drag model."),
      num: true,
      width: '4.5rem',
      value: (b) => b.ballisticCoefficientG7,
      cell: (b) => coefficientText(b.ballisticCoefficientG7),
    },
    {
      key: 'type',
      label: msg('Type'),
      width: '11rem',
      wide: true,
      value: (b) => typeOf(b) || undefined,
      cell: typeOf,
    },
    ...(counts.user > 0 ? [sourceColumn<BulletRow>(productLabel, removeRow)] : []),
  ]
  const facts = (b: BulletRow) => {
    const c = cell(b)
    const bc = bulletBallisticCoefficient(b)
    return [
      b.origin === 'user' && t(originNames.user),
      b.manufacturerName,
      c.caliber,
      c.mass && `${c.mass} ${system.mass.symbol}`,
      bc && ballisticCoefficientText(bc),
      typeOf(b),
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return (
    <>
      <PageBar
        title={listTitles.bullets}
        translated
        status={
          <>
            <BarCount widest={widestCount(tr, items.length, 'bullets')}>{count}</BarCount>
            <SelectionSummary
              count={picked.length}
              max={maxComparedBullets}
              onClear={() => replace([])}
            />
          </>
        }
        actions={
          <>
            <CompareButton
              count={picked.length}
              min={2}
              max={maxComparedBullets}
              href={compareHref(picked)}
              need={t('Pick 2 to {max}', { max: maxComparedBullets })}
            />
            <Button
              component={Link}
              href="/bullets/designer"
              leftSection={<Plus aria-hidden="true" />}
            >
              {t('New bullet')}
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
          placeholder={t('Manufacturer, name, 168, .308 or 7.82…')}
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
          scope={
            fits && {
              label: t('Fits {name}', { name: fits.name }),
              onRemove: () => set({ fits: '' }),
            }
          }
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
          href={(b) => (b.origin === 'user' ? designerHref('bullets', b.id) : `/bullets/${b.id}`)}
          facts={facts}
          label={productLabel}
          caption={
            named.length === 0
              ? t('All bullets')
              : t('Bullets, {filters}', { filters: named.join(', ') })
          }
          noun="bullets"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          phoneAction={(b, tabIndex) =>
            b.origin === 'user' ? (
              <DeleteRow row={b} name={productLabel(b)} onDelete={removeRow} tabIndex={tabIndex} />
            ) : null
          }
          breakBefore={state.sort ? undefined : (b, previous) => b.origin !== previous.origin}
          selection={{
            ids: picked,
            max: maxComparedBullets,
            onChange: replace,
            can: (b) => b.origin !== 'user',
          }}
          empty={<EmptyList noun="bullets" filters={filterText(named)} onClear={clear} />}
        />
      </div>
    </>
  )
}
