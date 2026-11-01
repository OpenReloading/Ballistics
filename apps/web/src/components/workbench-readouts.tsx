'use client'

import { Popover, UnstyledButton } from '@mantine/core'
import { freeRecoil } from '@open-reloading/core'
import { fromSi } from '@open-reloading/schema'
import { memo, useEffect, useRef } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber, plainNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import type { ErrorBody, InteriorResponse } from '../lib/api-types.ts'
import {
  describeCurve,
  type FittedPowder,
  isFitted,
  type UnfittedPowder,
} from '../lib/burn-rate.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { limitShare, limitWithValue } from '../lib/limit-text.ts'
import { burnRateLabel, type Lot } from '../lib/lot-rows.ts'
import { ipscPowerFactor, powerFactor } from '../lib/power-factor.ts'
import { type RunnableLadderKind, seatingLengthName } from '../lib/seating-ladder.ts'
import { niceTicks } from '../lib/ticks.ts'
import {
  formatQuantity,
  inchText,
  lengthText,
  msText,
  percentText,
  psi,
  shownLength,
  type UnitSystem,
  unitsOf,
  withUnit,
} from '../lib/units.ts'
import { type CapacityRule, capacityRuleText } from '../lib/volume-tolerance.ts'
import { bandNotice, maxVolumeFraction, pressureLimit, resultBand } from '../lib/workbench.ts'
import { AppPopover, popoverWidth } from './app-popover.tsx'
import { LazyVivacityChart } from './lazy-vivacity-chart.tsx'
import { NavIcon } from './nav-icons.tsx'
import { PanelTable } from './scroll-region.tsx'
import { RecordSourcesLink } from './sources.tsx'
import { StandardBadge } from './standard-badge.tsx'
import {
  derived,
  loadRatioText,
  needsNetwork,
  notReached,
  type Outcome,
  type ShownStep,
} from './workbench-outcome.ts'

const reasonText: Record<string, Message> = { noValue: msg('no value') }

/** What an invalid run (the reasons of `InteriorReason` in core) means and what to change. */
const invalidRunText: Record<string, Message> = {
  input: msg('A value is outside what the model accepts. Check the field named below.'),
  chamberVolume: msg(
    'The charge does not fit the chamber: the solid powder and its covolume fill the usable case volume. Lower the charge or enter a larger usable case volume.',
  ),
  noShotStart: msg(
    'The powder burned out before the bullet started to move. Raise the charge or lower the start pressure.',
  ),
  stuck: msg(
    'The bullet stopped in the bore before the muzzle. Raise the charge or lower the bore resistance.',
  ),
  integration: msg(
    'The calculation did not converge. Check that the values are plausible, in particular the charge and the usable case volume.',
  ),
  maxTime: msg(
    'The bullet did not reach the muzzle within the run time. Raise the charge or check the bullet travel and the barrel length.',
  ),
}

/** A limit as stored: bar with the record's decimals, and psi. */
function limitValue(l: NonNullable<InteriorResponse['limits']>[number]) {
  if (l.pressure === undefined) return ''
  return `${plainNumber(+fromSi('pressure', l.pressure).toPrecision(12))} bar (${formatNumber(l.pressure / psi, 0)} psi)`
}

function yesNo(value: boolean | undefined, t: Translator['t']) {
  if (value === undefined) return ''
  return value ? <strong className="exceeded">{t('yes')}</strong> : t('no')
}

/** The sentence for an error answer: for a refused run what is wrong and what to change. */
function errorHeadline(
  status: number,
  b: Pick<ErrorBody, 'reason' | 'message'>,
  t: Translator['t'],
) {
  const sentence = status === 422 && b.reason ? invalidRunText[b.reason] : undefined
  if (sentence) return t(sentence)
  return b.message ? translateMessage(b.message, t) : t('HTTP {status}', { status })
}

