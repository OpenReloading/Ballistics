'use client'

import { Button, Group, MultiSelect, Pill } from '@mantine/core'
import type { Powder } from '@open-reloading/schema'
import { ChartLine } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { fetchPowder } from '../lib/api-client.ts'
import {
  classifyPowder,
  dashes,
  describeCurve,
  type FittedPowder,
  isFitted,
  maxOverlay,
  modelCaption,
  type OverlayPick,
  overlayFrom,
  type UnfittedPowder,
  uncertaintyFactor,
  unfitTitles,
  unfittedGroups,
} from '../lib/burn-rate.ts'
import { say } from '../lib/wording.ts'
import { CurveTable } from './curve-table.tsx'
import { LazyVivacityChart } from './lazy-vivacity-chart.tsx'
import { Panel } from './panel.tsx'
import { LinkButton } from './record-actions.tsx'
import { EmptyNote, ErrorNote, Loading } from './states.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'

/** Line sample of a colour slot, for the pills. */
function Swatch({ slot }: { slot: number }) {
  return (
    <svg width="28" height="10" aria-hidden="true" className="swatch">
      <line
        x1="1"
        y1="5"
        x2="27"
        y2="5"
        stroke={`var(--series-${slot + 1})`}
        strokeWidth="2"
        strokeDasharray={dashes[slot]}
      />
    </svg>
  )
}

/** Puts the picks in the address as `?add=`, the other parameters kept. */
function writeAdd(picks: OverlayPick[]) {
  const { pathname } = window.location
  const p = new URLSearchParams(window.location.search)
  if (picks.length > 0) p.set('add', picks.map((s) => s.id).join(','))
  else p.delete('add')
  const s = p.toString().replaceAll('%2C', ',')
  window.history.replaceState(null, '', `${pathname}${s ? `?${s}` : ''}`)
}

function OverlayBody({
  read,
  picks,
  loading,
  series,
}: {
  read: boolean
  picks: number
  loading: boolean
  series: { powder: FittedPowder; slot: number }[]
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!read || loading) return <Loading what="curves" />
  if (picks === 0)
    return (
      <EmptyNote
        icon={<ChartLine size={24} aria-hidden="true" />}
        title={t('No powder in the overlay.')}
      />
    )
  // every pick failed: the error note above stands alone
  if (series.length === 0) return null
  return (
    <>
      <LazyVivacityChart
        series={series}
        title={t('Dynamic vivacity of the chosen powders, model output')}
        description={series.map((s) => describeCurve(s.powder, t)).join(' ')}
      />
      <p className="screen-only record-note">{t(modelCaption)}</p>
      <Button
        className="curve-toggle"
        variant={open ? 'light' : 'subtle'}
        size="compact-xs"
        aria-expanded={open}
        aria-controls="overlay-values"
        onClick={() => setOpen((o) => !o)}
      >
        {t('Values table')}
      </Button>
      <div id="overlay-values" className="curve-values" data-open={open || undefined}>
        <CurveTable
          powders={series.map((s) => s.powder)}
          caption={t('Dynamic vivacity of the chosen powders')}
        />
      </div>
    </>
  )
}

/**
 * The burn-rate overlay: up to six powders picked in a searchable select, each pill with
 * its line sample; colour slots stay with their powder when another is removed. The picks live in
 * `?add=` only (a powder page sends its id, the powder list's Compare its picks), no preset and no
 * stored overlay; each burn law is fetched when its powder is picked, so the page carries
 * only the names.
 */
