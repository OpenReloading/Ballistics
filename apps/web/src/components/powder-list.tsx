'use client'

import { useLingui } from '@lingui/react'
import { Badge, Box, Button, Text } from '@mantine/core'
import { FlaskConical, Plus } from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import Link from '@/platform/link.tsx'
import { useTranslation } from '../i18n/language.ts'
import { ungrouped } from '../i18n/lingui.ts'
import { formatNumber } from '../i18n/number.ts'
import {
  maxOverlay,
  overlayHref,
  type PowderRow,
  rateDomain,
  unfitTitles,
  vivacityUnit,
} from '../lib/burn-rate.ts'
import { notMetallic, powderRowIncomplete, shotgunOnly } from '../lib/complete-records.ts'
import { listTitles } from '../lib/list-titles.ts'
import { baseLine, baseText, grainFormText } from '../lib/list-values.ts'
import { filterText, matchingText } from '../lib/lists.ts'
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
import { CompareButton, hiddenPicks, SelectionSummary, usePicks } from './compare-picks.tsx'
import { Day } from './day.tsx'
import { DirectoryPage } from './directory-page.tsx'
import { type DirectoryColumn, DirectoryTable, useListState } from './directory-table.tsx'
import { DeleteRow, sourceColumn, useUserRecords } from './list-sources.tsx'
import { MissingMark } from './missing-mark.tsx'
import { RateBar, RateTicks, scaleWidth } from './rate-scale.tsx'
import { EmptyList, EmptyNote } from './states.tsx'

const n2 = (v: number | undefined) => (v === undefined ? '' : formatNumber(v, 2))

/** What the powder list shows when it has no powder at all: where a powder comes from. */
function NoPowders() {
  const { i18n } = useLingui()
  return (
    <EmptyNote
      icon={<FlaskConical size={24} aria-hidden="true" />}
      title={i18n._({ id: 'powders.none', message: 'No powders yet' })}
      description={i18n._({
        id: 'powders.noneHint',
        message:
          'The catalogue has no powders. Make one with New powder, or import a table of your powders with Import.',
      })}
      action={
        <Button component={Link} href="/powders/designer" leftSection={<Plus aria-hidden="true" />}>
          {i18n._({ id: 'powders.new', message: 'New powder' })}
        </Button>
      }
    />
  )
}

