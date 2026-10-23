'use client'

import { Button, Popover, UnstyledButton } from '@mantine/core'
import { freeRecoil } from '@openreloading/core'
import { memo, useEffect, useRef } from 'react'
import type { InteriorResponse } from '../lib/api-types.ts'
import {
  describeCurve,
  type FittedPowder,
  isFitted,
  type UnfittedPowder,
} from '../lib/burn-rate.ts'
import { ipscPowerFactor, powerFactor } from '../lib/power-factor.ts'
import { ladderTitle, seatingLengthName } from '../lib/seating-ladder.ts'
import { controlSize } from '../lib/theme.ts'
import { niceTicks } from '../lib/ticks.ts'
import {
  formatNumber,
  formatQuantity,
  inchText,
  msText,
  percentText,
  psi,
  type UnitSystem,
  unitsOf,
  withUnit,
} from '../lib/units.ts'
import {
  bandLine,
  bandNotice,
  firstPressureLimit,
  lengthText,
  resultBand,
  shownLength,
} from '../lib/workbench.ts'
import { AppPopover, popoverWidth } from './app-popover.tsx'
import { LazyVivacityChart } from './lazy-vivacity-chart.tsx'
import { NavIcon } from './nav-icons.tsx'
import { PanelTable } from './scroll-region.tsx'
import { SourceTitles } from './sources.tsx'
import { StandardBadge } from './standard-badge.tsx'
import {
  derived,
  loadRatioText,
  needsNetwork,
  notReached,
  type Outcome,
  type ShownStep,
} from './workbench-outcome.ts'

const reasonText: Record<string, string> = { noValue: 'no value' }

/** A limit as stored: bar with the record's decimals, and psi. */
function limitValue(l: NonNullable<InteriorResponse['limits']>[number]) {
  if (l.pressure === undefined) return ''
  return `${+(l.pressure / 1e5).toPrecision(12)} bar (${formatNumber(l.pressure / psi, 0)} psi)`
}

function yesNo(value: boolean | undefined) {
  if (value === undefined) return ''
  return value ? <strong className="exceeded">yes</strong> : 'no'
}

