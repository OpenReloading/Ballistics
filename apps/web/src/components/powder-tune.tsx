'use client'

import { Badge, Button, Group, Slider, Text, TextInput } from '@mantine/core'
import type {
  InteriorLoad,
  PowderConfidenceReason,
  PowderFitReason,
  PowderParameter,
  PowderPrediction,
} from '@open-reloading/core'
import {
  chronoSession,
  type Powder,
  parseRef,
  type SessionRecord,
  type UserPowderFit,
  userRecord,
} from '@open-reloading/schema'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber, parseNumber } from '../i18n/number.ts'
import { type Message as Marked, msg } from '../i18n/translate.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { dayText } from '../lib/dates.ts'
import { type ChargeRow, chargeRows } from '../lib/measurements.ts'
import { newId } from '../lib/new-id.ts'
import { openOnWorkbench } from '../lib/open-loads.ts'
import { type PowderFitState, temperatureFit, withSensitivity } from '../lib/powder-fit.ts'
import { fitMark } from '../lib/powder-record.ts'
import { fittedPowder, maxFitPoints, refitOf } from '../lib/powder-save.ts'
import {
  fitStrings,
  loadStrings,
  loadsWithPowder,
  parseVelocities,
  type TuneString,
  tunePowder,
  tuneSessionIds,
} from '../lib/powder-tune.ts'
import { readTuneBase, readTuneLoad } from '../lib/tune-load.ts'
import { type Quantity, withUnit } from '../lib/units.ts'
import { putRecords, storedRecord, storedRecords } from '../lib/user-store.ts'
import { userRef } from '../lib/variants.ts'
import { PageBar } from './page-bar.tsx'
import { TuneChart } from './powder-tune-chart.tsx'
import { PanelTable } from './scroll-region.tsx'
import { ErrorNote, Message } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { useHandCurve, usePowderFit } from './use-powder-fit.ts'

/** The stored sessions `ids` that are valid session records, in order; a missing one is left out. */
async function readSessions(ids: string[]) {
  const records = await Promise.all(ids.map((id) => storedRecord(id).catch(() => undefined)))
  return records.filter(
    (r): r is SessionRecord => r?.kind === 'session' && chronoSession.safeParse(r.data).success,
  )
}

const labels = { tight: msg('tight'), moderate: msg('moderate'), loose: msg('loose') }

/** The reasons of `powderConfidence` in plain words. */
export const reasonTexts: Record<PowderConfidenceReason, Marked> = {
  'no-pressure': msg('No measured pressure'),
  'capacity-estimated': msg('Case capacity estimated'),
  'narrow-ladder': msg('Narrow ladder'),
  // a five-row ladder of random noise passes the trend test about 31 % of the time
  'residual-trend': msg('Residuals may show a trend'),
  'start-pressure-correlated': msg('Start pressure tied to the vivacity'),
  'outside-similar-powders': msg('Vivacity far from the similar powders'),
  'weak-prior': msg('Weak prior'),
  extrapolated: msg('Outside the ladder'),
  'input-refit-failed': msg('An input left out of the pressure range'),
}

/** Each refusal of `fitPowder` in plain words: the cause and one action. */
export const refusalTexts: Record<PowderFitReason, Marked> = {
  underdetermined: msg(
    'There are fewer charges than values to fit. Add a string at another charge, or fit the burn coefficient alone.',
  ),
  unresolved: msg(
    'These strings cannot tell one of the values apart from the burn coefficient. Widen the charge spread, add a measured pressure, or fit the burn coefficient alone.',
  ),
  'ill-conditioned': msg(
    'The charges are too close to separate the values you asked for. Add a string at a charge well apart from the others, or add a measured pressure.',
  ),
  invalid: msg(
    'The model cannot run one of the charges. Check the charge of the highlighted string against the case and the bullet.',
  ),
  'not-converged': msg(
    'The fit did not settle. Start from the burn coefficient of a similar powder, or fit fewer values.',
  ),
}

