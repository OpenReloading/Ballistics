'use client'

import { Button, SegmentedControl, Select, Tooltip } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { bulletFits, type CartridgeDiameters } from '@openreloading/core'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useMemo } from 'react'
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
import { countryLabel, countryOptions } from '../lib/countries.ts'
import { convertMass, massRange, numberRange } from '../lib/directory.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText } from '../lib/lists.ts'
import { manufacturerOptions, productLabel } from '../lib/manufacturers.ts'
import { titleFromKebab } from '../lib/record-fields.ts'
import {
  countOrigins,
  designerHref,
  inOrigins,
  originNames,
  origins,
  readOrigins,
  userBulletRows,
} from '../lib/sources.ts'
import { controlSize } from '../lib/theme.ts'
import { userBullets } from '../lib/variants.ts'
import { CaliberSelect } from './caliber-select.tsx'
import { CompareButton, PickedChips, usePicks } from './compare-picks.tsx'
import {
  CountryFilter,
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  ExtraSelect,
  FilterGroup,
  useListState,
} from './directory-table.tsx'
import { Noted } from './field-table.tsx'
import {
  DeleteRow,
  SourceFilter,
  sourceColumn,
  useResolved,
  useUserRecords,
} from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { RangeFilter } from './range-filter.tsx'
import { EmptyList } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

/** A cartridge of the "Fits cartridge" filter: its id, name and the CIP values of the fit. */
type FitCartridge = { id: string; name: string; fit: CartridgeDiameters }