export function ErrorView({ outcome }: { outcome: Extract<Outcome, { kind: 'error' }> }) {
  const b = outcome.body
  if (outcome.status === 502 || !b) return <p>{outcome.offline ? needsNetwork : notReached}</p>
  return (
    <>
      {b.notice && <p>Notice: {b.notice}</p>}
      {outcome.status === 400 && b.issues ? (
        <>
          <p>The request does not match the schema:</p>
          <ul>
            {b.issues.map((i) => (
              <li key={`${i.path.join('.')} ${i.message}`}>
                {i.path.join('.')}: {i.message}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>{b.message ?? `HTTP ${outcome.status}`}</p>
      )}
      {outcome.status === 422 && (b.reason || b.field) && (
        <p>
          {b.reason && `Reason: ${b.reason}`}
          {b.reason && b.field && '; '}
          {b.field && `field: ${b.field}`}
        </p>
      )}
      {outcome.status === 503 && b.reason === 'busy' && outcome.retryAfter && (
        <p>Retry after {outcome.retryAfter} s</p>
      )}
    </>
  )
}

/**
 * The warnings in the notice line: a button with their summary on one line, the list in a
 * popover, so the line never grows; nothing without warnings.
 */
export function WarningsBlock({
  warnings,
  summary,
  announce,
}: {
  /** The lines, in the page's units. */
  warnings: { text: string }[]
  /** The summary line: count, step and names. */
  summary: string
  announce: boolean
}) {
  if (warnings.length === 0) return null
  return (
    <span role={announce ? 'alert' : undefined} className="warnings-block">
      <AppPopover
        position="bottom-end"
        width={popoverWidth.list}
        // in the notice line, so the result region holds the list; fixed, so it stays in the window
        withinPortal={false}
        floatingStrategy="fixed"
        keepMounted
        trapFocus
      >
        <Popover.Target>
          <Button
            variant="subtle"
            size={controlSize.row.button}
            aria-controls="warnings-list"
            className="warnings-summary"
            title={summary}
          >
            <span className="warn-icon">
              <NavIcon name="safety" size={14} />
            </span>
            {/* the count in view; the whole summary is the button's name and title */}
            <span className="warnings-text" aria-hidden="true">
              {warnings.length} warning{warnings.length === 1 ? '' : 's'}
            </span>
            <span className="visually-hidden">{summary}</span>
          </Button>
        </Popover.Target>
        <Popover.Dropdown id="warnings-list" className="warnings-list">
          <h3>Warnings</h3>
          <ul>
            {warnings.map((w) => (
              <li key={w.text}>
                <span className="warn-icon">
                  <NavIcon name="safety" size={14} />
                </span>
                {w.text}
              </li>
            ))}
          </ul>
        </Popover.Dropdown>
      </AppPopover>
    </span>
  )
}

/** The facts of the peak pressure readout: its time and travel and what the range covers. */
export function peakFacts(ok: Extract<Outcome, { kind: 'ok' }>, system: UnitSystem) {
  const { result: r, pressureRange: range, sampled } = ok.body
  const t = range.tolerances
  const failed = range.cases.filter((c) => c.maxPressure === null).length
  const sample =
    sampled?.status === 'sampled'
      ? ` The band is the 5th to 95th percentile of ${sampled.samples} draws (seed ${sampled.seed}${sampled.failed ? `, ${sampled.failed} left the model` : ''}) of the inputs, normal around their nominal values with the tolerance as the 90 % half width. The limit check uses the corner-case range ${formatQuantity('pressure', system, range.lowPressure)} to ${formatQuantity('pressure', system, range.highPressure)} ${system.pressure.symbol}.`
      : sampled
        ? ` The sampled bands are ${bandNotice(sampled)}: the corner-case range is shown.`
        : ''
  return `At ${msText(r.maxPressureTime)} and ${shownLength('travel', system, r.maxPressureTravel)} of travel.${sample} The ${sampled?.status === 'sampled' ? 'band' : 'range'} covers the input tolerances only, no model error: charge ${percentText(t.chargeFraction)}, volume ${percentText(t.volumeFraction)}, ${t.massFraction > 0 ? `bullet mass ${percentText(t.massFraction)}, ` : ''}burn rate ${percentText(t.burnRateFraction)}, temperature ${
    system.temperature === unitsOf.temperature.degF
      ? `${formatNumber((t.temperatureKelvin * 9) / 5, 1)} °F`
      : `${formatNumber(t.temperatureKelvin, 1)} K`
  }, start pressure ${percentText(t.startPressureFraction)}.${
    range.complete
      ? ''
      : ` ${failed} of ${range.cases.length} range cases could not be computed; the true range can be wider.`
  }`
}

/**
 * The readouts of the selected step: the key values peak pressure (with its share of the limit and
 * the limits table one click away), muzzle velocity and energy, then the list of the others.
 */
export function Readouts({
  ok,
  system,
  stale,
  printed = false,
}: {
  ok: Extract<Outcome, { kind: 'ok' }>
  system: UnitSystem
  stale: boolean
  /** In the print report: text in place of controls. */
  printed?: boolean
}) {
  const { result: r, pressureRange: range } = ok.body
  const band = resultBand(ok.body)
  const { ofMax, lead, ratio } = derived(ok)
  /** A value and its unit, the unit in the muted small type of the readout units. */
  const unit = (value: string, symbol: string) => (
    <>
      {value} <span className="readout-unit">{symbol}</span>
    </>
  )
  const p = (pa: number) => unit(formatQuantity('pressure', system, pa), system.pressure.symbol)
  const msUnit = (s: number) => unit(formatNumber(s * 1e3, 3), 'ms')
  const burnoutAt = (travel: number) =>
    unit(inchText(lengthText('travel', system, travel), system.length.symbol), system.length.symbol)
  // turns per second at the muzzle times 60; no rifling, no spin
  const twist = ok.load.barrel.twist
  const spin = twist ? (r.muzzleVelocity / twist) * 60 : undefined
  /** A value that is a phrase, not a number: smaller, so it stays on one line in a tile. */
  const phrase = 'readout-phrase'
  const peakTitle = peakFacts(ok, system)
  // the hover facts also as text: a title alone reaches neither the keyboard nor every screen reader
  const fact = (text: string | undefined) => text && <dd className="visually-hidden">{text}</dd>
  const mipTitle =
    '0.1 times the bullet mass in g times the muzzle velocity in m/s (DSB Sportordnung, Regeln für Pistole und Revolver, 2.21.1).'
  const { firearmMass, gasFactor, gasFactorNote } = ok.printed
  const recoil =
    firearmMass === undefined
      ? undefined
      : freeRecoil({
          firearmMass,
          projectileMass: ok.load.bullet.mass,
          chargeMass: ok.load.charge,
          muzzleVelocity: r.muzzleVelocity,
          gasFactor,
        })
  const recoilNote =
    recoil &&
    `Free recoil ${formatNumber(system.energy.fromSi(recoil.energy), 1)} ${system.energy.symbol}, ${formatNumber(system.velocity.fromSi(recoil.velocity), 2)} ${system.velocity.symbol}`
  const recoilTitle = `${recoilNote}. Kinetic energy and velocity of the free firearm. Momentum of the bullet plus the powder gas (charge mass times ${gasFactor} times muzzle velocity${gasFactorNote ? `; factor ${gasFactor}, ${gasFactorNote}` : ''}); muzzle devices not counted (SAAMI, Gun Recoil - Technical, 2018).`
  const leadTitle = `From the 10 % pressure time (${msText(r.tenPercentPressureTime)} after ignition) to muzzle exit.`
  const fillTitle =
    "Load ratio: the charge's bulk volume over the free volume behind the bullet; above 100 % the charge is compressed."
  const burnoutTitle = r.burnout ? `Burnout ${msText(r.burnout.time)} after ignition.` : undefined
  // the chart's key of that quantity before the label (globals.css)
  const key = (q: 'pressure' | 'velocity' | 'energy') => (
    <span className="series-key" data-q={q} aria-hidden="true" />
  )
  const limits = ofMax?.limit.pressure && (
    <span>
      {printed ? (
        // the report prints the limits table itself: the limit as text, no control
        `${formatNumber(ofMax.percent, 0)} % of CIP ${ofMax.limit.symbol} ${withUnit('pressure', system, ofMax.limit.pressure)}`
      ) : (
        /* the limits table and its sources one click away */
        <AppPopover position="bottom" width={popoverWidth.table} withinPortal trapFocus>
          <Popover.Target>
            <UnstyledButton
              className="readout-limits"
              aria-haspopup="dialog"
              title={`CIP ${ofMax.limit.symbol} ${withUnit('pressure', system, ofMax.limit.pressure)}`}
            >
              {formatNumber(ofMax.percent, 0)} % of CIP {ofMax.limit.symbol}
            </UnstyledButton>
          </Popover.Target>
          <Popover.Dropdown className="limits-popover">
            <LimitsView body={ok.body} system={system} />
          </Popover.Dropdown>
        </AppPopover>
      )}
    </span>
  )
  const bandText = bandLine(ok.body, system)
  const big = (value: string, unit: string) => (
    <>
      <span className="readout-value">{value}</span> <span className="readout-unit">{unit}</span>
    </>
  )
  return (
    <>
      <dl className="readouts readout-keys" data-stale={stale || undefined}>
        <div title={peakTitle} className="readout-wide">
          <dt>
            {key('pressure')}
            Peak pressure
          </dt>
          <dd className="readout-big">
            {big(formatQuantity('pressure', system, range.nominalPressure), system.pressure.symbol)}
          </dd>
          <dd className="readout-note">
            <span className="visually-hidden">
              {band.sampled ? '5th to 95th percentile ' : 'range '}
            </span>
            {formatQuantity('pressure', system, band.pressure.low)} to{' '}
            {formatQuantity('pressure', system, band.pressure.high)}
          </dd>
          <dd className="readout-share">
            {ofMax ? limits : <span className="readout-phrase">no comparable limit</span>}
          </dd>
          {/* the nominal as a share of the limit: the bar's full width is the limit */}
          {ofMax && (
            <dd className="readout-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, ofMax.percent)}%` }} />
            </dd>
          )}
          {fact(peakTitle)}
        </div>
        <div>
          <dt>
            {key('velocity')}
            Muzzle velocity
          </dt>
          <dd className="readout-big">
            {big(formatQuantity('velocity', system, r.muzzleVelocity), system.velocity.symbol)}
          </dd>
        </div>
        <div>
          <dt>
            {key('energy')}
            Muzzle energy
          </dt>
          <dd className="readout-big">
            {big(formatQuantity('energy', system, r.muzzleEnergy), system.energy.symbol)}
          </dd>
        </div>
      </dl>
      {!printed && bandText && <p className="band-line screen-only">{bandText}</p>}
      <dl className="readouts readout-list" data-stale={stale || undefined}>
        <div>
          <dt>Muzzle pressure</dt>
          <dd>{p(r.muzzleBreechPressure)}</dd>
        </div>
        <div title="From shot start to muzzle exit.">
          <dt>Barrel time</dt>
          <dd>{msUnit(r.barrelTime)}</dd>
          {fact('From shot start to muzzle exit.')}
        </div>
        <div title={leadTitle}>
          <dt>Bullet lead time</dt>
          <dd className={lead === undefined ? phrase : undefined}>
            {lead === undefined ? 'not available' : msUnit(lead)}
          </dd>
          {fact(leadTitle)}
        </div>
        <div
          title={[
            burnoutTitle,
            `${formatNumber(r.muzzleBurntFraction * 100, 0)} % burnt at the muzzle.`,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <dt>Burnout at</dt>
          <dd className={r.burnout ? undefined : phrase}>
            {r.burnout ? burnoutAt(r.burnout.travel) : 'no burnout in the barrel'}
          </dd>
          <dd className="readout-note">{formatNumber(r.muzzleBurntFraction * 100, 0)} % burnt</dd>
          {fact(burnoutTitle)}
        </div>
        <div title={fillTitle}>
          <dt>Case fill</dt>
          {/* without a value the reason in view and in print, in the small type of a phrase */}
          <dd className={ratio === undefined ? phrase : undefined}>{loadRatioText(ok, ratio)}</dd>
          {ratio !== undefined && ratio > 1 && <dd className="readout-note">compressed</dd>}
          {fact(fillTitle)}
        </div>
        <div>
          <dt>Efficiency</dt>
          <dd>{unit(formatNumber(r.efficiency * 100, 1), '%')}</dd>
        </div>
        {recoil && (
          <div title={recoilTitle}>
            <dt>Free recoil</dt>
            <dd>
              {unit(formatNumber(system.energy.fromSi(recoil.energy), 1), system.energy.symbol)},{' '}
              {unit(
                formatNumber(system.velocity.fromSi(recoil.velocity), 2),
                system.velocity.symbol,
              )}
            </dd>
            {fact(recoilTitle)}
          </div>
        )}
        <div>
          <dt>Muzzle spin</dt>
          <dd className={spin === undefined ? phrase : undefined}>
            {spin === undefined ? 'no twist' : unit(formatNumber(spin / 1000, 1), 'krpm')}
          </dd>
        </div>
        <div>
          <dt>Power factor (IPSC)</dt>
          <dd>{formatNumber(ipscPowerFactor(ok.load.bullet.mass, r.muzzleVelocity), 0)}</dd>
        </div>
        <div title={mipTitle}>
          <dt>MIP factor</dt>
          <dd>{formatNumber(powerFactor(ok.load.bullet.mass, r.muzzleVelocity), 1)}</dd>
          {fact(mipTitle)}
        </div>
      </dl>
    </>
  )
}

/** Ladder table columns; the flags follow the charge, so a narrow column keeps them in view. */
const ladderColumns = [
  'Step',
  'Charge',
  'Flags',
  'Peak pressure',
  'Percent of maximum',
  'Muzzle velocity',
  'Muzzle energy',
  'Case fill',
  'Burnt at the muzzle',
]

const limitColumns = [
  'Standard',
  'Symbol',
  'Method',
  'Value',
  'Compared',
  'Upper end above',
  'Nominal above',
]

/**
 * The pressure range of the result on a bar from 0 with its nominal and the first compared limit
 * (`firstPressureLimit`, as the chart's limit line); nothing without that limit.
 */
function LimitRange({ body, system }: { body: InteriorResponse; system: UnitSystem }) {
  const limit = firstPressureLimit(body.limits)
  if (limit?.pressure === undefined) return null
  const { lowPressure: low, highPressure: high, nominalPressure: nominal } = body.pressureRange
  const end = niceTicks(0, Math.max(high, limit.pressure) * 1.05).at(-1) ?? limit.pressure
  const at = (pa: number) => `${(Math.min(pa, end) / end) * 100}%`
  const text = (pa: number) => formatQuantity('pressure', system, pa)
  const unit = system.pressure.symbol
  // the nominal's and the limit's labels on the far sides of their lines, so they never meet
  const below = nominal < limit.pressure
  const name = `CIP ${limit.symbol} ${text(limit.pressure)} ${unit}`
  return (
    <div
      className="limit-range"
      role="img"
      aria-label={`Range ${text(low)} to ${text(high)} ${unit}, nominal ${text(nominal)} ${unit}, ${name}`}
    >
      <span
        className="limit-range-band"
        style={{ left: at(low), width: `calc(${at(high)} - ${at(low)})` }}
      />
      <span className="limit-range-nominal" style={{ left: at(nominal) }} />
      <span className="limit-range-limit" style={{ left: at(limit.pressure) }} />
      <span className="limit-range-text" data-end style={{ left: at(low) }}>
        {text(low)}
      </span>
      <span className="limit-range-text" style={{ left: at(high) }}>
        {text(high)}
      </span>
      <span
        className="limit-range-text"
        data-below
        data-end={below || undefined}
        style={{ left: at(nominal) }}
      >
        nominal {text(nominal)}
      </span>
      <span
        className="limit-range-text limit-range-name"
        data-below
        data-end={!below || undefined}
        style={{ left: at(limit.pressure) }}
      >
        {name}
      </span>
    </div>
  )
}

/** Pressure limits table and the sources of the limits; with `system` the range bar between them (the popover). */
export function LimitsView({ body, system }: { body: InteriorResponse; system?: UnitSystem }) {
  const resolved = body.resolved?.cartridge
  if (!body.limits || body.limits.length === 0)
    return (
      <p className="prompt empty-state">
        No pressure limit for this result: choose a cartridge to compare with its limits.
      </p>
    )
  return (
    <div className="result-group">
      <PanelTable
        label="Pressure limits"
        className="limits"
        caption="Pressure limits of the cartridge"
        columns={limitColumns}
      >
        {body.limits.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two limits can share symbol, variant and method
          <tr key={i}>
            <td data-label={limitColumns[0]}>
              <StandardBadge label="CIP" />
            </td>
            <td data-label={limitColumns[1]}>
              {l.symbol}
              {l.variant && ` (${l.variant})`}
            </td>
            <td data-label={limitColumns[2]}>{l.method ?? 'not stated in the record'}</td>
            <td data-label={limitColumns[3]} className="num">
              {limitValue(l)}
            </td>
            <td data-label={limitColumns[4]}>
              {l.compared
                ? 'yes'
                : `no: ${reasonText[l.reason ?? ''] ?? l.reason ?? 'not compared'}`}
            </td>
            <td data-label={limitColumns[5]}>{yesNo(l.exceeded)}</td>
            <td data-label={limitColumns[6]}>{yesNo(l.nominalExceeded)}</td>
          </tr>
        ))}
      </PanelTable>
      {system && <LimitRange body={body} system={system} />}
      {resolved && (
        <div className="limit-sources">
          <h3>Sources of the limits</h3>
          <ol className="sources">
            <li>
              CIP: <SourceTitles sources={resolved.provenance.sources} />
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}

/** The dynamic vivacity curve of the chosen powder, as on its page without the table; memoized. */
export const BurnRate = memo(function BurnRate({
  p,
  powderId,
  marks,
  height,
}: {
  p: FittedPowder | UnfittedPowder
  powderId?: string
  marks?: { z: number; label: string }[]
  /** The chart's height, px. */
  height: number
}) {
  return (
    <div className="burn-rate">
      {isFitted(p) ? (
        <LazyVivacityChart
          series={[{ powder: p, slot: 0 }]}
          title={`Dynamic vivacity of ${p.label}, model output`}
          description={describeCurve(p)}
          height={height}
          marks={marks}
        />
      ) : (
        <p>{p.reason}</p>
      )}
      {!powderId && <p>From the typed model parameters, no interval.</p>}
    </div>
  )
})

export const flagView = (text: string, title = text) => (
  <span className="flag" title={title}>
    <NavIcon name="safety" size={12} />
    <span className="flag-word">{text}</span>
  </span>
)

/** What the run's ladder varies, for its legend and table name. */
const ladderName = (ok: Extract<Outcome, { kind: 'ok' }> | undefined) =>
  ladderTitle(ok?.ladder.kind ?? 'charge')

/** The charge ladder strip of the shown run: a step selector, or the one step as text. */
export function LadderStrip({
  ok,
  steps,
  stale,
  chargeText,
  oneFlag,
  value,
  select,
  name = 'ladder-step',
}: {
  ok: Extract<Outcome, { kind: 'ok' }> | undefined
  steps: ShownStep[]
  stale: boolean
  /** The radios' group name; the phone range view has a second strip. */
  name?: string
  /** The charge of the shown result, else of the field. */
  chargeText: string
  /** The flag of the one step. */
  oneFlag: string | undefined
  /** What a step varies: its charge, or its seating length. */
  value: (s: ShownStep) => string
  /** Shows ladder step `i`. */
  select: (i: number) => void
}) {
  // the selected step in view in a strip that scrolls sideways
  const cells = useRef<HTMLDivElement>(null)
  const [selectedStep, runId] = [ok?.selected, ok?.id]
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new run re-centres the same index
  useEffect(() => {
    if (selectedStep === undefined) return
    // the strip's own scroll only: scrollIntoView would move the page as well
    const strip = cells.current
    const cell = strip?.querySelector('.ladder-cell[data-selected]')
    if (!cell || !strip) return
    const [c, r] = [cell.getBoundingClientRect(), strip.getBoundingClientRect()]
    strip.scrollLeft += c.left - r.left - (r.width - c.width) / 2
  }, [selectedStep, runId])
  return (
    <fieldset className="ladder-strip" data-stale={stale || undefined}>
      <legend className="ladder-legend">{ladderName(ok)} ladder</legend>
      {ok && steps.length > 1 ? (
        // native radios: arrow keys move and select; Home and End are added
        <div
          ref={cells}
          role="radiogroup"
          aria-label="Ladder steps"
          className="ladder-cells"
          onKeyDown={(e) => {
            if (e.key !== 'Home' && e.key !== 'End') return
            e.preventDefault()
            const valid = steps.filter((s) => s.body)
            const to = (e.key === 'Home' ? valid[0] : valid[valid.length - 1]).n - 1
            select(to)
            e.currentTarget.querySelectorAll('input')[to]?.focus()
          }}
        >
          {steps.map((s) => (
            <label
              key={s.n}
              className="ladder-cell"
              data-selected={s.n - 1 === ok.selected || undefined}
            >
              <input
                type="radio"
                name={name}
                className="visually-hidden"
                checked={s.n - 1 === ok.selected}
                disabled={!s.body}
                onChange={() => select(s.n - 1)}
              />
              {/* a selector: the readouts and the Ladder table give each step's values; the cell
                  shows what the step varies, its step number is for screen readers and the
                  main charge's tooltip */}
              <span className="visually-hidden">
                Step {s.label}
                {s.label === '0' && ', main'}:{' '}
              </span>
              <strong title={s.label === '0' ? 'Main charge' : undefined}>{value(s)}</strong>{' '}
              {s.d?.ofMax && (
                <span className="cell-percent">{formatNumber(s.d.ofMax.percent, 0)} %</span>
              )}{' '}
              {s.flag && flagView(s.flag)}
              {s.error && flagView(`model: ${s.error.reason ?? 'invalid'}`)}
            </label>
          ))}
        </div>
      ) : (
        // one step as text: its values are the readouts above
        <>
          <span className="ladder-step">
            Step 0, main, {chargeText}
            {!ok && ', not run'}
          </span>
          {oneFlag && flagView(oneFlag)}
          <span className="ladder-note">Ladder steps are set in the Powder card.</span>
        </>
      )}
    </fieldset>
  )
}

/** The steps of the shown run as a table, one row per charge. */
export function LadderTable({
  ok,
  steps,
  system,
  value,
  velocity,
}: {
  ok: Extract<Outcome, { kind: 'ok' }> | undefined
  steps: ShownStep[]
  system: UnitSystem
  /** What a step varies: its charge, its seating length or its powder temperature. */
  value: (s: ShownStep) => string
  velocity: (r: InteriorResponse['result']) => string
}) {
  const pressure = system.pressure
  // without a load ratio on any step the column would repeat the load ratio readout's phrase
  const ratioShown = steps.some((st) => st.d?.ratio !== undefined)
  // a seating ladder names its length (COAL or CBTO) and shows the case volume behind the bullet
  const seating = ok?.ladder.kind === 'seating'
  const lead = seating
    ? [seatingLengthName[ok.ladder.seatingBy ?? 'overallLength'], 'Usable case volume']
    : ok?.ladder.kind === 'temperature'
      ? ['Powder temperature']
      : ['Charge']
  const columns = ladderColumns
    .flatMap((c) => (c === 'Charge' ? lead : [c]))
    .filter((c) => ratioShown || c !== 'Case fill')
  return (
    <PanelTable
      label={`${ladderName(ok)} ladder steps`}
      className="limits ladder-table"
      caption={`${ladderName(ok)} ladder steps`}
      columns={columns}
    >
      {steps.map((s) => (
        <tr key={s.n} aria-current={ok && s.n - 1 === ok.selected ? 'true' : undefined}>
          <td data-label="Step">
            {s.label}
            {s.label === '0' && ' main'}
          </td>
          <td data-label={lead[0]} className="num">
            {value(s)}
          </td>
          {s.seating && (
            <td data-label={lead[1]} className="num">
              {formatQuantity('capacity', system, s.seating.volume)} {system.capacity.symbol}
            </td>
          )}
          <td data-label="Flags">
            {s.flag || s.error ? flagView(s.flag ?? 'model error') : 'none'}
          </td>
          {s.body && s.d && s.at ? (
            <>
              <td data-label="Peak pressure" className="num">
                {formatQuantity('pressure', system, s.body.pressureRange.nominalPressure)}{' '}
                {pressure.symbol}
              </td>
              <td data-label="Percent of maximum" className="num">
                {s.d.ofMax ? `${formatNumber(s.d.ofMax.percent, 0)} %` : 'no limit'}
              </td>
              <td data-label="Muzzle velocity" className="num">
                {velocity(s.body.result)}
              </td>
              <td data-label="Muzzle energy" className="num">
                {formatQuantity('energy', system, s.body.result.muzzleEnergy)}{' '}
                {system.energy.symbol}
              </td>
              {ratioShown && <td data-label="Case fill">{loadRatioText(s.at, s.d.ratio)}</td>}
              <td data-label="Burnt at the muzzle" className="num">
                {formatNumber(s.body.result.muzzleBurntFraction * 100, 0)} %
              </td>
            </>
          ) : (
            <td data-label="Result" colSpan={columns.length - (seating ? 4 : 3)}>
              Not computed: {s.error?.message}
            </td>
          )}
        </tr>
      ))}
    </PanelTable>
  )
}
