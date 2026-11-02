'use client'

import { Anchor, Badge, Button, Group, NativeSelect, Slider, Text, TextInput } from '@mantine/core'
import type {
  InteriorLoad,
  PowderConfidenceReason,
  PowderFitReason,
  PowderFitResidual,
  PowderParameter,
  PowderPrediction,
} from '@open-reloading/core'
import {
  chronoSession,
  type Firearm,
  type Powder,
  parseRef,
  type SessionRecord,
  type UserPowderFit,
  type UserRecord,
  userRecord,
} from '@open-reloading/schema'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber, parseNumber } from '../i18n/number.ts'
import { type Message as Marked, msg } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { dayText } from '../lib/dates.ts'
import { ladderGuide, temperatureGuide } from '../lib/docs-url.ts'
import { errorText } from '../lib/error-text.ts'
import { fetchManufacturerNames, productLabel } from '../lib/manufacturers.ts'
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
  revolverLeakNote,
  type TuneString,
  tunePowder,
  tuneSessionIds,
} from '../lib/powder-tune.ts'
import { stringStats } from '../lib/string-stats.ts'
import { tunePowderHref } from '../lib/tune-href.ts'
import { readTuneAction, readTuneBase, readTuneLoad, tuneTable } from '../lib/tune-load.ts'
import {
  powdersWithStrings,
  readStringForm,
  type StringForm,
  type StringFormErrors,
  stringResiduals,
} from '../lib/tune-strings.ts'
import { formatQuantity, type Quantity, type UnitSystem, withUnit } from '../lib/units.ts'
import { putRecords, storedRecord, storedRecords } from '../lib/user-store.ts'
import { catalogueIdOf, userRef } from '../lib/variants.ts'
import { offerUndo } from './confirm.tsx'
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
    'Fewer charges than values to fit. Add a string at another charge, or fit the burn coefficient alone.',
  ),
  unresolved: msg(
    'These strings cannot tell one of the values apart from the burn coefficient. Widen the charge spread, add a measured pressure, or fit the burn coefficient alone.',
  ),
  'ill-conditioned': msg(
    'The charges are too close to separate the chosen values. Add a string at a charge well apart, or a measured pressure.',
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
    'The strings cannot separate start pressure and chamber volume from the burn coefficient, so only the burn coefficient is fitted and the others keep their start values. Add a measured pressure to fit more.',
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
          {t('Not a fit. Simulation, not load data.')}
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
  points: msg('A powder record holds at most 40 points, one per charge and powder temperature.'),
  record: msg('The fit does not make a valid powder record. {reason}'),
  store: msg(
    'The browser could not store the powder. {reason} Free browser storage or allow site storage, then save again.',
  ),
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
  const [failed, setFailed] = useState<{ kind: keyof typeof saveFailures; reason: string }>()
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
    const checked = record && userRecord.safeParse(record)
    if (!record || !checked?.success) {
      const issue = checked?.error?.issues[0]
      setFailed({
        kind: (record?.data.fit?.input.length ?? 0) > maxFitPoints ? 'points' : 'record',
        reason: issue ? `${issue.path.join('.')}: ${issue.message}` : '',
      })
      return
    }
    setSaving(true)
    putRecords([record])
      .then(
        () => setSaved(record.name),
        (error) => setFailed({ kind: 'store', reason: errorText(error) }),
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
          {t('Saves the fitted values, not the hand-tuned ones. Type those on the workbench.')}
        </p>
      )}
      {saved && (
        <Message severity="info">
          {t('Saved as {name}. The workbench Powder search lists it.', {
            name: saved,
          })}
        </Message>
      )}
      {failed && (
        <ErrorNote title={t('The powder was not saved.')}>
          {t(saveFailures[failed.kind], { reason: failed.reason })}
        </ErrorNote>
      )}
    </div>
  )
}

/** An offset from the fit in standard uncertainties, signed: "+1.20". */
const offsetText = (z: number) => `${z > 0 ? '+' : z < 0 ? '−' : ''}${formatNumber(Math.abs(z), 2)}`

/**
 * The fit's result: the pressure range's label and its reasons, the fitted values with their
 * intervals, hand tuning, the curve and band with the band's numbers at both ends, and the save.
 * Each is its own element of the page's grid (`.tune-layout`), which sets the chart beside the rest
 * from 64em and after the hand tuning below that.
 */