/** The bullet directory: page bar with the count, filter row, windowed table. */
export function BulletList({
  packed,
  cartridges = [],
}: {
  packed: PackedBullet[]
  cartridges?: FitCartridge[]
}) {
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
  const massUnit = system.mass.symbol === 'g' ? 'g' : 'gr'
  const manufacturers = useMemo(() => manufacturerOptions(items), [items])
  const countries = useMemo(() => countryOptions(items.map((b) => b.country)), [items])
  const structures = useMemo(
    () =>
      [...new Set(items.flatMap((b) => (b.construction ? [b.construction] : [])))]
        .sort()
        .map((value) => ({ value, label: titleFromKebab(value) })),
    [items],
  )
  const tips = useMemo(
    () =>
      [...new Set(items.flatMap((b) => (b.tipType ? [b.tipType] : [])))]
        .sort()
        .map((value) => ({ value, label: titleFromKebab(value) })),
    [items],
  )
  const counts = useMemo(() => countOrigins(items), [items])
  const diameters = useMemo(() => items.map((b) => b.diameter), [items])
  const keys = useMemo(() => items.map(bulletKey), [items])
  const fitting = useMemo(() => new Map(cartridges.map((c) => [c.id, c])), [cartridges])
  // a cartridge id the list does not know filters nothing and shows as no filter
  const fits = fitting.get(state.fits ?? '')
  const fit = fitting.get(filters.fits ?? '')?.fit
  const shown = useMemo(
    () =>
      items.filter(
        (b, i) =>
          inOrigins(b, filters.sources) &&
          bulletMatches(b, filters, keys[i]) &&
          (!fit || bulletFits(b.diameter, fit)),
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
  const [picked, toggle] = usePicks(
    maxComparedBullets,
    state.compareIds,
    (pick) => set({ compareIds: pick }),
    (id) => byId.has(id),
  )

  const range = massRange(state.mass)
  // a mass parameter that does not parse filters nothing and shows as no filter
  const drag = state.dragModel === 'G1' || state.dragModel === 'G7' ? state.dragModel : ''
  const on = readOrigins(state.sources)
  const bc = numberRange(state.ballisticCoefficient ?? '', [''])
  const extras =
    Number(Boolean(state.country)) +
    Number(Boolean(state.tipType)) +
    Number(Boolean(state.construction)) +
    Number(Boolean(bc)) +
    Number(Boolean(range)) +
    Number(Boolean(fits))
  // below 48em Manufacturer, Caliber and the drag model sit behind the button as well
  const narrow = useMediaQuery('(max-width: 47.99em)')
  const more =
    extras +
    (narrow
      ? Number(Boolean(state.manufacturer)) + Number(Boolean(state.caliber)) + Number(Boolean(drag))
      : 0)
  const active = Boolean(
    state.query ||
      state.manufacturer ||
      state.caliber ||
      range ||
      drag ||
      extras ||
      on.length < origins.length,
  )
  const count = countText(shown.length, items.length, 'bullets')
  const named = [
    state.manufacturer &&
      (manufacturers.find((m) => m.value === state.manufacturer)?.label ?? state.manufacturer),
    state.caliber && `caliber ${state.caliber}`,
    range && `mass ${state.mass}`,
    drag && `${drag} BC`,
    bc && `BC ${state.ballisticCoefficient}`,
    state.country && countryLabel(state.country),
    state.tipType && titleFromKebab(state.tipType),
    state.construction && titleFromKebab(state.construction),
    fits && `fitting ${fits.name}`,
    on.length < origins.length && `${originNames[on[0]]} only`,
    state.query.trim() && `matching "${state.query.trim()}"`,
  ].filter(Boolean)
  const lengthUnit = system.length.symbol
  const columns: DirectoryColumn<BulletRow>[] = [
    {
      key: 'manufacturer',
      label: 'Manufacturer',
      width: '10rem',
      dim: true,
      value: (b) => b.manufacturerName,
      cell: (b) => b.manufacturerName,
    },
    { key: 'name', label: 'Name', value: (b) => b.name, cell: (b) => b.name },
    {
      key: 'cal',
      label: 'Caliber',
      width: '5.5rem',
      value: (b) => b.diameter,
      cell: (b, tabIndex) => (
        <Noted
          inline
          tabIndex={tabIndex}
          className="field-note row-action"
          value={cell(b).caliber}
          notes={[`Diameter ${cell(b).diameter}`]}
        />
      ),
    },
    {
      key: 'mass',
      label: 'Mass',
      unit: system.mass.symbol,
      num: true,
      width: '6rem',
      value: (b) => b.mass,
      cell: (b) => cell(b).mass,
    },
    {
      key: 'length',
      label: 'Length',
      unit: lengthUnit,
      num: true,
      width: '6rem',
      value: (b) => b.length,
      cell: (b) => cell(b).length,
    },
    {
      key: 'bc',
      label: 'BC',
      unit: 'lb/in²',
      help: `The manufacturer's published ballistic coefficient, lb/in², with its drag model: G7 where given, else G1; the other model on hover.${drag ? '' : ' Sorting orders by drag model first, then by value.'}`,
      num: true,
      width: '7rem',
      value: (b) => bulletBallisticCoefficientSort(b, drag),
      cell: (b, tabIndex) => {
        const bc = bulletBallisticCoefficient(b, drag)
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
    const bc = bulletBallisticCoefficient(b, drag)
    return [
      b.origin === 'user' && originNames.user,
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
        status={
          <>
            <BarCount
              widest={`${items.length} of ${countText(items.length, items.length, 'bullets')}`}
            >
              {count}
            </BarCount>
            <PickedChips
              ids={picked}
              max={maxComparedBullets}
              name={(id) => {
                const b = byId.get(id)
                return b ? productLabel(b) : id
              }}
              onRemove={toggle}
            />
          </>
        }
        actions={
          <>
            <CompareButton
              count={picked.length}
              min={2}
              href={compareHref(picked)}
              need={`Select 2 to ${maxComparedBullets} bullets`}
            />
            <Button
              component={Link}
              href="/bullets/designer"
              leftSection={<Plus aria-hidden="true" />}
            >
              New bullet
            </Button>
            <UnitsIconButton />
          </>
        }
      />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder="Manufacturer, name, 168, .308 or 7.82…"
          active={active}
          onClear={clear}
          more={more}
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
          extra={
            <>
              <CountryFilter
                data={countries}
                value={state.country}
                onChange={(country) => set({ country })}
              />
              <ExtraSelect
                label="Tip type"
                data={tips}
                value={state.tipType}
                onChange={(tipType) => set({ tipType })}
              />
              <ExtraSelect
                label="Construction"
                data={structures}
                value={state.construction}
                onChange={(construction) => set({ construction })}
              />
              <ExtraSelect
                label="Fits cartridge"
                data={cartridges.map((c) => ({ value: c.id, label: c.name }))}
                value={fits?.id}
                onChange={(id) => set({ fits: id })}
                searchable
              />
              <RangeFilter
                label="BC"
                unit=""
                range={bc}
                onChange={(text) => set({ ballisticCoefficient: text })}
              />
              <RangeFilter
                label="Mass"
                unit={massUnit}
                range={range}
                convert={(x, from, to) => convertMass(x, from as 'gr' | 'g', to as 'gr' | 'g')}
                onChange={(text) => set({ mass: text })}
              />
            </>
          }
        >
          <SourceFilter
            src={state.sources}
            counts={counts}
            onChange={(src) => set({ sources: src })}
          />
          <Select
            className="more-filter"
            aria-label="Manufacturer"
            placeholder="Manufacturer"
            size={controlSize.row.input}
            searchable
            clearable
            data={manufacturers}
            value={state.manufacturer || null}
            onChange={(v) => set({ manufacturer: v ?? '' })}
          />
          <CaliberSelect
            className="more-filter"
            diameters={diameters}
            value={state.caliber}
            onChange={(caliber) => set({ caliber })}
          />
          <FilterGroup label="BC" className="more-filter">
            <Tooltip label="Drag model of the BC column">
              <SegmentedControl
                aria-label="BC drag model"
                size={controlSize.row.toggle}
                data={[
                  { value: 'any', label: 'Any' },
                  { value: 'G7', label: 'G7' },
                  { value: 'G1', label: 'G1' },
                ]}
                value={drag || 'any'}
                onChange={(v) => set({ dragModel: v === 'G1' || v === 'G7' ? v : '' })}
              />
            </Tooltip>
          </FilterGroup>
        </DirectoryFilters>
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(b) => (b.origin === 'user' ? designerHref('bullets', b.id) : `/bullets/${b.id}`)}
          facts={facts}
          label={productLabel}
          caption={named.length === 0 ? 'All bullets' : `Bullets, ${named.join(', ')}`}
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
            onToggle: toggle,
            can: (b) => b.origin !== 'user',
          }}
          empty={<EmptyList noun="bullets" filters={filterText(named)} />}
        />
      </div>
    </>
  )
}