export function ErrorView({ outcome }: { outcome: Extract<Outcome, { kind: 'error' }> }) {
  const { t } = useTranslation()
  const b = outcome.body
  if (outcome.status === 502 || !b) return <p>{t(outcome.offline ? needsNetwork : notReached)}</p>
  return (
    <>
      {b.notice && <p>{t('Notice: {notice}', { notice: translateMessage(b.notice, t) })}</p>}
      {outcome.status === 400 && b.issues ? (
        <>
          <p>{t('The request does not match the schema:')}</p>
          <ul>
            {b.issues.map((i) => (
              <li key={`${i.path.join('.')} ${i.message}`}>
                {i.path.join('.')}: {translateMessage(i.message, t)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>{errorHeadline(outcome.status, b, t)}</p>
      )}
      {outcome.status === 422 && (b.reason || b.field) && (
        <p>
          {b.reason && b.field
            ? t('Reason: {reason}; field: {field}', {
                reason: translateMessage(b.reason, t),
                field: b.field,
              })
            : b.reason
              ? t('Reason: {reason}', { reason: translateMessage(b.reason, t) })
              : t('field: {field}', { field: b.field ?? '' })}
        </p>
      )}
      {outcome.status === 503 && b.reason === 'busy' && outcome.retryAfter && (
        <p>{t('Retry after {seconds} s', { seconds: outcome.retryAfter })}</p>
      )}
    </>
  )
}

/** The volume's part of the range's list: its tolerance, and the rule it follows (`volume-tolerance.ts`). */
function volumeText(fraction: number, rule: CapacityRule | undefined, t: Translator['t']) {
  const value = percentText(fraction)
  if (fraction >= maxVolumeFraction)
    return t('volume {value}, the limit of the range: the volume estimate can be wider', { value })
  return rule
    ? t('volume {value}, from {rule}', { value, rule: t(capacityRuleText[rule]) })
    : t('volume {value}', { value })
}

/** The facts of the peak pressure readout: its time and travel and what the range covers. */
export function peakFacts(
  ok: Extract<Outcome, { kind: 'ok' }>,
  system: UnitSystem,
  t: Translator['t'],
) {
  const { result: r, pressureRange: range, sampled } = ok.body
  const tol = range.tolerances
  const failed = range.cases.filter((c) => c.maxPressure === null).length
  const band = {
    low: formatQuantity('pressure', system, range.lowPressure),
    high: formatQuantity('pressure', system, range.highPressure),
    unit: system.pressure.symbol,
  }
  const draws = sampled?.status === 'sampled' ? sampled : undefined
  const sample = draws
    ? draws.failed
      ? t(
          'The band is the 5th to 95th percentile of {samples} draws (seed {seed}, {failed} left the model) of the inputs, normal around their nominal values with the tolerance as the 90 % half width. The limit check uses the corner-case range {low} to {high} {unit}.',
          { samples: draws.samples, seed: draws.seed, failed: draws.failed, ...band },
        )
      : t(
          'The band is the 5th to 95th percentile of {samples} draws (seed {seed}) of the inputs, normal around their nominal values with the tolerance as the 90 % half width. The limit check uses the corner-case range {low} to {high} {unit}.',
          { samples: draws.samples, seed: draws.seed, ...band },
        )
    : sampled
      ? t('The sampled bands are {notice}: the corner-case range is shown.', {
          notice: bandNotice(sampled, t) ?? '',
        })
      : undefined
  const temperature =
    system.temperature === unitsOf.temperature.degF
      ? `${formatNumber((tol.temperatureKelvin * 9) / 5, 1)} °F`
      : `${formatNumber(tol.temperatureKelvin, 1)} K`
  const covered = [
    t('charge {value}', { value: percentText(tol.chargeFraction) }),
    volumeText(tol.volumeFraction, ok.volumeRule, t),
    ...(tol.massFraction > 0
      ? [t('bullet mass {value}', { value: percentText(tol.massFraction) })]
      : []),
    t('burn rate {value}', { value: percentText(tol.burnRateFraction) }),
    t('temperature {value}', { value: temperature }),
    t('start pressure {value}', { value: percentText(tol.startPressureFraction) }),
  ].join(', ')
  return [
    t('At {time} and {travel} of travel.', {
      time: msText(r.maxPressureTime),
      travel: shownLength('travel', system, r.maxPressureTravel),
    }),
    sample,
    draws
      ? t('The band covers the input tolerances only, no model error: {list}.', { list: covered })
      : t('The range covers the input tolerances only, no model error: {list}.', {
          list: covered,
        }),
    range.complete
      ? undefined
      : t('{failed} of {total} range cases could not be computed; the true range can be wider.', {
          failed,
          total: range.cases.length,
        }),
  ]
    .filter(Boolean)
    .join(' ')
}

/** A value that is a phrase, not a number: smaller, so it stays on one line in a tile. */
const readoutPhrase = 'readout-phrase'

/** A value and its unit, the unit in the muted small type of the readout units. */
const unit = (value: string, symbol: string) => (
  <>
    {value} <span className="readout-unit">{symbol}</span>
  </>
)

// the hover facts also as text: a title alone reaches neither the keyboard nor every screen reader
const readoutFact = (text: string | undefined) =>
  text && <dd className="visually-hidden">{text}</dd>

/** Where the bullet's powder burns out, and how much of it is burnt at the muzzle. */
function BurnoutItem({ ok, system }: { ok: Extract<Outcome, { kind: 'ok' }>; system: UnitSystem }) {
  const { t } = useTranslation()
  const r = ok.body.result
  const burnoutTitle = r.burnout
    ? t('Burnout {time} after ignition.', { time: msText(r.burnout.time) })
    : undefined
  const burnt = formatNumber(r.muzzleBurntFraction * 100, 0)
  const burnoutAt = (travel: number) =>
    unit(inchText(lengthText('travel', system, travel), system.length.symbol), system.length.symbol)
  return (
    <div
      title={[burnoutTitle, t('{percent} % burnt at the muzzle.', { percent: burnt })]
        .filter(Boolean)
        .join(' ')}
    >
      <dt>{t('Burnout at')}</dt>
      <dd className={r.burnout ? undefined : readoutPhrase}>
        {r.burnout ? burnoutAt(r.burnout.travel) : t('no burnout in the barrel')}
      </dd>
      <dd className="readout-note">{t('{percent} % burnt', { percent: burnt })}</dd>
      {readoutFact(burnoutTitle)}
    </div>
  )
}

/** The notes the run's gas factor carries when it is the default of a cartridge without a table. */
const gasFactorNotes: Record<string, Message> = {
  'cartridge record not loaded': msg('cartridge record not loaded'),
  'cartridge record without a CIP table': msg('cartridge record without a CIP table'),
}

/** The free recoil of the firearm, when its mass is known. */
function RecoilItem({ ok, system }: { ok: Extract<Outcome, { kind: 'ok' }>; system: UnitSystem }) {
  const { t } = useTranslation()
  const { firearmMass, gasFactor, gasFactorNote } = ok.printed
  if (firearmMass === undefined) return null
  const recoil = freeRecoil({
    firearmMass,
    projectileMass: ok.load.bullet.mass,
    chargeMass: ok.load.charge,
    muzzleVelocity: ok.body.result.muzzleVelocity,
    gasFactor,
  })
  const energy = `${formatNumber(system.energy.fromSi(recoil.energy), 1)} ${system.energy.symbol}`
  const velocity = `${formatNumber(system.velocity.fromSi(recoil.velocity), 2)} ${system.velocity.symbol}`
  const recoilNote = t('Free recoil {energy}, {velocity}', { energy, velocity })
  const known = gasFactorNote ? gasFactorNotes[gasFactorNote] : undefined
  const note = known ? t(known) : gasFactorNote
  const recoilTitle = note
    ? t(
        '{summary}. Kinetic energy and velocity of the free firearm. Momentum of the bullet plus the powder gas (charge mass times {factor} times muzzle velocity; factor {factor}, {note}); muzzle devices not counted.',
        { summary: recoilNote, factor: gasFactor, note },
      )
    : t(
        '{summary}. Kinetic energy and velocity of the free firearm. Momentum of the bullet plus the powder gas (charge mass times {factor} times muzzle velocity); muzzle devices not counted.',
        { summary: recoilNote, factor: gasFactor },
      )
  return (
    <div title={recoilTitle}>
      <dt>{t('Free recoil')}</dt>
      <dd>
        {unit(formatNumber(system.energy.fromSi(recoil.energy), 1), system.energy.symbol)},{' '}
        {unit(formatNumber(system.velocity.fromSi(recoil.velocity), 2), system.velocity.symbol)}
      </dd>
      {readoutFact(recoilTitle)}
    </div>
  )
}

/** The muzzle spin: turns per second at the muzzle times 60; no rifling, no spin. */
function SpinItem({ ok }: { ok: Extract<Outcome, { kind: 'ok' }> }) {
  const { t } = useTranslation()
  const twist = ok.load.barrel.twist
  const spin = twist ? (ok.body.result.muzzleVelocity / twist) * 60 : undefined
  return (
    <div>
      <dt>{t('Muzzle spin')}</dt>
      <dd className={spin === undefined ? readoutPhrase : undefined}>
        {spin === undefined ? t('no twist') : unit(formatNumber(spin / 1000, 1), 'krpm')}
      </dd>
    </div>
  )
}

type OfMax = NonNullable<ReturnType<typeof derived>['ofMax']>

/** The peak pressure's share of the limit: as text in the report, else a button to the limits table. */
function PeakLimits({
  ok,
  system,
  printed,
  ofMax,
}: {
  ok: Extract<Outcome, { kind: 'ok' }>
  system: UnitSystem
  printed: boolean
  ofMax: OfMax
}) {
  const { t } = useTranslation()
  const pressure = ofMax.limit.pressure
  if (pressure === undefined) return null
  const percent = formatNumber(ofMax.percent, 0)
  return (
    <span>
      {printed ? (
        // the report prints the limits table itself: the limit as text, no control
        limitShare(ofMax.limit, percent, t, withUnit('pressure', system, pressure))
      ) : (
        /* the limits table and its sources one click away */
        <AppPopover position="bottom" width={popoverWidth.table} withinPortal trapFocus>
          <Popover.Target>
            <UnstyledButton
              className="readout-limits"
              aria-haspopup="dialog"
              title={limitWithValue(ofMax.limit, withUnit('pressure', system, pressure), t)}
            >
              {limitShare(ofMax.limit, percent, t)}
            </UnstyledButton>
          </Popover.Target>
          <Popover.Dropdown className="limits-popover">
            <LimitsView body={ok.body} system={system} />
          </Popover.Dropdown>
        </AppPopover>
      )}
    </span>
  )
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
  const { t } = useTranslation()
  const { result: r, pressureRange: range } = ok.body
  const band = resultBand(ok.body, printed)
  const { ofMax, lead, ratio } = derived(ok, t)
  const p = (pa: number) => unit(formatQuantity('pressure', system, pa), system.pressure.symbol)
  const msUnit = (s: number) => unit(formatNumber(s * 1e3, 3), 'ms')
  const peakTitle = peakFacts(ok, system, t)
  const mipTitle = t(
    '0.1 times the bullet mass in g times the muzzle velocity in m/s ({source}).',
    {
      source: 'DSB Sportordnung 2.21.1',
    },
  )
  const leadTitle = t('From the 10 % pressure time ({time} after ignition) to muzzle exit.', {
    time: msText(r.tenPercentPressureTime),
  })
  const fillTitle = t(
    "Load ratio: the charge's bulk volume over the free volume behind the bullet; above 100 % the charge is compressed.",
  )
  // the chart's key of that quantity before the label (globals.css)
  const key = (q: 'pressure' | 'velocity' | 'energy') => (
    <span className="series-key" data-q={q} aria-hidden="true" />
  )
  const limits = ofMax?.limit.pressure && (
    <PeakLimits ok={ok} system={system} printed={printed} ofMax={ofMax} />
  )
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
            {t('Peak pressure')}
          </dt>
          <dd className="readout-big">
            {big(formatQuantity('pressure', system, range.nominalPressure), system.pressure.symbol)}
          </dd>
          <dd className="readout-note">
            <span className="visually-hidden">
              {band.sampled ? t('5th to 95th percentile') : t('range')}{' '}
            </span>
            {t('{low} to {high}', {
              low: formatQuantity('pressure', system, band.pressure.low),
              high: formatQuantity('pressure', system, band.pressure.high),
            })}
          </dd>
          <dd className="readout-share">
            {ofMax ? limits : <span className="readout-phrase">{t('no comparable limit')}</span>}
          </dd>
          {/* the nominal as a share of the limit: the bar's full width is the limit */}
          {ofMax && (
            <dd className="readout-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, ofMax.percent)}%` }} />
            </dd>
          )}
          {readoutFact(peakTitle)}
        </div>
        <div>
          <dt>
            {key('velocity')}
            {t('Muzzle velocity')}
          </dt>
          <dd className="readout-big">
            {big(formatQuantity('velocity', system, r.muzzleVelocity), system.velocity.symbol)}
          </dd>
        </div>
        <div>
          <dt>
            {key('energy')}
            {t('Muzzle energy')}
          </dt>
          <dd className="readout-big">
            {big(formatQuantity('energy', system, r.muzzleEnergy), system.energy.symbol)}
          </dd>
        </div>
      </dl>
      <dl className="readouts readout-list" data-stale={stale || undefined}>
        <div>
          <dt>{t('Muzzle pressure')}</dt>
          <dd>{p(r.muzzleBreechPressure)}</dd>
        </div>
        <div title={t('From shot start to muzzle exit.')}>
          <dt>{t('Barrel time')}</dt>
          <dd>{msUnit(r.barrelTime)}</dd>
          {readoutFact(t('From shot start to muzzle exit.'))}
        </div>
        <div title={leadTitle}>
          <dt>{t('Bullet lead time')}</dt>
          <dd className={lead === undefined ? readoutPhrase : undefined}>
            {lead === undefined ? t('not available') : msUnit(lead)}
          </dd>
          {readoutFact(leadTitle)}
        </div>
        <BurnoutItem ok={ok} system={system} />
        <div title={fillTitle}>
          <dt>{t('Case fill')}</dt>
          {/* without a value the reason in print; on screen it is a result note */}
          <dd className={ratio === undefined ? readoutPhrase : undefined}>
            {ratio === undefined && !printed ? t('not available') : loadRatioText(ok, ratio, t)}
          </dd>
          {ratio !== undefined && ratio > 1 && <dd className="readout-note">{t('compressed')}</dd>}
          {readoutFact(fillTitle)}
        </div>
        <div>
          <dt>{t('Efficiency')}</dt>
          <dd>{unit(formatNumber(r.efficiency * 100, 1), '%')}</dd>
        </div>
        <RecoilItem ok={ok} system={system} />
        <SpinItem ok={ok} />
        <div>
          <dt>{t('Power factor (IPSC)')}</dt>
          <dd>{formatNumber(ipscPowerFactor(ok.load.bullet.mass, r.muzzleVelocity), 0)}</dd>
        </div>
        <div title={mipTitle}>
          <dt>{t('MIP factor')}</dt>
          <dd>{formatNumber(powerFactor(ok.load.bullet.mass, r.muzzleVelocity), 1)}</dd>
          {readoutFact(mipTitle)}
        </div>
      </dl>
    </>
  )
}

const limitColumns = [
  msg('Standard'),
  msg('Symbol'),
  msg('Method'),
  msg('Value'),
  msg('Compared'),
  msg('Upper end above'),
  msg('Nominal above'),
]

/** Why a limit was not compared: a known reason in words, else the API's own text. */
function notComparedReason(reason: string | undefined, t: Translator['t']) {
  if (!reason) return t('not compared')
  const known = reasonText[reason]
  return known ? t(known) : translateMessage(reason, t)
}

/**
 * The pressure range of the result on a bar from 0 with its nominal and the compared limit
 * (`pressureLimit`, as the chart's limit line); nothing without that limit.
 */
function LimitRange({ body, system }: { body: InteriorResponse; system: UnitSystem }) {
  const { t } = useTranslation()
  const limit = pressureLimit(body.limits)
  if (limit?.pressure === undefined) return null
  const { lowPressure: low, highPressure: high, nominalPressure: nominal } = body.pressureRange
  const end = niceTicks(0, Math.max(high, limit.pressure) * 1.05).at(-1) ?? limit.pressure
  const at = (pa: number) => `${(Math.min(pa, end) / end) * 100}%`
  const text = (pa: number) => formatQuantity('pressure', system, pa)
  const unit = system.pressure.symbol
  // the nominal's and the limit's labels on the far sides of their lines, so they never meet
  const below = nominal < limit.pressure
  const name = limitWithValue(limit, `${text(limit.pressure)} ${unit}`, t)
  return (
    <div
      className="limit-range"
      role="img"
      aria-label={t('Range {low} to {high} {unit}, nominal {nominal} {unit}, {name}', {
        low: text(low),
        high: text(high),
        nominal: text(nominal),
        unit,
        name,
      })}
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
        {t('nominal {value}', { value: text(nominal) })}
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

/**
 * Pressure limits table and their source line; with `system` the range bar between them (the
 * popover). On screen the line links the cartridge record's sources; on paper it names the record.
 */
export function LimitsView({
  body,
  system,
  printed = false,
}: {
  body: InteriorResponse
  system?: UnitSystem | undefined
  /** In the print report: the record's name in place of the link. */
  printed?: boolean
}) {
  const { t } = useTranslation()
  const resolved = body.resolved?.cartridge
  if (!body.limits || body.limits.length === 0)
    return (
      <p className="prompt empty-state">
        {t('No pressure limit for this result: choose a cartridge to compare with its limits.')}
      </p>
    )
  const heads = limitColumns.map((c) => t(c))
  return (
    <div className="result-group">
      <PanelTable
        label={t('Pressure limits')}
        className="limits"
        caption={t('Pressure limits of the cartridge')}
        columns={heads}
      >
        {body.limits.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two limits can share symbol, variant and method
          <tr key={i}>
            <td data-label={heads[0]}>{l.typed ? t('typed') : <StandardBadge label="CIP" />}</td>
            <td data-label={heads[1]}>
              {l.symbol}
              {l.variant && ` (${l.variant})`}
            </td>
            <td data-label={heads[2]}>
              {l.typed ? '' : (l.method ?? t('not stated in the record'))}
            </td>
            <td data-label={heads[3]} className="num">
              {limitValue(l)}
            </td>
            <td data-label={heads[4]}>
              {l.compared
                ? t('yes')
                : t('no: {reason}', { reason: notComparedReason(l.reason, t) })}
            </td>
            <td data-label={heads[5]}>{yesNo(l.exceeded, t)}</td>
            <td data-label={heads[6]}>{yesNo(l.nominalExceeded, t)}</td>
          </tr>
        ))}
      </PanelTable>
      {system && <LimitRange body={body} system={system} />}
      {resolved &&
        !body.limits.every((l) => l.typed) &&
        (printed ? (
          <p className="limit-sources">
            {t('Pressure limits: C.I.P. TDCC, cartridge record {name}', { name: resolved.name })}
          </p>
        ) : (
          <p className="limit-sources">
            {t('Source: C.I.P. TDCC')} <RecordSourcesLink kind="cartridges" id={resolved.id} />
          </p>
        ))}
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
  powderId?: string | undefined
  marks?: { z: number; label: string }[] | undefined
  /** The chart's height, px. */
  height: number
}) {
  // memoized: the numbers of its text and chart are written in the language shown
  const { t } = useTranslation()
  return (
    <div className="burn-rate">
      {isFitted(p) ? (
        <LazyVivacityChart
          series={[{ powder: p, slot: 0 }]}
          title={t('Dynamic vivacity of {label}, model output', { label: p.label })}
          description={describeCurve(p, t)}
          height={height}
          marks={marks}
        />
      ) : (
        <p>{p.reason}</p>
      )}
      {!powderId && <p>{t('From the typed model parameters, no interval.')}</p>}
    </div>
  )
})

export const flagView = (text: string, title = text) => (
  <span className="flag" title={title}>
    <NavIcon name="safety" size={12} />
    <span className="flag-word">{text}</span>
  </span>
)

const ladderNames: Record<RunnableLadderKind, Message> = {
  charge: msg('Charge ladder'),
  seating: msg('Seating ladder'),
  temperature: msg('Temperature ladder'),
}

/** What the run's ladder varies, for its legend and table name. */
export const ladderName = (ok: Extract<Outcome, { kind: 'ok' }> | undefined, t: Translator['t']) =>
  t(ladderNames[ok?.ladder.kind ?? 'charge'])

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
  name?: string | undefined
  /** The charge of the shown result, else of the field. */
  chargeText: string
  /** The flag of the one step. */
  oneFlag: string | undefined
  /** What a step varies: its charge, or its seating length. */
  value: (s: ShownStep) => string
  /** Shows ladder step `i`. */
  select: (i: number) => void
}) {
  const { t } = useTranslation()
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
      <legend className="ladder-legend">{ladderName(ok, t)}</legend>
      {ok && steps.length > 1 ? (
        // native radios: arrow keys move and select; Home and End are added
        <div
          ref={cells}
          role="radiogroup"
          aria-label={t('Ladder steps')}
          tabIndex={-1}
          className="ladder-cells"
          onKeyDown={(e) => {
            if (e.key !== 'Home' && e.key !== 'End') return
            e.preventDefault()
            const valid = steps.filter((s) => s.body)
            const target = e.key === 'Home' ? valid[0] : valid[valid.length - 1]
            if (!target) return
            const to = target.n - 1
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
                {s.label === '0'
                  ? t('Step {label}, main:', { label: s.label })
                  : t('Step {label}:', { label: s.label })}{' '}
              </span>
              <strong title={s.label === '0' ? t('Main charge') : undefined}>{value(s)}</strong>{' '}
              {s.d?.ofMax && (
                <span className="cell-percent">{formatNumber(s.d.ofMax.percent, 0)} %</span>
              )}{' '}
              {s.flag && flagView(s.flag)}
              {s.error &&
                flagView(
                  t('model: {reason}', {
                    reason: s.error.reason ? translateMessage(s.error.reason, t) : t('invalid'),
                  }),
                )}
            </label>
          ))}
        </div>
      ) : (
        // one step as text: its values are the readouts above
        <>
          <span className="ladder-step">
            {ok
              ? t('Step 0, main, {charge}', { charge: chargeText })
              : t('Step 0, main, {charge}, not run', { charge: chargeText })}
          </span>
          {oneFlag && flagView(oneFlag)}
          <span className="ladder-note">{t('Ladder steps are set in the Powder card.')}</span>
        </>
      )}
    </fieldset>
  )
}

