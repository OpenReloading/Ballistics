'use client'

/** Throwaway prototype of #827 behind `?proto=a|b|c` (`lib/proto-827.ts`); not in the normal workbench. */
import { Button } from '@mantine/core'
import { fromSi } from '@open-reloading/schema'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { msg, type Translator } from '../i18n/translate.ts'
import { apiFetch } from '../lib/api-fetch.ts'
import { translateMessage } from '../lib/core-messages.ts'
import type { InteriorBody } from '../lib/interior-input.ts'
import {
  type Deviation,
  deviationOf,
  type Entry,
  inSample,
  matchingRows,
  nearestRow,
  notComparable,
  publishedFile,
  rowLoad,
} from '../lib/proto-827.ts'
import { fixedFieldText, formatQuantity, type UnitSystem, withUnit } from '../lib/units.ts'
import { PanelTable } from './scroll-region.tsx'
import { useLoad, useResult } from './workbench-context.ts'
import { notReached, type Outcome } from './workbench-outcome.ts'

type Ok = Extract<Outcome, { kind: 'ok' }>
type Sim = { velocity: number; pressure: number } | { failed: string }

const noSeat = msg('No seated bullet: the row cannot be placed')
const chargeOnly = msg('Published rows compare with a charge ladder only.')

// shared by the header row and the tab of layout c, keyed by the request: a row is simulated once
const runs = new Map<string, Promise<Sim>>()

async function request(load: InteriorBody['load']): Promise<Sim> {
  try {
    const res = await apiFetch('interior', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm3', load }),
    })
    const json = await res.json()
    if (!res.ok) return { failed: json?.message ?? `Error ${res.status}.` }
    return { velocity: json.result.muzzleVelocity, pressure: json.result.peakBreechPressure }
  } catch {
    return { failed: notReached }
  }
}

/** The simulation of a row at the maker's conditions; a failure is not kept, so a later run asks again. */
async function simulate(ok: Ok, entry: Entry): Promise<Sim> {
  const load = rowLoad(ok.load, ok.printed.seated, entry)
  if (!load) return { failed: noSeat }
  const key = JSON.stringify(load)
  const known = runs.get(key)
  if (known) return known
  const asked = request(load)
  runs.set(key, asked)
  const sim = await asked
  if ('failed' in sim) runs.delete(key)
  return sim
}

/**
 * The matching rows of the shown run, their simulations and whether the cartridge is in-sample. A
 * stale run shows none: the chosen powder may no longer be the run's. A seating or temperature
 * ladder shows none either: its step's travel and volume are not the seating the rows move from.
 */
function usePublished() {
  const { ok: run, powder, stale } = useResult()
  const ok = run && !stale ? run : undefined
  const charge = ok?.ladder.kind === 'charge'
  const entries = useMemo(
    () =>
      ok && charge
        ? matchingRows(publishedFile, {
            cartridge: ok.cartridge,
            powder: powder?.id,
            bulletMass: fromSi('mass', ok.load.bullet.mass),
          })
        : [],
    [ok, charge, powder],
  )
  const [sims, setSims] = useState<{ ok: Ok; values: Map<string, Sim> }>()
  const [sample, setSample] = useState(false)
  useEffect(() => {
    if (!ok || entries.length === 0) return
    let live = true
    Promise.all(entries.map(async (e) => [e.key, await simulate(ok, e)] as const)).then((pairs) => {
      if (live) setSims({ ok, values: new Map(pairs) })
    })
    inSample(ok.cartridge ?? '').then((s) => live && setSample(s))
    return () => {
      live = false
    }
  }, [ok, entries])
  return {
    ok,
    charge,
    entries,
    sims: sims && sims.ok === ok ? sims.values : undefined,
    sample,
  }
}

const signed = (x: number, digits: number) => `${x > 0 ? '+' : ''}${formatNumber(x, digits)}`