function FitResult({
  state,
  rows,
  strings,
  save,
  onAnyway,
  revolver = false,
}: {
  state: PowderFitState
  rows: readonly ChargeRow[]
  strings: readonly TuneString[]
  save?: TuneSave | undefined
  onAnyway: () => void
  /** The load may be fired from a revolver and has no leak area (`revolverLeakNote`). */
  revolver?: boolean
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const { fit, range, failure } = state
  const speed = (ms: number) => withUnit('velocity', system, ms)
  const value = (p: PowderParameter, x: number) => {
    const q = parameterNames[p].quantity
    return q ? withUnit(q, system, x) : formatNumber(x, 3)
  }
  // the number alone, for the table whose Unit column names the unit
  const bare = (p: PowderParameter, x: number) => {
    const q = parameterNames[p].quantity
    return q ? formatQuantity(q, system, x) : formatNumber(x, 3)
  }
  const band = fit?.band ?? []
  const first = band[0]
  const ends = [first, band.at(-1)].filter(
    (p, i): p is PowderPrediction => p !== undefined && (i === 0 || band.length > 1),
  )
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
          <p className="fit-label">
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
      {range && range.confidence.reasons.length > 0 && (
        <section className="fit-reasons" aria-labelledby="fit-because">
          <h2 id="fit-because">{t('Because')}</h2>
          <ul>
            {range.confidence.reasons.map((r) => (
              <li key={r}>{t(reasonTexts[r])}</li>
            ))}
          </ul>
        </section>
      )}
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
      {fit && revolver && (
        <Message severity="warning">
          {t(
            'If these strings were shot from a revolver: no leak area is set, so the fitted values take up the gas lost at the cylinder gap, and the simulated pressure can come out too low.',
          )}
        </Message>
      )}
      {fit && (
        <>
          <PanelTable
            label={t('Fitted values')}
            caption={t('Fitted values')}
            className="fitted-values"
            columns={[
              t('Value'),
              t('Unit'),
              { label: t('Start'), num: true },
              { label: t('Fitted'), num: true },
              { label: t('Standard uncertainty'), num: true },
              ...(first
                ? [
                    {
                      label: t('{level} % interval', {
                        level: formatNumber(first.level * 100, 0),
                      }),
                      num: true as const,
                    },
                  ]
                : []),
            ]}
          >
            {fit.fit.parameters.map((p) => {
              const u = p.standardUncertainty
              const q = parameterNames[p.name].quantity
              return (
                <tr key={p.name}>
                  <td>{t(parameterNames[p.name].name)}</td>
                  <td>{q ? system[q].symbol : ''}</td>
                  <td className="num">{bare(p.name, p.initial)}</td>
                  <td className="num">{bare(p.name, p.value)}</td>
                  <td className="num">{u === undefined ? '' : bare(p.name, u)}</td>
                  {first && (
                    <td className="num">
                      {u === undefined
                        ? ''
                        : t('{lower} to {upper}', {
                            lower: bare(p.name, p.value - first.coverageFactor * u),
                            upper: bare(p.name, p.value + first.coverageFactor * u),
                          })}
                    </td>
                  )}
                </tr>
              )
            })}
          </PanelTable>
          <fieldset className="hand-tune">
            <legend>{t('Hand tuning')}</legend>
            {fit.fit.parameters.map((p, k) => {
              const u = p.standardUncertainty
              if (!u) return null
              const id = `hand-${p.name}`
              const z = tuned?.[k] ?? 0
              // no lower end at or below 0: 5 % of the fitted value at least
              const min = Math.max(-3, Math.ceil((-19 * p.value) / u) / 20)
              return (
                <div key={p.name}>
                  <Text component="label" fz="sm" htmlFor={id}>
                    {t('{name}: {value}', {
                      name: t(parameterNames[p.name].name),
                      value: value(p.name, values?.[k] ?? p.value),
                    })}{' '}
                    <span className="hand-offset">
                      {z === 0
                        ? t('at the fit')
                        : t('{offset} standard uncertainties from the fit', {
                            offset: offsetText(z),
                          })}
                    </span>
                  </Text>
                  <Slider
                    id={id}
                    thumbLabel={t(parameterNames[p.name].name)}
                    thumbValueText={(z) => value(p.name, p.value + z * u)}
                    min={min}
                    max={3}
                    step={step}
                    label={null}
                    // ticks at both ends and at the fit; their labels below, as page text
                    marks={[{ value: min }, { value: 0 }, { value: 3 }]}
                    value={z}
                    onChange={(z) =>
                      setHand({
                        id: fit.id,
                        z: fit.fit.parameters.map((_, j) => (j === k ? z : (tuned?.[j] ?? 0))),
                      })
                    }
                  />
                  <div className="hand-range" aria-hidden="true">
                    <span>{value(p.name, p.value + min * u)}</span>
                    {/* near the lower end the fit's label would sit on that end's value */}
                    {-min / (3 - min) >= 0.2 && (
                      <span style={{ insetInlineStart: `${(-min / (3 - min)) * 100}%` }}>
                        {t('Fitted')}
                      </span>
                    )}
                    <span>{value(p.name, p.value + 3 * u)}</span>
                  </div>
                </div>
              )
            })}
            <HandMark strings={strings} tuned={tuned !== undefined} />
            <Button variant="default" disabled={!tuned} onClick={() => setHand(undefined)}>
              {t('Back to the fit')}
            </Button>
          </fieldset>
          <div className="tune-figure">
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
          </div>
          {save && (
            <SaveFit state={state} strings={strings} save={save} tuned={tuned !== undefined} />
          )}
        </>
      )}
    </>
  )
}