/** Why the burn coefficient was fitted alone although more was asked for. */
const heldTexts = {
  held: msg(
    'These strings cannot tell the start pressure or the chamber volume from the burn coefficient: they move together. They stay at their start values and only the burn coefficient is fitted. Add a measured pressure to fit more.',
  ),
  temperature: msg(
    'These strings cannot tell the temperature factor from the burn coefficient. It stays at 1 and only the burn coefficient is fitted. Add strings at temperatures further apart.',
  ),
}

/** The warning of a fit whose burn coefficient was fitted alone by a hold rule; none for another rule. */
function HeldNote({ rule }: { rule: string | undefined }) {
  const { t } = useTranslation()
  return rule === 'held' || rule === 'temperature' ? (
    <Message severity="warning">{t(heldTexts[rule])}</Message>
  ) : null
}

/** The name and quantity of each fitted parameter; a factor has no unit. */
const parameterNames: Record<PowderParameter, { name: Marked; quantity?: Quantity }> = {
  burnRate: { name: msg('Vivacity'), quantity: 'vivacity' },
  startPressure: { name: msg('Start pressure'), quantity: 'pressure' },
  volumeFactor: { name: msg('Chamber volume factor') },
  energy: { name: msg('Specific energy'), quantity: 'specificEnergy' },
  temperatureFactor: { name: msg('Temperature factor') },
}

/** The band at an end of the drawn range, whole sentences per side so each translates. */
const endTexts = {
  below: msg(
    'Unfired {charge} (below the ladder): {velocity}, {level} % interval {lower} to {upper}',
  ),
  inside: msg(
    'Unfired {charge} (inside the ladder): {velocity}, {level} % interval {lower} to {upper}',
  ),
  above: msg(
    'Unfired {charge} (above the ladder): {velocity}, {level} % interval {lower} to {upper}',
  ),
}

/** Slider step, standard uncertainties; each slider spans 3 of them either side of the fit. */
const step = 0.05

/** The mark of the values shown: fitted to the strings today, or hand-tuned with its line. */
function HandMark({ strings, tuned }: { strings: readonly TuneString[]; tuned: boolean }) {
  const { t, tn } = useTranslation()
  const count = fitStrings(strings).length
  return (
    <>
      <p className="note fit-mark">
        {fitMark(count, new Date().toISOString(), tuned, dayText, { t, tn })}
      </p>
      {tuned && (
        <p className="note">
          <Badge variant="light" mr="xs">
            {t('Hand-tuned')}
          </Badge>
          {t('Hand-tuned values are yours, not a fit. Simulation, not load data.')}
        </p>
      )}
    </>
  )
}

/** What "Save as a powder" needs besides the fit: the stored sessions of the strings and the run's powder record. */
interface TuneSave {
  sessions: readonly string[]
  base?: Powder | undefined
  /** The stored fit of the base, a user powder saved from this screen: the save is then a refit. */
  baseFit?: UserPowderFit | undefined
  /** The name typed for the powder, kept across fits; absent, a default from the base. */
  name?: string | undefined
  onName?: ((name: string) => void) | undefined
}

/** Why a save failed: too many points for a record, no valid record, or the write. */
export const saveFailures = {
  points: msg('A powder record holds at most 40 points of one charge and temperature.'),
  record: msg('The fit does not make a valid powder record.'),
  store: msg('The fit cannot be stored as a powder record in this browser.'),
}

/**
 * Saves the fit as a user powder: always the fitted values, so the record is the fit, and a
 * line says so while sliders are off the fit.
 */