/** Every row's interval on one log scale; powders with a curve are ticked for the overlay of `/powders/burn-rates`; this browser's powders are Mine rows, opened in the powder designer. */
export function PowderList({ packed }: { packed: PackedPowder[] }) {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const [records, removeRow, read] = useUserRecords()
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
  const [picked, untick, replace] = usePicks(
    maxOverlay,
    state.compareIds,
    (pick) => set({ compareIds: pick }),
    (id) => ids.has(id),
  )

  const query = state.query.trim()
  const named = [onlyText(i18n, readOrigins(state.sources)), matchingText(i18n, query)].filter(
    Boolean,
  )
  const columns: DirectoryColumn<PowderRow>[] = [
    {
      key: 'manufacturer',
      label: /*i18n*/ { id: 'powders.column.manufacturer', message: 'Manufacturer' },
      width: '10.5rem',
      dim: true,
      value: (r) => r.manufacturerName,
      cell: (r) => r.manufacturerName,
    },
    {
      key: 'name',
      label: /*i18n*/ { id: 'powders.column.name', message: 'Name' },
      value: (r) => r.name,
      cell: (r) => (
        <>
          {r.name}
          {shotgunOnly(r) ? (
            <Badge ml="xs" variant="light" color="gray">
              {i18n._(notMetallic)}
            </Badge>
          ) : (
            powderRowIncomplete(r) && <MissingMark />
          )}
        </>
      ),
    },
    {
      key: 'form',
      label: /*i18n*/ { id: 'powders.column.form', message: 'Form' },
      width: '8rem',
      value: (r) => r.grainForm,
      cell: (r) => (r.grainForm ? grainFormText(t, r.grainForm) : ''),
    },
    {
      key: 'base',
      label: /*i18n*/ { id: 'powders.column.base', message: 'Base' },
      width: '5.5rem',
      value: (r) => r.propellantBase,
      cell: (r) => (r.propellantBase ? baseText(t, r.propellantBase) : ''),
    },
    {
      key: 'rate',
      label: /*i18n*/ { id: 'powders.column.rate', message: 'Mean vivacity' },
      unit: vivacityUnit,
      help: /*i18n*/ {
        id: 'powders.column.rateHelp',
        message:
          'Dynamic vivacity averaged over burnt fraction 0.1 to 0.9, plus and minus 2 standard uncertainties, log scale. Model output from fitted M3 parameters, not manufacturer data.',
      },
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
                : i18n._({
                    id: 'powders.range',
                    message: '{low} to {high}',
                    values: { low: n2(r.low), high: n2(r.high) },
                  })}
            </Text>
            <RateBar domain={domain} mean={r.meanVivacity} low={r.low} high={r.high} />
          </span>
        ),
    },
    {
      key: 'rows',
      label: /*i18n*/ { id: 'powders.column.rows', message: 'Training rows' },
      // the column's sentence, then the burn-rate page's for a powder without fitted parameters and a shotgun-only one
      help: [
        i18n._({
          id: 'powders.column.rowsHelp',
          message:
            'Load-table rows the model was fitted to, their cartridges and the day the load tables were read; the record page lists them per load table. A count, not a rating.',
        }),
        i18n._(unfitTitles.none),
        i18n._(unfitTitles.shotgun),
      ].join(' '),
      width: '13rem',
      num: true,
      value: (r) => r.trainingRows,
      cell: (r) =>
        r.trainingRows === undefined ? null : (
          <span className="fit-rows">
            <span>{r.trainingRows}</span>
            <Text component="span" inherit c="dimmed" fz="xs">
              {r.trainingCartridges !== undefined &&
                i18n._(
                  'powders.trainingCartridges',
                  { count: r.trainingCartridges },
                  {
                    message: '{count, plural, one {# cartridge} other {# cartridges}}',
                    formats: ungrouped,
                  },
                )}
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
      r.origin === 'user' && i18n._(originNames.user),
      r.manufacturerName,
      r.burnRateOrder !== undefined &&
        i18n._({
          id: 'powders.burnRateOrder',
          message: 'burn-rate order {order}',
          values: { order: r.burnRateOrder },
        }),
      r.trainingRows !== undefined &&
        i18n._(
          'powders.trainingRows',
          { count: r.trainingRows },
          {
            message: '{count, plural, one {# training row} other {# training rows}}',
            formats: ungrouped,
          },
        ),
      r.grainForm && grainFormText(t, r.grainForm),
      r.propellantBase && baseLine(t, r.propellantBase),
    ]
      .filter(Boolean)
      .join(' · ')
  return (
    <DirectoryPage
      title={listTitles.powders}
      noun="powders"
      shown={shown.length}
      total={items.length}
      status={
        <SelectionSummary
          count={picked.length}
          max={maxOverlay}
          hidden={hiddenPicks(picked, shown, items, productLabel)}
          onUntick={untick}
          onClear={() => replace([])}
        />
      }
      actions={
        <>
          <CompareButton
            count={picked.length}
            min={0}
            max={maxOverlay}
            href={overlayHref(picked)}
            idle={i18n._({ id: 'powders.burnRates', message: 'Burn rates' })}
          />
          <Button
            component={Link}
            href="/powders/designer"
            leftSection={<Plus aria-hidden="true" />}
          >
            {i18n._({ id: 'powders.new', message: 'New powder' })}
          </Button>
        </>
      }
      state={state}
      set={set}
      placeholder={i18n._({ id: 'powders.search', message: 'Manufacturer or name, DP40…' })}
      columns={columns}
      counts={counts}
      table={
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => (r.origin === 'user' ? designerHref('powders', r.id) : `/powders/${r.id}`)}
          facts={facts}
          label={productLabel}
          caption={
            named.length === 0
              ? i18n._({ id: 'powders.all', message: 'All powders' })
              : i18n._({
                  id: 'powders.filtered',
                  message: 'Powders, {filters}',
                  values: { filters: named.join(', ') },
                })
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
          empty={
            items.length === 0 ? (
              // the browser's own powders may still be on their way
              read ? (
                <NoPowders />
              ) : null
            ) : (
              <EmptyList noun="powders" filters={filterText(named)} onClear={clear} />
            )
          }
        />
      }
    />
  )
}