/**
 * A row of `TuneStrings`: `fitted`, the table has the fit's columns; `remove`, its Remove button,
 * null for a string not added on the page and undefined where the table has no such column. A
 * plain function, not a component, so `PanelTable` gives its row and cells their roles.
 */
function stringRow(
  {
    key,
    string: s,
    fault,
    residual: r,
    fitted,
    remove,
  }: {
    key: number
    string: TuneString
    fault: boolean
    residual: PowderFitResidual | undefined
    fitted: boolean
    remove: (() => void) | null | undefined
  },
  t: ReturnType<typeof useTranslation>['t'],
  system: UnitSystem,
) {
  const c = system.charge
  const v = system.velocity
  const k = system.temperature
  const speed = (ms: number) => formatNumber(v.fromSi(ms), 1)
  const stats = stringStats(s.shots)
  const charge = formatNumber(c.fromSi(s.charge), c.decimals)
  const sd = stats?.standardDeviation
  return (
    <tr key={key} className={fault ? 'string-fault' : undefined}>
      <td className="num">
        {fault && (
          <Badge variant="light" color="orange" mr="xs">
            {t('Cannot run')}
          </Badge>
        )}
        {charge}
      </td>
      <td className="num">
        {s.temperature === undefined ? '' : formatNumber(k.fromSi(s.temperature), k.decimals)}
      </td>
      <td className="num">{stats?.count ?? 0}</td>
      <td className="num">{stats ? speed(stats.mean) : ''}</td>
      <td className="num">{sd === undefined ? '' : speed(sd)}</td>
      {fitted && <td className="num">{r ? speed(r.predicted) : ''}</td>}
      {fitted && <td className="num">{r ? speed(r.residual) : ''}</td>}
      {remove !== undefined && (
        <td>
          {remove && (
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={remove}
              aria-label={t('Remove the string at {charge} {unit}', { charge, unit: c.symbol })}
            >
              {t('Remove')}
            </Button>
          )}
        </td>
      )}
    </tr>
  )
}

/**
 * The strings, one row each: charge, powder temperature (empty for the load's), shots, mean and SD,
 * and once a fit of them is shown its simulated velocity and residual. `fault`, kg, marks the
 * charge the model cannot run; the strings from `removable` on, those added on the page, have a
 * Remove button.
 */
