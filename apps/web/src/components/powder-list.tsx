'use client'

import { Box, Button, Text } from '@mantine/core'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useMemo } from 'react'
import { formatNumber } from '../i18n/number.ts'
import {
  maxOverlay,
  overlayHref,
  type PowderRow,
  rateDomain,
  vivacityUnit,
} from '../lib/burn-rate.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText } from '../lib/lists.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { type PackedPowder, powderMatches, unpackPowders } from '../lib/powder-rows.ts'
import type { Origin } from '../lib/sources.ts'
import { CompareButton, PickedChips, usePicks } from './compare-picks.tsx'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import { SourceFilter } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { RateBar, RateTicks, scaleWidth } from './rate-scale.tsx'
import { EmptyList } from './states.tsx'

const n2 = (v: number | undefined) => (v === undefined ? '' : formatNumber(v, 2))
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
  const domain = useMemo(() => rateDomain(items), [items])
  const shown = useMemo(
    () => items.filter((r) => powderMatches(r, filters.query)),
    [items, filters],
  )
  const byId = useMemo(() => new Map(items.map((r) => [r.id, r])), [items])
  const [picked, toggle, replace] = usePicks(
    maxOverlay,
    state.compareIds,
    (pick) => set({ compareIds: pick }),
    (id) => byId.has(id),
  )

  const query = state.query.trim()
  const named = [query && `matching "${query}"`].filter(Boolean)
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
        translated
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
              onClear={() => replace([])}
            />
          </>
        }
        actions={
          <>
            <CompareButton
              count={picked.length}
              min={0}
              href={overlayHref(picked)}
              idle="Burn rates"
            />
            <Button
              component={Link}
              href="/powders/designer"
              leftSection={<Plus aria-hidden="true" />}
            >
              New powder
            </Button>
          </>
        }
      />
      <LibraryTabs />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder="Manufacturer or name, DP40…"
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
        >
          <SourceFilter
            src={state.sources}
            counts={{ openreloading: items.length, user: 0 }}
            sources={powderSources}
            onChange={(src) => set({ sources: src })}
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
            onChange: replace,
            can: (r) => r.burnRateOrder !== undefined,
          }}
          empty={<EmptyList noun="powders" filters={filterText(named)} onClear={clear} />}
        />
      </div>
    </>
  )
}