/** A deviation with its band: a marker on a scale of twice the band, never a pass mark. */
function DeviationCell({ d, system, t }: { d: Deviation; system: UnitSystem; t: Translator['t'] }) {
  const at = Math.max(0, Math.min(100, 50 + (25 * d.percent) / d.band))
  return (
    <>
      {signed(d.percent, 1)} %
      {d.delta !== undefined &&
        ` (${d.delta > 0 ? '+' : ''}${withUnit('velocity', system, d.delta)})`}
      <span style={{ display: 'block', color: 'var(--muted)' }}>
        {t('band ±{band} %', { band: formatNumber(d.band, 1) })}
      </span>
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          position: 'relative',
          height: 6,
          width: 96,
          marginTop: 2,
          background: `linear-gradient(90deg, transparent 25%, var(--mantine-color-default-border) 25% 75%, transparent 75%)`,
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: `calc(${at}% - 1px)`,
            width: 2,
            height: 6,
            background: 'var(--mantine-color-text)',
          }}
        />
      </span>
    </>
  )
}

/** The printed figures of a row as the table prints them. */
const printedText = (e: Entry, t: Translator['t']) =>
  [
    `${e.charge.kind === 'max' ? t('Max') : t('Start')} ${e.charge.charge.raw}`,
    e.charge.velocity &&
      `${e.charge.velocity.raw}${e.charge.velocity.assumedUnit ? ` ${e.charge.velocity.assumedUnit}` : ''}`,
    e.charge.pressure?.peak.raw,
  ]
    .filter(Boolean)
    .join(', ')

/** Barrel, twist and COAL as printed. */
const conditionsText = (e: Entry, t: Translator['t']) =>
  t('{recipe}, barrel {barrel}, COAL {coal}', {
    recipe: `${e.load.powder.printed}, ${e.load.bullet.printed}`,
    barrel: e.load.barrel?.length?.raw ?? '?',
    coal: e.load.coal?.raw ?? '?',
  })

function SourceLink({ e }: { e: Entry }) {
  const { t } = useTranslation()
  const s = publishedFile.provenance.sources[e.load.source ?? 0]
  return (
    <a href={e.load.url ?? s?.url} target="_blank" rel="noreferrer">
      {t('{publisher}, page {page}', { publisher: s?.publisher ?? '', page: e.load.page })}
    </a>
  )
}

/** Fills charge, travel and volume of the load from the row: the load has no barrel field, the travel stands for it. */
function UseRow({ ok, e }: { ok: Ok; e: Entry }) {
  const { t } = useTranslation()
  const { applyCharge, form, system } = useLoad()
  const row = rowLoad(ok.load, ok.printed.seated, e)
  if (!row) return null
  return (
    <Button
      size="compact-sm"
      variant="default"
      onClick={() => {
        applyCharge(row.charge)
        form.setFieldValue('travel', {
          text: fixedFieldText('length', system, row.barrel.length),
          si: row.barrel.length,
        })
        form.setFieldValue('volume', {
          text: fixedFieldText('capacity', system, row.chamber.volume),
          si: row.chamber.volume,
        })
      }}
    >
      {t('Use this row')}
    </Button>
  )
}

/** The table's cells keep one line elsewhere; these wrap so the rows fit the result column at 1280 px. */
const wrap = { whiteSpace: 'normal', minWidth: '9em' } as const

