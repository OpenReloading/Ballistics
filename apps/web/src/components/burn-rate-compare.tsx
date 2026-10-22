'use client'

import { Group, MultiSelect, Pill } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { ChartLine } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPowder } from '../lib/api-client.ts'
import type { PowderRecord } from '../lib/api-types.ts'
import {
  classifyPowder,
  dashes,
  describeCurve,
  type FittedPowder,
  isFitted,
  maxOverlay,
  type OverlayPick,
  overlayFrom,
} from '../lib/burn-rate.ts'
import { CurveTable } from './curve-table.tsx'
import { LazyVivacityChart } from './lazy-vivacity-chart.tsx'
import { Panel } from './panel.tsx'
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

/**
 * The burn-rate overlay: up to six powders picked in a searchable select, each pill with
 * its line sample; colour slots stay with their powder when another is removed. The picks live in
 * `?add=` only (a powder page sends its id, the powder list's Compare its picks), no preset and no
 * stored overlay; each burn law is fetched when its powder is picked, so the page carries
 * only the names.
 */
export function BurnRateCompare({ options }: { options: { value: string; label: string }[] }) {
  // the chart is taller on a wide window (the same breakpoint as the placeholder's CSS)
  const wide = useMediaQuery('(min-width: 88em)')
  const [picks, setPicks] = useState<OverlayPick[]>([])
  const [read, setRead] = useState(false)
  const [records, setRecords] = useState<Record<string, PowderRecord | 'error'>>({})
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
    const { pathname } = window.location
    const p = new URLSearchParams(window.location.search)
    if (picks.length > 0) p.set('add', picks.map((s) => s.id).join(','))
    else p.delete('add')
    const s = p.toString().replaceAll('%2C', ',')
    window.history.replaceState(null, '', `${pathname}${s ? `?${s}` : ''}`)
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
    <Panel id="overlay" title="Overlay" className="burn-overlay">
      <MultiSelect
        label="Powders in the overlay"
        classNames={{ label: 'visually-hidden' }}
        description={`Up to ${maxOverlay}`}
        placeholder="Add powder"
        data={options}
        value={picks.map((p) => p.id)}
        onChange={change}
        maxValues={maxOverlay}
        searchable
        hidePickedOptions
        nothingFoundMessage="No powder with a curve matches"
        renderPill={({ option, value, onRemove }) => (
          <Pill withRemoveButton onRemove={onRemove}>
            <Group component="span" display="inline-flex" gap={4} wrap="nowrap">
              <Swatch slot={slotOf.get(String(value)) ?? 0} />
              {option?.label ?? value}
            </Group>
          </Pill>
        )}
      />
      {failed.length > 0 && (
        <ErrorNote
          title="A curve could not be loaded."
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
      {!read ? (
        <Loading what="curves" />
      ) : picks.length === 0 ? (
        <EmptyNote
          icon={<ChartLine size={24} aria-hidden="true" />}
          title="No powder in the overlay."
          description="Tick powders in the powder list to add them."
        />
      ) : loading ? (
        <Loading what="curves" />
      ) : series.length === 0 ? null : (
        // every pick failed: the error note above stands alone
        <>
          <LazyVivacityChart
            series={series}
            height={wide ? 420 : 300}
            title="Dynamic vivacity of the chosen powders, model output"
            description={series.map((s) => describeCurve(s.powder)).join(' ')}
          />
          <details className="values-details">
            <summary>Values table</summary>
            <CurveTable
              powders={series.map((s) => s.powder)}
              caption="Dynamic vivacity of the chosen powders"
            />
          </details>
        </>
      )}
    </Panel>
  )
}