export function TuneStrings({
  strings,
  fault,
  residuals,
  removable = strings.length,
  onRemove = () => {},
}: {
  strings: readonly TuneString[]
  fault?: number | undefined
  /** The residuals of the fit shown (`PowderFit.residuals`); absent, no Simulated and Residual columns. */
  residuals?: readonly PowderFitResidual[] | undefined
  /** The index of the first string added on the page. */
  removable?: number
  onRemove?: (index: number) => void
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const c = system.charge
  const v = system.velocity
  const k = system.temperature
  const per = stringResiduals(strings, residuals)
  const fitted = per.some((r) => r !== undefined)
  const remove = removable < strings.length
  return (
    <PanelTable
      label={t('Strings')}
      caption={t('Strings')}
      className="tune-strings"
      columns={[
        { label: t('Charge ({unit})', { unit: c.symbol }), num: true },
        { label: t('Temperature ({unit})', { unit: k.symbol }), num: true },
        { label: t('Shots'), num: true },
        { label: t('Mean ({unit})', { unit: v.symbol }), num: true },
        { label: t('SD ({unit})', { unit: v.symbol }), num: true },
        ...(fitted
          ? [
              { label: t('Simulated ({unit})', { unit: v.symbol }), num: true as const },
              { label: t('Residual ({unit})', { unit: v.symbol }), num: true as const },
            ]
          : []),
        ...(remove ? [t('Added here')] : []),
      ]}
    >
      {strings.map((s, i) =>
        stringRow(
          {
            key: i,
            string: s,
            fault: fault !== undefined && Math.abs(s.charge - fault) < 1e-9,
            residual: per[i],
            fitted,
            remove: remove ? (i >= removable ? () => onRemove(i) : null) : undefined,
          },
          t,
          system,
        ),
      )}
    </PanelTable>
  )
}

/** The add form's fields: label, field, then description and error, so the fields line up. */
const wrapperOrder: ('label' | 'input' | 'description' | 'error')[] = [
  'label',
  'input',
  'description',
  'error',
]

/** Why a field of the add form does not read, on the field. */
const formErrors: Record<keyof StringForm, Marked> = {
  charge: msg('A number above 0'),
  shots: msg('One or more numbers above 0, separated by spaces'),
  temperature: msg('A number, or empty'),
}

/**
 * The form that adds a string, under the strings table: charge, shot velocities and powder
 * temperature, each with its error on the field. `oneTemperature`: the note that the temperature
 * factor needs strings at two temperatures or more, beside the temperature field.
 */
export function AddString({
  onAdd,
  oneTemperature = false,
}: {
  onAdd: (s: TuneString) => void
  oneTemperature?: boolean
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const [form, setForm] = useState<StringForm>({ charge: '', shots: '', temperature: '' })
  const [errors, setErrors] = useState<StringFormErrors>({})
  const set = (key: keyof StringForm, text: string) => {
    setForm({ ...form, [key]: text })
    if (errors[key]) setErrors({ ...errors, [key]: undefined })
  }
  const error = (key: keyof StringForm) => (errors[key] ? t(formErrors[key]) : undefined)
  function add() {
    const read = readStringForm(form, {
      charge: system.charge.toSi,
      velocity: system.velocity.toSi,
      temperature: system.temperature.toSi,
    })
    if ('errors' in read) {
      setErrors(read.errors)
      return
    }
    setErrors({})
    onAdd(read.string)
    setForm({ charge: '', shots: '', temperature: '' })
  }
  return (
    <form
      noValidate
      className="tune-add"
      aria-label={t('Add a string')}
      onSubmit={(ev) => {
        ev.preventDefault()
        add()
      }}
    >
      <Group gap="xs" align="start" wrap="wrap">
        <TextInput
          inputWrapperOrder={wrapperOrder}
          label={t('Charge ({unit})', { unit: system.charge.symbol })}
          inputMode="decimal"
          value={form.charge}
          error={error('charge')}
          onChange={(e) => set('charge', e.currentTarget.value)}
          w="8rem"
        />
        <TextInput
          inputWrapperOrder={wrapperOrder}
          label={t('Shot velocities ({unit})', { unit: system.velocity.symbol })}
          description={t('Separated by spaces')}
          value={form.shots}
          error={error('shots')}
          onChange={(e) => set('shots', e.currentTarget.value)}
          style={{ flex: 1, minWidth: '12rem' }}
        />
        <TextInput
          inputWrapperOrder={wrapperOrder}
          label={t('Temperature ({unit})', { unit: system.temperature.symbol })}
          description={t("Empty: the load's")}
          inputMode="decimal"
          value={form.temperature}
          error={error('temperature')}
          onChange={(e) => set('temperature', e.currentTarget.value)}
          w="9rem"
        />
        <Button type="submit" variant="default" className="tune-add-button">
          {t('Add a string')}
        </Button>
      </Group>
      {oneTemperature && (
        <p className="note">
          {t('The temperature factor needs strings at two or more powder temperatures.')}
        </p>
      )}
    </form>
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
  table,
  action,
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
  /** The CIP table of the load's cartridge record the workbench handed over. */
  table?: string | undefined
  /** The action of the firearm the load links, where its record states one. */
  action?: Firearm['action']
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
              'Used above and below the load temperature. Any value above 0 starts the fit, which scales it from the strings.',
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
        <FitResult
          state={fit}
          rows={rows}
          strings={strings}
          save={save}
          onAnyway={onAnyway}
          revolver={revolverLeakNote(table, interior, action)}
        />
      )}
    </>
  )
}