type LadderLot = { fraction: number; steps: Record<Lot, ShownStep[]> }

/** The leading columns of the ladder table: what a step varies, with a seating ladder the case volume. */
function ladderLead(ok: Extract<Outcome, { kind: 'ok' }> | undefined, t: Translator['t']) {
  if (ok?.ladder.kind === 'seating')
    return [seatingLengthName[ok.ladder.seatingBy ?? 'overallLength'], t('Usable case volume')]
  return ok?.ladder.kind === 'temperature' ? [t('Powder temperature')] : [t('Charge')]
}

/** The cells of a computed ladder step from its peak pressure on. */
function LadderResultCells({
  step,
  system,
  velocity,
  ratioShown,
  lot,
}: {
  step: {
    body: InteriorResponse
    d: NonNullable<ShownStep['d']>
    at: Extract<Outcome, { kind: 'ok' }>
  }
  system: UnitSystem
  velocity: (r: InteriorResponse['result']) => string
  ratioShown: boolean
  lot: LadderLot | undefined
}) {
  const { t } = useTranslation()
  const { body, d, at } = step
  return (
    <>
      <td data-label={t('Peak pressure')} className="num">
        {formatQuantity('pressure', system, body.pressureRange.nominalPressure)}{' '}
        {system.pressure.symbol}
      </td>
      <td data-label={t('Percent of maximum')} className="num">
        {d.ofMax ? `${formatNumber(d.ofMax.percent, 0)} %` : t('no limit')}
      </td>
      <td data-label={t('Muzzle velocity')} className="num">
        {velocity(body.result)}
      </td>
      <td data-label={t('Muzzle energy')} className="num">
        {formatQuantity('energy', system, body.result.muzzleEnergy)} {system.energy.symbol}
      </td>
      {ratioShown && <td data-label={t('Case fill')}>{loadRatioText(at, d.ratio, t)}</td>}
      {lot && (
        <td data-label={t('Barrel time')} className="num">
          {msText(body.result.barrelTime)}
        </td>
      )}
      <td data-label={t('Burnt at the muzzle')} className="num">
        {formatNumber(body.result.muzzleBurntFraction * 100, 0)} %
      </td>
    </>
  )
}

