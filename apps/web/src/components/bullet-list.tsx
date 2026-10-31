'use client'

import { Button } from '@mantine/core'
import { bulletFits, type CartridgeDiameters } from '@open-reloading/core'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import {
  type BulletRow,
  ballisticCoefficientText,
  bulletBallisticCoefficient,
  bulletBallisticCoefficientSort,
  bulletCells,
  bulletKey,
  bulletMatches,
  type PackedBullet,
  unpackBullets,
} from '../lib/bullet-rows.ts'
import { compareHref, maxComparedBullets } from '../lib/compare-ids.ts'
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
import { userBullets } from '../lib/variants.ts'
import { CompareButton, PickedChips, usePicks } from './compare-picks.tsx'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { Noted } from './field-table.tsx'
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
    () => [...userBulletRows(mine), ...unpackBullets(packed)],
    [mine, packed],
  )
  const { system } = useUnits()
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const counts = useMemo(() => countOrigins(items), [items])
  const keys = useMemo(() => items.map(bulletKey), [items])
  const fitting = useMemo(() => new Map(cartridges.map((c) => [c.id, c])), [cartridges])
  // a cartridge id the list does not know filters nothing and shows as no scope
  const fits = fitting.get(state.fits ?? '')
  const fit = fitting.get(filters.fits ?? '')?.fit
  const shown = useMemo(
    () =>
      items.filter(
        (b, i) =>
          inOrigins(b, filters.sources) &&
          bulletMatches(b, filters.query, keys[i]) &&
          (!fit || (b.diameter !== null && bulletFits(b.diameter, fit))),
      ),
    [items, keys, filters, fit],
  )
  const cells = useMemo(
    () => new Map(items.map((b) => [b.id, bulletCells(b, system)])),
    [items, system],
  )
  const cell = (b: BulletRow) => cells.get(b.id) ?? bulletCells(b, system)
  const byId = useMemo(() => new Map(items.map((b) => [b.id, b])), [items])
  // the bullets ticked for Compare, in the order ticked: the compare view's columns. A bullet
  // record's Compare (`compareFrom`) links with that bullet ticked
  const [picked, toggle, replace] = usePicks(
    maxComparedBullets,
    state.compareIds,
    (pick) => set({ compareIds: pick }),
    (id) => byId.has(id),
  )

  const on = readOrigins(state.sources)
  const count = countText(tr, shown.length, items.length, 'bullets')
  const named = [
    fits && t('fitting {name}', { name: fits.name }),
    onlyText(t, on),
    matchingText(t, state.query),
  ].filter(Boolean)
  const lengthUnit = system.length.symbol
  const columns: DirectoryColumn<BulletRow>[] = [
    {
      key: 'manufacturer',
      label: msg('Manufacturer'),
      width: '10rem',
      dim: true,
      value: (b) => b.manufacturerName,
      cell: (b) => b.manufacturerName,
    },
    { key: 'name', label: msg('Name'), value: (b) => b.name, cell: (b) => b.name },
    {
      key: 'cal',
      label: msg('Caliber'),
      width: '5.5rem',
      value: (b) => b.diameter,
      cell: (b, tabIndex) => (
        <Noted
          inline
          tabIndex={tabIndex}
          className="field-note row-action"
          value={cell(b).caliber}
          notes={[t('Diameter {diameter}', { diameter: cell(b).diameter })]}
        />
      ),
    },
    {
      key: 'mass',
      label: msg('Mass'),
      unit: system.mass.symbol,
      num: true,
      width: '6rem',
      value: (b) => b.mass,
      cell: (b) => cell(b).mass,
    },
    {
      key: 'length',
      label: msg('Length'),
      unit: lengthUnit,
      num: true,
      width: '6rem',
      value: (b) => b.length,
      cell: (b) => cell(b).length,
    },
    {
      key: 'bc',
      label: msg('BC'),
      unit: 'lb/in²',
      help: msg(
        "The manufacturer's published ballistic coefficient, lb/in², with its drag model: G7 where given, else G1; the other model on hover. Sorting orders by drag model first, then by value.",
      ),
      num: true,
      width: '7rem',
      value: (b) => bulletBallisticCoefficientSort(b),
      cell: (b, tabIndex) => {
        const bc = bulletBallisticCoefficient(b)
        if (!bc) return ''
        // the value, then its drag model muted: every cell reads "0.264 G7"
        const [value, model] = ballisticCoefficientText(bc).split(' ')
        const text = (
          <>
            {value} <span className="bc-model">{model}</span>
          </>
        )
        return bc.other ? (
          <Noted
            inline
            tabIndex={tabIndex}
            className="field-note row-action"
            value={text}
            notes={[ballisticCoefficientText(bc.other)]}
          />
        ) : (
          text
        )
      },
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
            <PickedChips
              ids={picked}
              max={maxComparedBullets}
              name={(id) => {
                const b = byId.get(id)
                return b ? productLabel(b) : id
              }}
              onRemove={toggle}
              onClear={() => replace([])}
            />
          </>
        }
        actions={
          <>
            <CompareButton
              count={picked.length}
              min={2}
              href={compareHref(picked)}
              need={t('Select 2 to {max} bullets', { max: maxComparedBullets })}
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