function SaveFit({
  state,
  strings,
  save,
  tuned,
}: {
  state: PowderFitState
  strings: readonly TuneString[]
  save: TuneSave
  tuned: boolean
}) {
  const { t } = useTranslation()
  // a fitted user powder is refitted as a new record, so the loads on the old one run as before
  const refit = refitOf(save.base, save.baseFit, t)
  const name =
    save.name ??
    refit?.name ??
    (save.base ? t('{name}, fitted', { name: save.base.name }) : t('Fitted powder'))
  const [saved, setSaved] = useState<string>()
  const [failed, setFailed] = useState<keyof typeof saveFailures>()
  const [saving, setSaving] = useState(false)
  const fit = state.fit?.fit
  const confidence = state.range?.confidence
  function store() {
    if (!fit || !confidence) return
    const record = fittedPowder({
      fit,
      confidence,
      strings,
      base: save.base,
      sessions: save.sessions,
      id: newId(),
      name: name.trim() || t('Fitted powder'),
      date: new Date(),
      previous: refit?.previous,
    })
    setSaved(undefined)
    setFailed(undefined)
    if (!record || !userRecord.safeParse(record).success) {
      setFailed((record?.data.fit?.input.length ?? 0) > maxFitPoints ? 'points' : 'record')
      return
    }
    setSaving(true)
    putRecords([record])
      .then(
        () => setSaved(record.name),
        () => setFailed('store'),
      )
      .finally(() => setSaving(false))
  }
  return (
    <div className="powder-save">
      <Group gap="xs" align="end" wrap="wrap" my="xs">
        <TextInput
          label={t('Powder name')}
          value={name}
          onChange={(e) => save.onName?.(e.currentTarget.value)}
          maxLength={200}
          style={{ flex: 1, minWidth: '12rem' }}
        />
        <Button variant="default" disabled={!confidence || state.running || saving} onClick={store}>
          {t('Save as a powder')}
        </Button>
      </Group>
      {tuned && (
        <p className="note">
          {t(
            'Saves the fitted values. Hand-tuned values are not saved: type them on the workbench, where they are marked hand-tuned.',
          )}
        </p>
      )}
      {saved && (
        <Message severity="info">
          {t('Saved as {name}. The Powder search of the workbench lists it as your design.', {
            name: saved,
          })}
        </Message>
      )}
      {failed && (
        <ErrorNote title={t('The powder was not saved.')}>{t(saveFailures[failed])}</ErrorNote>
      )}
    </div>
  )
}

/**
 * The fit's result: fitted values with their intervals, the residual per string, the curve and
 * band with the band's numbers at both ends, then the pressure range's label and its reasons.
 */