type LadderRowProps = {
  s: ShownStep
  which?: Lot | undefined
  ok: Extract<Outcome, { kind: 'ok' }> | undefined
  system: UnitSystem
  value: (s: ShownStep) => string
  velocity: (r: InteriorResponse['result']) => string
  lead: string[]
  lot: LadderLot | undefined
  ratioShown: boolean
  /** The columns the result's cells span when the step has none. */
  resultSpan: number
}

/** One row of the ladder table: a step, or a lot row of it. */
function LadderRow({
  s,
  which,
  ok,
  system,
  value,
  velocity,
  lead,
  lot,
  ratioShown,
  resultSpan,
}: LadderRowProps) {
  const { t } = useTranslation()
  const current = !which && ok && s.n - 1 === ok.selected
  return (
    <tr aria-current={current ? 'true' : undefined} data-lot={which}>
      <td data-label={t('Step')}>
        {s.label === '0' && !which ? `${s.label} ${t('main')}` : s.label}
      </td>
      <td data-label={lead[0]} className="num">
        {value(s)}
      </td>
      {s.seating && (
        <td data-label={lead[1]} className="num">
          {formatQuantity('capacity', system, s.seating.volume)} {system.capacity.symbol}
        </td>
      )}
      {lot && (
        <td data-label={t('Burn rate')} className="num">
          {burnRateLabel(which, lot.fraction, t)}
        </td>
      )}
      <td data-label={t('Flags')}>
        {s.flag || s.error ? flagView(s.flag ?? t('model error')) : t('none')}
      </td>
      {s.body && s.d && s.at ? (
        <LadderResultCells
          step={{ body: s.body, d: s.d, at: s.at }}
          system={system}
          velocity={velocity}
          ratioShown={ratioShown}
          lot={lot}
        />
      ) : (
        <td data-label={t('Result')} colSpan={resultSpan}>
          {t('Not computed: {reason}', {
            reason: s.error ? translateMessage(s.error.message, t) : '',
          })}
        </td>
      )}
    </tr>
  )
}