function RowCells({
  ok,
  e,
  sim,
  sample,
}: {
  ok: Ok
  e: Entry
  sim?: Sim | undefined
  sample: boolean
}) {
  const { t } = useTranslation()
  const { system } = useResult()
  const reasons = notComparable(e)
  const d = sim && !('failed' in sim) ? deviationOf(e, sim) : undefined
  const pending = sim === undefined ? t('Simulating') : undefined
  const failed =
    sim && 'failed' in sim
      ? t('Not computed: {reason}', {
          reason: sim.failed === noSeat ? t(noSeat) : translateMessage(sim.failed, t),
        })
      : undefined
  return (
    <tr>
      <td data-label={t('Printed')} style={wrap}>
        {printedText(e, t)}
        <span style={{ display: 'block', color: 'var(--muted)' }}>{conditionsText(e, t)}</span>
        <span style={{ display: 'block' }}>
          <SourceLink e={e} />
        </span>
        {sample && (
          <span style={{ display: 'block' }}>{t('in-sample: fitted on this cartridge')}</span>
        )}
      </td>
      <td data-label={t('Simulated')} className="num" style={wrap}>
        {pending ??
          failed ??
          (sim &&
            !('failed' in sim) &&
            `${withUnit('velocity', system, sim.velocity)}, ${formatQuantity('pressure', system, sim.pressure)} ${system.pressure.symbol}`)}
      </td>
      <td data-label={t('Velocity deviation')} style={wrap}>
        {reasons.velocity
          ? t(reasons.velocity)
          : d?.velocity && <DeviationCell d={d.velocity} system={system} t={t} />}
      </td>
      <td data-label={t('Pressure deviation')} style={wrap}>
        {reasons.pressure
          ? t(reasons.pressure)
          : d?.pressure && <DeviationCell d={d.pressure} system={system} t={t} />}
      </td>
      <td data-label={t('Load')}>
        <UseRow ok={ok} e={e} />
      </td>
    </tr>
  )
}

const notice = (t: Translator['t']) =>
  t(
    "Each row is the maker's printed value, cited, simulated at the maker's charge, COAL and test barrel. Results are simulations, not load data; a deviation shows where the simulation lies against the validation band, not a pass.",
  )

/** The list of matching rows: the tab of layouts a and c, the opened header row of b. */
export function PublishedRows() {
  const { t } = useTranslation()
  const { ok, charge, entries, sims, sample } = usePublished()
  if (!ok)
    return (
      <p className="prompt empty-state">
        {t('Run the simulation to compare it with published loads.')}
      </p>
    )
  if (!charge) return <p className="prompt empty-state">{t(chargeOnly)}</p>
  if (entries.length === 0)
    return (
      <p className="prompt empty-state">
        {t('No published row matches this cartridge, powder record and bullet mass.')}
      </p>
    )
  return (
    <>
      <p className="hint">{notice(t)}</p>
      <PanelTable
        label={t('Published loads')}
        className="limits ladder-table"
        caption={t('Published loads (maker values) and the simulation at their conditions')}
        columns={[
          t('Printed'),
          { label: t('Simulated'), num: true },
          t('Velocity deviation'),
          t('Pressure deviation'),
          t('Load'),
        ]}
      >
        {entries.map((e) => (
          <RowCells key={e.key} ok={ok} e={e} sim={sims?.get(e.key)} sample={sample} />
        ))}
      </PanelTable>
    </>
  )
}

/** The header row of layouts b and c: the row nearest the run's charge and the count; `open` shows the list. */
export function PublishedHeader({
  open,
  opened,
}: {
  open: () => void
  opened?: boolean | undefined
}) {
  const { t } = useTranslation()
  const { ok, entries, sims } = usePublished()
  if (!ok || entries.length === 0) return null
  const near = nearestRow(entries, ok.load.charge)
  const sim = near && sims?.get(near.key)
  const d = near && sim && !('failed' in sim) ? deviationOf(near, sim).velocity : undefined
  return (
    <div
      className="proto-827-head"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '0 12px', alignItems: 'baseline' }}
    >
      <strong>{t('Published loads: {count} matching', { count: entries.length })}</strong>
      {near && (
        <span>
          {t('Nearest: {row}', { row: `${near.load.powder.printed} ${printedText(near, t)}` })}
          {d && <> {t('velocity {value}', { value: `${signed(d.percent, 1)} %` })}</>}{' '}
          <SourceLink e={near} />
        </span>
      )}
      <Button size="compact-sm" variant="subtle" onClick={open} aria-expanded={opened}>
        {opened ? t('Hide rows') : t('Show rows')}
      </Button>
    </div>
  )
}
