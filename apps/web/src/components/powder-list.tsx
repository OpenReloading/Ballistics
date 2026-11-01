'use client'

import { Box, Button, Text } from '@mantine/core'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import {
  maxOverlay,
  overlayHref,
  type PowderRow,
  rateDomain,
  vivacityUnit,
} from '../lib/burn-rate.ts'
import { listTitles } from '../lib/list-titles.ts'
import { baseLine, baseText, grainFormText } from '../lib/list-values.ts'
import { countText, filterText, matchingText, widestCount } from '../lib/lists.ts'
import { productLabel } from '../lib/manufacturers.ts'
import {
  inOverlay,
  type PackedPowder,
  powderMatches,
  unpackPowders,
  userPowderRows,
} from '../lib/powder-rows.ts'
import {
  countOrigins,
  designerHref,
  inOrigins,
  onlyText,
  originNames,
  readOrigins,
} from '../lib/sources.ts'
import { CompareButton, SelectionSummary, usePicks } from './compare-picks.tsx'
import { Day } from './day.tsx'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import { DeleteRow, SourceFilter, sourceColumn, useUserRecords } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { RateBar, RateTicks, scaleWidth } from './rate-scale.tsx'
import { EmptyList } from './states.tsx'

const n2 = (v: number | undefined) => (v === undefined ? '' : formatNumber(v, 2))

/**
 * The powder directory: manufacturer, name, form, base and the burn rate in one cell (the
 * mean dynamic vivacity, its interval and both on one log scale for every row); powders with a
 * curve are ticked for the burn-rate overlay of `/powders/burn-rates`. The powders of this browser
 * are Mine rows, opened in the powder designer.
 */
export function PowderList({ packed }: { packed: PackedPowder[] }) {
  const tr = useTranslation()
  const { t, tn } = tr
  const [records, removeRow] = useUserRecords()
  const catalogue = useMemo(() => unpackPowders(packed), [packed])
  // the browser's powders first: a few rows would sit unseen behind the catalogue's
  const items = useMemo(() => [...userPowderRows(records), ...catalogue], [records, catalogue])
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  // over every row: a design faster or slower than the catalogue keeps its place on the scale
  const domain = useMemo(() => rateDomain(items), [items])
  const counts = useMemo(() => countOrigins(items), [items])
  const shown = useMemo(
    () => items.filter((r) => inOrigins(r, filters.sources) && powderMatches(r, filters.query)),
    [items, filters],
  )
  const ids = useMemo(() => new Set(items.map((r) => r.id)), [items])
  const [picked, , replace] = usePicks(
    maxOverlay,
    state.compareIds,
    (pick) => set({ compareIds: pick }),
    (id) => ids.has(id),
  )

  const query = state.query.trim()
  const named = [onlyText(t, readOrigins(state.sources)), matchingText(t, query)].filter(Boolean)
  const columns: DirectoryColumn<PowderRow>[] = [
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
      key: 'form',
      label: msg('Form'),
      width: '8rem',
      value: (r) => r.grainForm,
      cell: (r) => (r.grainForm ? grainFormText(t, r.grainForm) : ''),
    },
    {
      key: 'base',
      label: msg('Base'),
      width: '5.5rem',
      value: (r) => r.propellantBase,
      cell: (r) => (r.propellantBase ? baseText(t, r.propellantBase) : ''),
    },
    {
      key: 'rate',
      label: msg('Mean vivacity'),
      unit: vivacityUnit,
      help: msg(
        'Dynamic vivacity averaged over burnt fraction 0.1 to 0.9 with its interval (plus and minus 2 standard uncertainties), on a log scale: model output from fitted M3 parameters, not manufacturer data. Empty without fitted parameters.',
      ),
      width: `calc(var(--rate-scale, ${scaleWidth}px) + 11rem)`,
      head: <RateTicks domain={domain} />,
      value: (r) => r.meanVivacity,
      cell: (r) =>
        r.meanVivacity === undefined ? null : (
          <span className="rate-cell">
            <Box component="span" className="rate-mean" ta="right">
              {n2(r.meanVivacity)}
            </Box>
            <Text component="span" inherit className="rate-interval" c="dimmed" fz="xs" truncate>
              {r.low === undefined
                ? ''
                : t('{low} to {high}', { low: n2(r.low), high: n2(r.high) })}
            </Text>
            <RateBar domain={domain} mean={r.meanVivacity} low={r.low} high={r.high} />
          </span>
        ),
    },
    {
      key: 'rows',
      label: msg('Training rows'),
      help: msg(
        'Load-table rows the model parameters were fitted to, the cartridges they cover and the day the load tables were read; the record page lists them per load table. A count, not a rating. Empty without fitted parameters: the load-table fit gives parameters only to powders with at least 10 training rows from at least 2 cartridges.',
      ),
      width: '13rem',
      num: true,
      value: (r) => r.trainingRows,
      cell: (r) =>
        r.trainingRows === undefined ? null : (
          <span className="fit-rows">
            <span>{r.trainingRows}</span>
            <Text component="span" inherit c="dimmed" fz="xs">
              {r.trainingCartridges !== undefined &&
                tn(r.trainingCartridges, '{count} cartridge', '{count} cartridges')}
              {r.trainingCartridges !== undefined && r.retrieved && ' · '}
              {r.retrieved && <Day day={r.retrieved} />}
            </Text>
          </span>
        ),
    },
    ...(counts.user > 0 ? [sourceColumn<PowderRow>(productLabel, removeRow)] : []),
  ]
  const facts = (r: PowderRow) =>
    // the burn-rate order before form and base: a phone's line ends where it is cut
    [
      r.origin === 'user' && t(originNames.user),
      r.manufacturerName,
      r.burnRateOrder !== undefined && t('burn-rate order {order}', { order: r.burnRateOrder }),
      r.trainingRows !== undefined &&
        tn(r.trainingRows, '{count} training row', '{count} training rows'),
      r.grainForm && grainFormText(t, r.grainForm),
      r.propellantBase && baseLine(t, r.propellantBase),
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
            <BarCount widest={widestCount(tr, items.length, 'powders')}>
              {countText(tr, shown.length, items.length, 'powders')}
            </BarCount>
            <SelectionSummary count={picked.length} max={maxOverlay} onClear={() => replace([])} />
          </>
        }
        actions={
          <>
            <CompareButton
              count={picked.length}
              min={0}
              max={maxOverlay}
              href={overlayHref(picked)}
              idle={t('Burn rates')}
            />
            <Button
              component={Link}
              href="/powders/designer"
              leftSection={<Plus aria-hidden="true" />}
            >
              {t('New powder')}
            </Button>
          </>
        }
      />
      <LibraryTabs />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder={t('Manufacturer or name, DP40…')}
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
          href={(r) => (r.origin === 'user' ? designerHref('powders', r.id) : `/powders/${r.id}`)}
          facts={facts}
          label={productLabel}
          caption={
            named.length === 0
              ? t('All powders')
              : t('Powders, {filters}', { filters: named.join(', ') })
          }
          noun="powders"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          selection={{
            ids: picked,
            max: maxOverlay,
            onChange: replace,
            can: inOverlay,
          }}
          phoneAction={(r, tabIndex) =>
            r.origin === 'user' ? (
              <DeleteRow row={r} name={productLabel(r)} onDelete={removeRow} tabIndex={tabIndex} />
            ) : null
          }
          breakBefore={state.sort ? undefined : (r, previous) => r.origin !== previous.origin}
          empty={<EmptyList noun="powders" filters={filterText(named)} onClear={clear} />}
        />
      </div>
    </>
  )
}