/** The headings of the ladder table: the lot rows add the burn rate and the barrel time. */
function ladderHeads(
  lead: string[],
  lot: LadderLot | undefined,
  ratioShown: boolean,
  t: Translator['t'],
) {
  return [
    t('Step'),
    ...lead,
    ...(lot ? [t('Burn rate')] : []),
    t('Flags'),
    t('Peak pressure'),
    t('Percent of maximum'),
    t('Muzzle velocity'),
    t('Muzzle energy'),
    ...(ratioShown ? [t('Case fill')] : []),
    ...(lot ? [t('Barrel time')] : []),
    t('Burnt at the muzzle'),
  ]
}

/** The steps of the shown run as a table, one row per charge, with the lot rows under each charge when there are any. */
export function LadderTable({
  ok,
  steps,
  system,
  value,
  velocity,
  lot,
}: {
  ok: Extract<Outcome, { kind: 'ok' }> | undefined
  steps: ShownStep[]
  system: UnitSystem
  /** What a step varies: its charge, its seating length or its powder temperature. */
  value: (s: ShownStep) => string
  velocity: (r: InteriorResponse['result']) => string
  /** The rows at a burn rate above and below, in step order, and the change they were run at. */
  lot?: LadderLot | undefined
}) {
  const { t } = useTranslation()
  // without a load ratio on any step the column would repeat the load ratio readout's phrase
  const ratioShown = steps.some((st) => st.d?.ratio !== undefined)
  // a seating ladder names its length (COAL or CBTO) and shows the case volume behind the bullet
  const seating = ok?.ladder.kind === 'seating'
  const lead = ladderLead(ok, t)
  const columns = ladderHeads(lead, lot, ratioShown, t)
  // the cells before the result's: the step, what it varies, the seating volume, the burn rate and the flags
  const before = 3 + (seating ? 1 : 0) + (lot ? 1 : 0)
  const row = (s: ShownStep, which?: Lot) => (
    <LadderRow
      key={`${s.n}${which ?? ''}`}
      s={s}
      which={which}
      ok={ok}
      system={system}
      value={value}
      velocity={velocity}
      lead={lead}
      lot={lot}
      ratioShown={ratioShown}
      resultSpan={columns.length - before}
    />
  )
  const title = t('{ladder} steps', { ladder: ladderName(ok, t) })
  return (
    <PanelTable label={title} className="limits ladder-table" caption={title} columns={columns}>
      {steps.flatMap((s, i) => [
        ...(lot?.steps.low[i] ? [row(lot.steps.low[i], 'low')] : []),
        row(s),
        ...(lot?.steps.high[i] ? [row(lot.steps.high[i], 'high')] : []),
      ])}
    </PanelTable>
  )
}