export function BurnRateCompare({ options }: { options: { value: string; label: string }[] }) {
  const { t } = useTranslation()
  const [picks, setPicks] = useState<OverlayPick[]>([])
  const [read, setRead] = useState(false)
  const [records, setRecords] = useState<Record<string, Powder | 'error'>>({})
  const names = useManufacturerNames()
  // classified at render, so the labels get the manufacturer names when they arrive after a record
  const laws = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(records).map(([id, r]): [string, FittedPowder | 'error'] => {
          if (r === 'error') return [id, r]
          const p = classifyPowder(r, names)
          return [id, isFitted(p) ? p : 'error']
        }),
      ),
    [records, names],
  )
  const known = useMemo(() => new Set(options.map((o) => o.value)), [options])
  const requested = useRef(new Set<string>())

  // the URL is read after mounting, so the page stays prerendered
  useEffect(() => {
    setPicks(overlayFrom(window.location.search, maxOverlay).filter((p) => known.has(p.id)))
    setRead(true)
  }, [known])

  useEffect(() => {
    if (!read) return
    writeAdd(picks)
  }, [picks, read])

  useEffect(() => {
    for (const { id } of picks) {
      if (records[id] || requested.current.has(id)) continue
      requested.current.add(id)
      fetchPowder(id)
        .then((record) => setRecords((l) => ({ ...l, [id]: record ?? 'error' })))
        .catch(() => setRecords((l) => ({ ...l, [id]: 'error' })))
    }
  }, [picks, records])

  const change = (ids: string[]) => {
    const kept = picks.filter((p) => ids.includes(p.id))
    const used = new Set(kept.map((p) => p.slot))
    const free = [...Array(maxOverlay).keys()].filter((k) => !used.has(k))
    const added = ids.filter((id) => !kept.some((p) => p.id === id))
    setPicks([...kept, ...added.map((id, i) => ({ id, slot: free[i] ?? 0 }))])
  }

  const series = picks.flatMap(({ id, slot }) => {
    const powder = laws[id]
    return powder && powder !== 'error' ? [{ powder, slot }] : []
  })
  const failed = picks.filter((p) => laws[p.id] === 'error')
  const loading = picks.length > series.length + failed.length
  const slotOf = new Map(picks.map((p) => [p.id, p.slot]))
  return (
    <Panel id="overlay" title={msg('Overlay')} translated className="burn-overlay">
      <MultiSelect
        label={t('Powders in the overlay')}
        classNames={{ label: 'visually-hidden' }}
        description={t('Up to {max}', { max: maxOverlay })}
        placeholder={t('Add powder')}
        data={options}
        value={picks.map((p) => p.id)}
        onChange={change}
        maxValues={maxOverlay}
        searchable
        hidePickedOptions
        nothingFoundMessage={t('No powder with a curve matches')}
        renderPill={({ option, value, onRemove }) => (
          <Pill withRemoveButton {...(onRemove && { onRemove })}>
            <Group component="span" display="inline-flex" gap={4} wrap="nowrap">
              <Swatch slot={slotOf.get(String(value)) ?? 0} />
              {option?.label ?? value}
            </Group>
          </Pill>
        )}
      />
      {failed.length > 0 && (
        <ErrorNote
          title={t('A curve could not be loaded.')}
          onRetry={() => {
            for (const p of failed) requested.current.delete(p.id)
            const retried = new Set(failed.map((p) => p.id))
            setRecords((l) =>
              Object.fromEntries(Object.entries(l).filter(([id]) => !retried.has(id))),
            )
          }}
        >
          {failed.map((p) => options.find((o) => o.value === p.id)?.label ?? p.id).join(', ')}
        </ErrorNote>
      )}
      <OverlayBody read={read} picks={picks.length} loading={loading} series={series} />
    </Panel>
  )
}

/** The lead of the burn-rate page. */
export function BurnRatesLead() {
  const { t } = useTranslation()
  return (
    <p className="muted page-lead">
      {t('Dynamic vivacity, the burn rate per pressure, over burnt fraction.')}
    </p>
  )
}

/** The powders without a curve, in groups by the reason, each a link to its record. */
export function NoCurve({ powders }: { powders: UnfittedPowder[] }) {
  const { t } = useTranslation()
  const groups = unfittedGroups(powders)
  if (groups.length === 0) return null
  return (
    <Panel id="no-curve" title={msg('Without a curve')} translated className="no-curve">
      {groups.map((g) => (
        <div key={g.kind}>
          <p>{t(unfitTitles[g.kind], { factor: uncertaintyFactor })}</p>
          <ul className="inline-list">
            {g.powders.map((p) => (
              <li key={p.id}>
                <Link href={`/powders/${p.id}`}>{p.label}</Link>
                {p.detailWhy && ` (${say(t, p.detailWhy)})`}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Panel>
  )
}

/** The page bar's action: the powder list in burn-rate order. */
export function PowdersByBurnRate() {
  const { t } = useTranslation()
  return <LinkButton href="/powders?sort=-rate">{t('Powders by burn rate')}</LinkButton>
}