function FitResult({
  state,
  rows,
  strings,
  save,
  onAnyway,
}: {
  state: PowderFitState
  rows: readonly ChargeRow[]
  strings: readonly TuneString[]
  save?: TuneSave | undefined
  onAnyway: () => void
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const { fit, range, failure } = state
  const c = system.charge
  const v = system.velocity
  const speed = (ms: number) => withUnit('velocity', system, ms)
  const value = (p: PowderParameter, x: number) => {
    const q = parameterNames[p].quantity
    return q ? withUnit(q, system, x) : formatNumber(x, 3)
  }
  const band = fit?.band ?? []
  const first = band[0]
  const ends = [first, band.at(-1)].filter(
    (p, i): p is PowderPrediction => p !== undefined && (i === 0 || band.length > 1),
  )
  const residuals = (fit?.fit.residuals ?? [])
    .filter((r) => r.kind === 'velocity')
    .sort((a, b) => a.charge - b.charge)
  // the offsets from the fit, standard uncertainties per fitted value, of the fit answer `id`
  const [hand, setHand] = useState<{ id: number; z: number[] }>()
  const tuned = fit && hand?.id === fit.id ? hand.z : undefined
  const values = useMemo(
    () =>
      tuned &&
      fit?.fit.parameters.map((p, k) => p.value + (tuned[k] ?? 0) * (p.standardUncertainty ?? 0)),
    [fit, tuned],
  )
  const handQuery = useMemo(
    () =>
      fit && values
        ? {
            fit: { load: fit.fit.load, parameters: fit.fit.parameters },
            values,
            charges: fit.band.map((p) => p.charge),
          }
        : undefined,
    [fit, values],
  )
  const curve = useHandCurve(handQuery)
  return (
    <>
      <div role="status" className="powder-fit-state">
        {range && (
          <p>
            {t('Pressure range: {label}, plus and minus {percent} %', {
              label: t(labels[range.confidence.label]),
              percent: formatNumber(range.range.relativeHalfWidth * 100, 1),
            })}
          </p>
        )}
        {state.running && <p>{fit ? t('Working out the pressure range') : t('Fitting')}</p>}
        {failure && (
          <Message severity="warning">
            {failure.kind === 'refused'
              ? t(refusalTexts[failure.reason])
              : translateMessage(failure.message, t)}
          </Message>
        )}
      </div>
      {fit?.rule === 'thin' && (
        <Message severity="warning">
          {t(
            'Fewer than 3 charges, or charges less than 10 % apart: only the burn coefficient is fitted, the other values stay at those of the similar powder.',
          )}{' '}
          <Button variant="default" size="compact-sm" onClick={onAnyway}>
            {t('Try the other values anyway')}
          </Button>
        </Message>
      )}
      <HeldNote rule={fit?.rule} />
      {range && range.confidence.reasons.length > 0 && (
        <ul className="fit-reasons" aria-label={t('Reasons for the label')}>
          {range.confidence.reasons.map((r) => (
            <li key={r}>{t(reasonTexts[r])}</li>
          ))}
        </ul>
      )}
      {fit && (
        <>
          <PanelTable
            label={t('Fitted values')}
            caption={t('Fitted values')}
            columns={[
              t('Value'),
              t('Start'),
              t('Fitted'),
              t('Standard uncertainty'),
              ...(first
                ? [t('{level} % interval', { level: formatNumber(first.level * 100, 0) })]
                : []),
            ]}
          >
            {fit.fit.parameters.map((p) => {
              const u = p.standardUncertainty
              return (
                <tr key={p.name}>
                  <td>{t(parameterNames[p.name].name)}</td>
                  <td className="num">{value(p.name, p.initial)}</td>
                  <td className="num">{value(p.name, p.value)}</td>
                  <td className="num">{u === undefined ? '' : value(p.name, u)}</td>
                  {first && (
                    <td className="num">
                      {u === undefined
                        ? ''
                        : t('{lower} to {upper}', {
                            lower: value(p.name, p.value - first.coverageFactor * u),
                            upper: value(p.name, p.value + first.coverageFactor * u),
                          })}
                    </td>
                  )}
                </tr>
              )
            })}
          </PanelTable>
          <PanelTable
            label={t('Residual per charge')}
            caption={t('Residual per charge')}
            columns={[
              t('Charge ({unit})', { unit: c.symbol }),
              t('Mean ({unit})', { unit: v.symbol }),
              t('Simulated ({unit})', { unit: v.symbol }),
              t('Residual ({unit})', { unit: v.symbol }),
            ]}
          >
            {residuals.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two strings may share a charge
              <tr key={i}>
                <td className="num">{formatNumber(c.fromSi(r.charge), c.decimals)}</td>
                <td className="num">{formatNumber(v.fromSi(r.observed), 1)}</td>
                <td className="num">{formatNumber(v.fromSi(r.predicted), 1)}</td>
                <td className="num">{formatNumber(v.fromSi(r.residual), 1)}</td>
              </tr>
            ))}
          </PanelTable>
          <fieldset className="hand-tune">
            <legend>{t('Hand tuning')}</legend>
            {fit.fit.parameters.map((p, k) => {
              const u = p.standardUncertainty
              if (!u) return null
              const id = `hand-${p.name}`
              return (
                <div key={p.name}>
                  <Text component="label" fz="sm" htmlFor={id}>
                    {t('{name}: {value}', {
                      name: t(parameterNames[p.name].name),
                      value: value(p.name, values?.[k] ?? p.value),
                    })}
                  </Text>
                  <Slider
                    id={id}
                    thumbLabel={t(parameterNames[p.name].name)}
                    thumbValueText={(z) => value(p.name, p.value + z * u)}
                    // no lower end at or below 0: 5 % of the fitted value at least
                    min={Math.max(-3, Math.ceil((-19 * p.value) / u) / 20)}
                    max={3}
                    step={step}
                    label={null}
                    value={tuned?.[k] ?? 0}
                    onChange={(z) =>
                      setHand({
                        id: fit.id,
                        z: fit.fit.parameters.map((_, j) => (j === k ? z : (tuned?.[j] ?? 0))),
                      })
                    }
                  />
                </div>
              )
            })}
            <HandMark strings={strings} tuned={tuned !== undefined} />
            <Button variant="default" disabled={!tuned} onClick={() => setHand(undefined)}>
              {t('Back to the fit')}
            </Button>
          </fieldset>
          {save && (
            <SaveFit state={state} strings={strings} save={save} tuned={tuned !== undefined} />
          )}
          <TuneChart
            band={band}
            curve={curve}
            ladder={fit.fit.chargeRange}
            rows={rows}
            system={system}
          />
          {ends.map((p) => (
            <p key={p.charge} className="note band-end">
              {t(endTexts[p.extrapolation?.charge ?? 'inside'], {
                charge: withUnit('charge', system, p.charge),
                velocity: speed(p.velocity.value),
                level: formatNumber(p.level * 100, 0),
                lower: speed(p.velocity.lower),
                upper: speed(p.velocity.upper),
              })}
            </p>
          ))}
          <p className="note">
            {t(
              'Band: uncertainty of the fitted parameters only, not model error. Simulation, not load data.',
            )}
          </p>
        </>
      )}
    </>
  )
}

