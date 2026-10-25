'use client'

import { Box, Checkbox, SegmentedControl, Select, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useDeferredValue, useMemo } from 'react'
import {
  maxOverlay,
  overlayHref,
  type PowderRow,
  rateDomain,
  vivacityUnit,
} from '../lib/burn-rate.ts'
import { countryLabel, countryOptions } from '../lib/countries.ts'
import { numberRange } from '../lib/directory.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText } from '../lib/lists.ts'
import { manufacturerOptions, productLabel } from '../lib/manufacturers.ts'
import { type PackedPowder, powderMatches, unpackPowders } from '../lib/powder-rows.ts'
import type { Origin } from '../lib/sources.ts'
import { controlSize } from '../lib/theme.ts'
import { formatNumber } from '../lib/units.ts'
import { CompareButton, PickedChips, usePicks } from './compare-picks.tsx'
import {
  CountryFilter,
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  FilterGroup,
  useListState,
} from './directory-table.tsx'
import { SourceFilter } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { RangeFilter } from './range-filter.tsx'
import { RateBar, RateTicks, scaleWidth } from './rate-scale.tsx'
import { EmptyList } from './states.tsx'

const n2 = (v: number | undefined) => (v === undefined ? '' : formatNumber(v, 2))
const options = (rows: PowderRow[], key: 'propellantBase' | 'grainForm') =>
  [...new Set(rows.flatMap((r) => (r[key] ? [r[key]] : [])))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  )
/** A facet with up to four values as one segmented control with "Any" first; the filter row stays one line at 1280 px. */
const segments = (values: string[]) => [{ value: '', label: 'Any' }, ...values]
/** No user record holds a powder: the catalogue is the list's one source, so the filter filters nothing. */
const powderSources: readonly Origin[] = ['openreloading']

/**
 * The powder directory: manufacturer, name, form, base and the burn rate in one cell (the
 * mean dynamic vivacity, its interval and both on one log scale for every row); powders with a
 * curve are ticked for the burn-rate overlay of `/powders/burn-rates`.
 */