/** The names of the powders `refs`: a user powder's from `records`, a catalogue powder's from its record. */
function usePowderNames(refs: readonly string[], records: readonly UserRecord[]) {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map())
  const key = refs.join(' ')
  useEffect(() => {
    const aborts = new AbortController()
    const wanted = key === '' ? [] : key.split(' ')
    const own = new Map(
      records.flatMap((r) => {
        const ref = userRef(r.id)
        return ref && r.kind === 'powder' ? [[ref, r.name] as const] : []
      }),
    )
    const catalogue = wanted.flatMap((ref) => {
      const id = own.has(ref) ? undefined : catalogueIdOf(ref)
      return id ? [{ ref, id }] : []
    })
    Promise.all([
      catalogue.length > 0 ? fetchManufacturerNames().catch(() => undefined) : undefined,
      Promise.all(
        catalogue.map(({ ref, id }) =>
          fetchRecord<Powder>('powders', id, aborts.signal).then(
            (p) => (p ? ([ref, p] as const) : undefined),
            () => undefined,
          ),
        ),
      ),
    ])
      .then(([makers, found]) => {
        if (aborts.signal.aborted) return
        const out = new Map(own)
        for (const f of found) if (f) out.set(f[0], productLabel(f[1], makers))
        setNames(out)
      })
      // each lookup already falls back to no name: nothing is left to fail
      .catch(() => {})
    return () => aborts.abort()
  }, [key, records])
  return names
}

/**
 * The way in without a load: a powder select over the powders of the saved loads with strings,
 * then the saved loads of the chosen powder, each opened in the workbench, whose Measurements link
 * fits the powder.
 */