/** The strings per charge with mean, SD and shot count; `fault`, kg, marks the charge the model cannot run. */
export function TuneStrings({
  rows,
  fault,
}: {
  rows: readonly ChargeRow[]
  fault?: number | undefined
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const c = system.charge
  const v = system.velocity
  const speed = (ms: number) => formatNumber(v.fromSi(ms), 1)
  return (
    <PanelTable
      label={t('Strings per charge')}
      caption={t('Strings per charge')}
      columns={[
        t('Charge ({unit})', { unit: c.symbol }),
        t('Shots'),
        t('Mean ({unit})', { unit: v.symbol }),
        t('SD ({unit})', { unit: v.symbol }),
      ]}
    >
      {rows.map((r) => (
        <tr key={r.charge} className={r.charge === fault ? 'string-fault' : undefined}>
          <td className="num">
            {r.charge === fault && (
              <Badge variant="light" color="orange" mr="xs">
                {t('Cannot run')}
              </Badge>
            )}
            {formatNumber(c.fromSi(r.charge), c.decimals)}
          </td>
          <td className="num">{r.velocityStats?.count ?? 0}</td>
          <td className="num">{r.velocityStats ? speed(r.velocityStats.mean) : ''}</td>
          <td className="num">
            {r.velocityStats?.standardDeviation === undefined
              ? ''
              : speed(r.velocityStats.standardDeviation)}
          </td>
        </tr>
      ))}
    </PanelTable>
  )
}

/**
 * What the screen says of the load the strings name: save it first, open it on the workbench when
 * no load was handed over, the strings of another load left out, and the fit once it runs.
 */
export function TuneNotes({
  loaded,
  interior,
  fit,
  rows = [],
  strings = [],
  save,
  onAnyway = () => {},
  sensitivity = '',
  onSensitivity = () => {},
}: {
  loaded: ReturnType<typeof loadStrings> | undefined
  /** The load the workbench handed over, before a sensitivity typed here. */
  interior: InteriorLoad | undefined
  fit: PowderFitState
  /** The strings per charge, the measured points of the chart. */
  rows?: readonly ChargeRow[]
  /** The strings of the fit. */
  strings?: readonly TuneString[]
  /** What saving the fit as a powder needs; absent, no save is offered. */
  save?: TuneSave | undefined
  /** Asks for the values left out by the thin rule. */
  onAnyway?: () => void
  /** The temperature sensitivity typed for a load without one, 1/K. */
  sensitivity?: string
  onSensitivity?: (text: string) => void
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const c = system.charge
  const loadId = loaded?.load && parseRef(loaded.load)?.id
  const ladder = fitStrings(strings)
  const temperature = interior && ladder.length > 0 ? temperatureFit(interior, ladder) : undefined
  return (
    <>
      {loaded && loaded.strings.length > 0 && !loaded.load && (
        <p className="note">{t('Save the load to fit a powder from its strings.')}</p>
      )}
      {loadId && !interior && (
        <p className="note">
          <Link href="/workbench" onClick={() => openOnWorkbench(loadId)}>
            {t('Open this load in the workbench and follow its Measurements link to fit a powder.')}
          </Link>
        </p>
      )}
      {loaded && loaded.left.length > 0 && (
        <p className="note">
          {t('Left out, the strings of another load at {charges} {unit}', {
            charges: loaded.left
              .map((s) => formatNumber(c.fromSi(s.charge), c.decimals))
              .join(', '),
            unit: c.symbol,
          })}
        </p>
      )}
      {temperature === 'one' && (
        <p className="note">
          {t('The temperature factor needs strings at two or more powder temperatures.')}
        </p>
      )}
      {temperature === 'sensitivity' && (
        <>
          <Message severity="warning">
            {t(
              'The strings are at two or more powder temperatures, but the powder has no temperature sensitivity. Give it one to fit the temperature factor.',
            )}
          </Message>
          <TextInput
            label={t('Temperature sensitivity (1/K)')}
            description={t(
              'Above and below the load temperature. The fit scales it from the strings, so any value above 0 starts it.',
            )}
            inputMode="decimal"
            value={sensitivity}
            onChange={(e) => onSensitivity(e.currentTarget.value)}
            maw="24rem"
            my="xs"
          />
        </>
      )}
      {interior && (
        <FitResult state={fit} rows={rows} strings={strings} save={save} onAnyway={onAnyway} />
      )}
    </>
  )
}

/**
 * The powder tuning screen: the chronograph strings of the sessions the link names (`?session=`)
 * and those added here, with mean, SD and shot count per charge, and the fit from the load the
 * workbench handed over for their load. Opened for a powder (`?powder=`), it lists the saved loads
 * that use it.
 */
export function PowderTune() {
  const { t, tn } = useTranslation()
  const { system } = useUnits()
  const [loaded, setLoaded] = useState<ReturnType<typeof loadStrings>>()
  const [interior, setInterior] = useState<InteriorLoad>()
  const [save, setSave] = useState<TuneSave>()
  const [choices, setChoices] = useState<{ id: string; name: string }[]>()
  const [added, setAdded] = useState<TuneString[]>([])
  const [form, setForm] = useState({ charge: '', shots: '', temperature: '' })
  const [error, setError] = useState(false)
  const [readFailed, setReadFailed] = useState(false)
  // the powder name lives here, so a new fit, which renders the save anew, keeps it
  const [name, setName] = useState<string>()

  useEffect(() => {
    const ids = tuneSessionIds(window.location.search)
    const powder = tunePowder(window.location.search)
    if (ids.length > 0)
      readSessions(ids)
        .then((s) => {
          const found = loadStrings(s)
          setLoaded(found)
          if (!found.load) return
          setInterior(readTuneLoad(found.load))
          const own = s.filter((r) => r.data.strings.some((str) => str.load === found.load))
          const base = readTuneBase(found.load)
          const sessions = own.map((r) => r.id)
          // a user powder's stored fit makes the save a refit
          const stored = base && userRef(base.id) ? storedRecord(base.id) : Promise.resolve()
          stored
            .then((raw) => {
              const r = userRecord.safeParse(raw)
              const baseFit = r.success && r.data.kind === 'powder' ? r.data.data.fit : undefined
              setSave({ sessions, base, baseFit })
            })
            .catch(() => setSave({ sessions, base }))
        })
        .catch(() => setReadFailed(true))
    else if (powder)
      storedRecords()
        .then(({ records }) => setChoices(loadsWithPowder(records, powder)))
        .catch(() => setChoices([]))
  }, [])

  const c = system.charge
  const v = system.velocity
  const strings = useMemo(() => [...(loaded?.strings ?? []), ...added], [loaded, added])
  const rows = chargeRows(strings, [])
  const [anyway, setAnyway] = useState(false)
  const [sensitivity, setSensitivity] = useState('')
  const fitLoad = useMemo(() => {
    const typed = parseNumber(sensitivity, { min: 0 })
    return interior && withSensitivity(interior, typed.kind === 'number' ? typed.value : undefined)
  }, [interior, sensitivity])
  const fit = usePowderFit(fitLoad, strings, anyway)

  function add() {
    const charge = parseNumber(form.charge, { min: 0 })
    const shots = parseVelocities(form.shots, v.toSi)
    const temperature = parseNumber(form.temperature)
    if (
      charge.kind !== 'number' ||
      !(charge.value > 0) ||
      !shots ||
      (temperature.kind !== 'number' && temperature.kind !== 'empty')
    ) {
      setError(true)
      return
    }
    setError(false)
    setAdded((a) => [
      ...a,
      {
        charge: c.toSi(charge.value),
        shots: shots.map((value) => ({ velocity: { value } })),
        ...(temperature.kind === 'number' && {
          temperature: system.temperature.toSi(temperature.value),
        }),
      },
    ])
    setForm({ charge: '', shots: '', temperature: '' })
  }

  return (
    <>
      <PageBar
        title={msg('Tune a powder')}
        translated
        status={<span role="status">{tn(rows.length, '{count} charge', '{count} charges')}</span>}
        actions={<UnitsIconButton />}
      />
      <div className="sheet powder-tune">
        {rows.length > 0 ? (
          <TuneStrings
            rows={rows}
            fault={fit.failure?.kind === 'refused' ? fit.failure.charge : undefined}
          />
        ) : (
          <p className="prompt empty-state">
            {t(
              'Add a string, or open this page from the Measurements tab of a load with chronograph strings mapped to charges.',
            )}
          </p>
        )}
        <TuneNotes
          loaded={loaded}
          interior={interior}
          fit={fit}
          rows={rows}
          strings={strings}
          save={save && { ...save, name, onName: setName }}
          onAnyway={() => setAnyway(true)}
          sensitivity={sensitivity}
          onSensitivity={setSensitivity}
        />
        {choices &&
          (choices.length > 0 ? (
            <nav aria-label={t('Saved loads with this powder')}>
              <p>
                {t(
                  'Choose a saved load with strings of this powder. It opens in the workbench, where its Measurements link fits the powder.',
                )}
              </p>
              <ul>
                {choices.map((l) => (
                  <li key={l.id}>
                    <Link href="/workbench" onClick={() => openOnWorkbench(l.id)}>
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : (
            <p className="note">
              {t(
                "No saved load uses this powder. Open a saved load's Measurements tab to fit a powder from its strings.",
              )}
            </p>
          ))}
        <form
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault()
            add()
          }}
        >
          <Group gap="xs" align="end" wrap="wrap" my="xs">
            <TextInput
              label={t('Charge ({unit})', { unit: c.symbol })}
              inputMode="decimal"
              value={form.charge}
              onChange={(e) => setForm({ ...form, charge: e.currentTarget.value })}
              w="8rem"
            />
            <TextInput
              label={t('Shot velocities ({unit})', { unit: v.symbol })}
              description={t('Separated by spaces')}
              value={form.shots}
              onChange={(e) => setForm({ ...form, shots: e.currentTarget.value })}
              style={{ flex: 1, minWidth: '12rem' }}
            />
            <TextInput
              label={t('Powder temperature ({unit})', { unit: system.temperature.symbol })}
              description={t("Empty: the load's")}
              inputMode="decimal"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.currentTarget.value })}
              w="9rem"
            />
            <Button type="submit" variant="default">
              {t('Add a string')}
            </Button>
          </Group>
        </form>
        {readFailed && <ErrorNote title={t('The sessions of the link could not be read.')} />}
        {error && (
          <ErrorNote title={t('The string was not added.')}>
            {t(
              'Enter a charge and at least one shot velocity, each a positive number, and a temperature or none.',
            )}
          </ErrorNote>
        )}
        <p className="note">{t('All values on this screen are simulations, not load data.')}</p>
      </div>
    </>
  )
}