export function PowderList({ packed }: { packed: PackedPowder[] }) {
  const items = useMemo(() => unpackPowders(packed), [packed])
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const manufacturers = useMemo(() => manufacturerOptions(items), [items])
  const bases = useMemo(() => options(items, 'propellantBase'), [items])
  const forms = useMemo(() => options(items, 'grainForm'), [items])
  const countries = useMemo(() => countryOptions(items.map((r) => r.country)), [items])
  const domain = useMemo(() => rateDomain(items), [items])
  const shown = useMemo(() => items.filter((r) => powderMatches(r, filters)), [items, filters])
  const byId = useMemo(() => new Map(items.map((r) => [r.id, r])), [items])
  const [picked, toggle] = usePicks(
    maxOverlay,
    state.compareIds,
    (pick) => set({ compareIds: pick }),
    (id) => byId.has(id),
  )

  const rank = numberRange(state.burnRateOrder ?? '', [''])
  const extras = Number(Boolean(state.country)) + Number(Boolean(rank))
  // below 48em the manufacturer, the form, the base and "With a curve" sit behind More filters too
  const narrow = useMediaQuery('(max-width: 47.99em)')
  const more =
    extras +
    (narrow
      ? Number(Boolean(state.manufacturer)) +
        Number(Boolean(state.form)) +
        Number(Boolean(state.base)) +
        Number(Boolean(state.curve))
      : 0)
  const active = Boolean(
    state.query || state.manufacturer || state.base || state.form || state.curve || extras,
  )
  const named = [
    state.manufacturer &&
      (manufacturers.find((m) => m.value === state.manufacturer)?.label ?? state.manufacturer),
    state.base && `${state.base} base`,
    state.form && `form ${state.form}`,
    state.curve && 'with a curve',
    state.country && countryLabel(state.country),
    rank && `burn-rate order ${state.burnRateOrder}`,
    state.query.trim() && `matching "${state.query.trim()}"`,
  ].filter(Boolean)
  const facet = (key: 'base' | 'form', values: string[], name: string, className?: string) =>
    values.length <= 4 ? (
      <FilterGroup label={name} className={className}>
        <SegmentedControl
          aria-label={name}
          size={controlSize.row.toggle}
          data={segments(values)}
          value={state[key] ?? ''}
          onChange={(v) => set({ [key]: v })}
        />
      </FilterGroup>
    ) : (
      <Select
        className={className}
        aria-label={name}
        placeholder={name}
        size={controlSize.row.input}
        clearable
        data={values}
        value={state[key] || null}
        onChange={(v) => set({ [key]: v ?? '' })}
      />
    )
  const columns: DirectoryColumn<PowderRow>[] = [
    {
      key: 'manufacturer',
      label: 'Manufacturer',
      width: '10.5rem',
      dim: true,
      value: (r) => r.manufacturerName,
      cell: (r) => r.manufacturerName,
    },
    { key: 'name', label: 'Name', value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'form',
      label: 'Form',
      width: '6rem',
      value: (r) => r.grainForm,
      cell: (r) => r.grainForm ?? '',
    },
    {
      key: 'base',
      label: 'Base',
      width: '5.5rem',
      value: (r) => r.propellantBase,
      cell: (r) => r.propellantBase ?? '',
    },
    {
      key: 'rate',
      label: 'Mean vivacity',
      unit: vivacityUnit,
      help: `Dynamic vivacity averaged over burnt fraction 0.1 to 0.9 with its interval (plus and minus 2 standard uncertainties), on a log scale: model output from fitted M3 parameters, not manufacturer data. Empty without fitted parameters.`,
      width: `calc(${scaleWidth}px + 11rem)`,
      head: <RateTicks domain={domain} />,
      value: (r) => r.meanVivacity,
      cell: (r) =>
        r.meanVivacity === undefined ? null : (
          <span className="rate-cell">
            <Box component="span" className="rate-mean" ta="right">
              {n2(r.meanVivacity)}
            </Box>
            <Text component="span" inherit className="rate-interval" c="dimmed" fz="xs" truncate>
              {r.low === undefined ? '' : `${n2(r.low)} to ${n2(r.high)}`}
            </Text>
            <RateBar domain={domain} mean={r.meanVivacity} low={r.low} high={r.high} />
          </span>
        ),
    },
  ]
  const facts = (r: PowderRow) =>
    // the burn-rate order before form and base: a phone's line ends where it is cut
    [
      r.manufacturerName,
      r.burnRateOrder !== undefined && `burn-rate order ${r.burnRateOrder}`,
      r.grainForm,
      r.propellantBase && `${r.propellantBase} base`,
    ]
      .filter(Boolean)
      .join(' · ')
  return (
    <>
      <PageBar
        title={listTitles.powders}
        status={
          <>
            <BarCount
              widest={`${items.length} of ${countText(items.length, items.length, 'powders')}`}
            >
              {countText(shown.length, items.length, 'powders')}
            </BarCount>
            <PickedChips
              ids={picked}
              max={maxOverlay}
              name={(id) => {
                const r = byId.get(id)
                return r ? productLabel(r) : id
              }}
              onRemove={toggle}
            />
          </>
        }
        actions={
          <CompareButton
            count={picked.length}
            min={0}
            href={overlayHref(picked)}
            idle="Burn rates"
          />
        }
      />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder="Manufacturer or name, DP40…"
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
              <RangeFilter
                label="Burn-rate order"
                unit=""
                range={rank}
                integer
                onChange={(text) => set({ burnRateOrder: text })}
              />
            </>
          }
        >
          <SourceFilter
            src={state.sources}
            counts={{ openreloading: items.length, user: 0 }}
            sources={powderSources}
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
          {facet('form', forms, 'Form', 'more-filter')}
          {facet('base', bases, 'Base', 'more-filter')}
          <Checkbox
            className="more-filter"
            label="With a curve"
            checked={Boolean(state.curve)}
            onChange={(e) => set({ curve: e.currentTarget.checked ? '1' : '' })}
          />
        </DirectoryFilters>
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => `/powders/${r.id}`}
          facts={facts}
          label={productLabel}
          caption={named.length === 0 ? 'All powders' : `Powders, ${named.join(', ')}`}
          noun="powders"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          selection={{
            ids: picked,
            max: maxOverlay,
            onToggle: toggle,
            can: (r) => r.burnRateOrder !== undefined,
          }}
          empty={<EmptyList noun="powders" filters={filterText(named)} />}
        />
      </div>
    </>
  )
}