function PowderChoice({
  records,
  powder,
  onPowder,
}: {
  records: readonly UserRecord[]
  powder: string | undefined
  onPowder: (powder: string) => void
}) {
  const { t } = useTranslation()
  const refs = useMemo(() => {
    const found = powdersWithStrings(records)
    return powder && !found.includes(powder) ? [powder, ...found] : found
  }, [records, powder])
  const names = usePowderNames(refs, records)
  const choices = powder ? loadsWithPowder(records, powder) : undefined
  return (
    <div className="tune-powder">
      {refs.length > 0 ? (
        <NativeSelect
          label={t('Powder')}
          description={t('From your saved loads with chronograph strings')}
          value={powder ?? ''}
          onChange={(e) => onPowder(e.currentTarget.value)}
          data={[
            ...(powder ? [] : [{ value: '', label: t('Choose a powder') }]),
            ...refs
              .map((r) => ({ value: r, label: names.get(r) ?? r }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          ]}
          maw="24rem"
        />
      ) : (
        <p className="note">{t('No saved load has chronograph strings mapped to charges.')}</p>
      )}
      {choices &&
        (choices.length > 0 ? (
          <nav aria-label={t('Saved loads with this powder')}>
            <p>
              {t(
                'Choose a load; it opens in the workbench, where its Measurements link fits the powder.',
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
          <p className="note">{t('No saved load uses this powder.')}</p>
        ))}
    </div>
  )
}

/**
 * The powder tuning screen: the chronograph strings of the sessions the link names (`?session=`)
 * and those added here, one row each, with the residuals of the fit from the load the workbench
 * handed over for their load. Without sessions it offers the powders of the saved loads with
 * strings (`?powder=` picks one) and lists that powder's saved loads.
 */
export function PowderTune() {
  const { t, tn } = useTranslation()
  const { system } = useUnits()
  const [loaded, setLoaded] = useState<ReturnType<typeof loadStrings>>()
  const [interior, setInterior] = useState<InteriorLoad>()
  const [table, setTable] = useState<string>()
  const [action, setAction] = useState<Firearm['action']>()
  const [save, setSave] = useState<TuneSave>()
  const [records, setRecords] = useState<UserRecord[]>()
  const [powder, setPowder] = useState<string>()
  // the strings added here, each with its number in the order of adding, which Undo restores
  const [added, setAdded] = useState<{ n: number; string: TuneString }[]>([])
  const count = useRef(0)
  const [readFailed, setReadFailed] = useState(false)
  // the powder name lives here, so a new fit, which renders the save anew, keeps it
  const [name, setName] = useState<string>()

  useEffect(() => {
    const ids = tuneSessionIds(window.location.search)
    if (ids.length > 0)
      readSessions(ids)
        .then((s) => {
          const found = loadStrings(s)
          setLoaded(found)
          if (!found.load) return
          setInterior(readTuneLoad(found.load))
          setAction(readTuneAction(found.load))
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
    else {
      setPowder(tunePowder(window.location.search))
      storedRecords()
        .then(({ records }) => setRecords(records))
        .catch(() => setRecords([]))
    }
  }, [])

  // the table handed over, else that of a cartridge record handed over while it was loading
  const load = loaded?.load
  useEffect(() => {
    if (!load) return
    const aborts = new AbortController()
    tuneTable(load, aborts.signal)
      .then((t) => {
        if (!aborts.signal.aborted) setTable(t)
      })
      .catch(() => {})
    return () => aborts.abort()
  }, [load])

  const c = system.charge
  const first = loaded?.strings.length ?? 0
  const strings = useMemo(
    () => [...(loaded?.strings ?? []), ...added.map((a) => a.string)],
    [loaded, added],
  )
  const rows = chargeRows(strings, [])
  const [anyway, setAnyway] = useState(false)
  const [sensitivity, setSensitivity] = useState('')
  const fitLoad = useMemo(() => {
    const typed = parseNumber(sensitivity, { min: 0 })
    return interior && withSensitivity(interior, typed.kind === 'number' ? typed.value : undefined)
  }, [interior, sensitivity])
  const fit = usePowderFit(fitLoad, strings, anyway)
  const ladder = fitStrings(strings)
  const oneTemperature =
    interior !== undefined && ladder.length > 0 && temperatureFit(interior, ladder) === 'one'
  // no load to fit on and no note of TuneNotes that says why: strings typed on a page opened bare
  const noFit = strings.length > 0 && !interior && !(loaded && loaded.strings.length > 0)

  function remove(i: number) {
    const j = i - first
    const gone = added[j]
    if (!gone) return
    setAdded((a) => a.filter((x) => x !== gone))
    offerUndo(
      t('Removed the string at {charge} {unit}.', {
        charge: formatNumber(c.fromSi(gone.string.charge), c.decimals),
        unit: c.symbol,
      }),
      () => setAdded((a) => [...a, gone].sort((x, y) => x.n - y.n)),
    )
  }

  function choose(ref: string) {
    setPowder(ref)
    window.history.replaceState(null, '', tunePowderHref(ref))
  }

  return (
    <>
      <PageBar
        title={msg('Tune a powder')}
        translated
        status={<span role="status">{tn(rows.length, '{count} charge', '{count} charges')}</span>}
        actions={<UnitsIconButton />}
      />
      <div className="sheet powder-tune tune-layout">
        {records && <PowderChoice records={records} powder={powder} onPowder={choose} />}
        {strings.length > 0 ? (
          <TuneStrings
            strings={strings}
            fault={fit.failure?.kind === 'refused' ? fit.failure.charge : undefined}
            residuals={interior ? fit.fit?.fit.residuals : undefined}
            removable={first}
            onRemove={remove}
          />
        ) : (
          <p className="prompt empty-state">
            {t(
              'Add a string, or open this page from the Measurements tab of a load with chronograph strings mapped to charges.',
            )}
          </p>
        )}
        <AddString
          onAdd={(s) => setAdded((a) => [...a, { n: count.current++, string: s }])}
          oneTemperature={oneTemperature}
        />
        {noFit && (
          <p className="note">
            {t("No fit: open this page from a saved load's Measurements tab.")}{' '}
            <Link href="/workbench">{t('Open the workbench')}</Link>
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
          table={table}
          action={action}
        />
        {ladderGuide && temperatureGuide && (
          <p className="note">
            <Anchor href={ladderGuide} target="_blank" rel="noopener">
              {t('How to fire a ladder for the fit')}
            </Anchor>
            {' · '}
            <Anchor href={temperatureGuide} target="_blank" rel="noopener">
              {t('How to measure powder temperature')}
            </Anchor>
          </p>
        )}
        {readFailed && <ErrorNote title={t('The sessions of the link could not be read.')} />}
        <p className="note">{t('All values on this screen are simulations, not load data.')}</p>
      </div>
    </>
  )
}
