/** The truing section of the Trajectory tab: rows as typed, the core plan and fit, and their readouts. */
import {
  fitTruingStrings,
  planTruingStrings,
  type RangeStringEntry,
  type RangeStringFit,
  type RangeStringParameter,
  type RangeStringParameterName,
  type TrajectoryInput,
  TruingError,
  type TruingPlan,
  type WeakReason,
} from '@open-reloading/core'
import { type Truing, toSi, truing, type UserRecord, userRecord } from '@open-reloading/schema'
import { formatNumber, parseNumber, untranslated } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { translateMessage } from './core-messages.ts'
import { localDay } from './dates.ts'
import { errorText } from './error-text.ts'
import { storedOf } from './firearm.ts'
import { type UnitSystem, withUnit } from './units.ts'

/** One distance as typed: the texts are in the units the section shows (`system`), dial means in clicks. */
export type TruingRow = {
  kind: 'impact' | 'dial'
  range: string
  shots: string
  /** Mean over the shots: height above the line of sight (impact), clicks (dial). */
  mean: string
  /** Standard deviation of one shot, in the unit of `mean`. */
  deviation: string
}

/** Muzzle velocity readings as typed. */
export type TruingChrono = { shots: string; mean: string; deviation: string }

/** Everything the plan and the fit read besides the nominal shot. */
export type TruingInputs = {
  rows: readonly TruingRow[]
  chrono: TruingChrono
  /** Nominal click value, in the correction unit. */
  click: string
  /** Standard deviation of one shot's vertical angle, in the correction unit (plan only). */
  dispersion: string
  fitZeroOffset: boolean
  system: UnitSystem
}

export const blankRow = (kind: TruingRow['kind'] = 'impact'): TruingRow => ({
  kind,
  range: '',
  shots: '',
  mean: '',
  deviation: '',
})

export const blankChrono: TruingChrono = { shots: '', mean: '', deviation: '' }

/** The number typed in `text` (either decimal mark); undefined while empty, ambiguous or no number. */
function numberOf(text: string): number | undefined {
  const p = parseNumber(text)
  return p.kind === 'number' ? p.value : undefined
}

/** A whole number of at least 1, else undefined. */
const shotsOf = (text: string) => {
  const x = numberOf(text)
  return x !== undefined && Number.isInteger(x) && x >= 1 ? x : undefined
}

type T = Translator['t']

/** A row's number and where it stands in the message when it is missing. */
function need(x: number | undefined, what: string, t: T, positive = false): number {
  if (x === undefined) throw new RangeError(t('{what}: enter a number.', { what }))
  if (positive && !(x > 0)) throw new RangeError(t('{what}: must be greater than 0.', { what }))
  return x
}

/** The message of a failed plan or fit in the language of `t`. */
function problemOf(e: unknown, t: T): string {
  if (e instanceof TruingError) {
    const reason = translateMessage(e.reason, t)
    if (reason !== e.reason) return reason
  }
  return translateMessage(errorText(e), t)
}

/** The rows that carry anything, with their position; a blank trailing row is not an error. */
const filled = (rows: readonly TruingRow[]) =>
  rows.flatMap((r, i) => (r.range || r.shots || r.mean || r.deviation ? [{ r, i }] : []))

/** Planned entries (no measured values) and the chronograph that has shots and a deviation, SI. */
function planned(input: TruingInputs, t: T) {
  const { system: s } = input
  const entries = filled(input.rows).map(({ r, i }) => ({
    kind: r.kind,
    range: s.range.toSi(need(numberOf(r.range), t('Row {n} distance', { n: i + 1 }), t, true)),
    shotCount: need(shotsOf(r.shots), t('Row {n} shots', { n: i + 1 }), t),
  }))
  const { shots, deviation } = input.chrono
  const chronograph =
    shots || deviation
      ? {
          shotCount: need(shotsOf(shots), t('Chronograph shots'), t),
          standardDeviation: s.velocity.toSi(
            need(numberOf(deviation), t('Chronograph deviation'), t, true),
          ),
        }
      : undefined
  return { entries, chronograph }
}

const clickOf = (input: TruingInputs, t: T) =>
  input.system.correction.toSi(need(numberOf(input.click), t('Click value'), t, true))

/** Why the plan or the fit has no answer (its text in the language of the `t` it was made with), or the answer. */
export type Attempt<T> = { answer: T } | { problem: string }

/**
 * The statuses and standard errors of the planned string: the rows' kinds, distances and shots, the
 * chronograph's shots and deviation, and the dispersion of one shot.
 */
export function planSession(shot: TrajectoryInput, input: TruingInputs, t: T): Attempt<TruingPlan> {
  try {
    const { entries, chronograph } = planned(input, t)
    const dispersion = input.system.correction.toSi(
      need(numberOf(input.dispersion), t('Dispersion of one shot'), t, true),
    )
    const plan = planTruingStrings(
      {
        shot,
        clickValue: clickOf(input, t),
        dispersion,
        entries,
        ...(chronograph && { chronograph }),
      },
      { fitZeroOffset: input.fitZeroOffset },
    )
    return { answer: plan }
  } catch (e) {
    return { problem: problemOf(e, t) }
  }
}

/** The measured rows and chronograph readings, SI, as the fit takes them. */
function measured(input: TruingInputs, t: T) {
  const { system: s } = input
  const entries = filled(input.rows).map(({ r, i }): RangeStringEntry => {
    // an impact is a length, a dial is in clicks
    const toSi = (x: number) => (r.kind === 'impact' ? s.lineOfSightOffset.toSi(x) : x)
    return {
      kind: r.kind,
      range: s.range.toSi(need(numberOf(r.range), t('Row {n} distance', { n: i + 1 }), t, true)),
      shotCount: need(shotsOf(r.shots), t('Row {n} shots', { n: i + 1 }), t),
      value: toSi(need(numberOf(r.mean), t('Row {n} mean', { n: i + 1 }), t)),
      standardDeviation: toSi(
        need(numberOf(r.deviation), t('Row {n} deviation', { n: i + 1 }), t, true),
      ),
    }
  })
  const c = input.chrono
  const chronograph =
    c.shots || c.mean || c.deviation
      ? {
          shotCount: need(shotsOf(c.shots), t('Chronograph shots'), t),
          mean: s.velocity.toSi(need(numberOf(c.mean), t('Chronograph mean'), t, true)),
          standardDeviation: s.velocity.toSi(
            need(numberOf(c.deviation), t('Chronograph deviation'), t, true),
          ),
        }
      : undefined
  return { clickValue: clickOf(input, t), entries, ...(chronograph && { chronograph }) }
}

/** The fit of the measured rows and chronograph readings. */
export function fitSession(
  shot: TrajectoryInput,
  input: TruingInputs,
  t: T,
): Attempt<RangeStringFit> {
  try {
    return {
      answer: fitTruingStrings(
        { shot, ...measured(input, t) },
        { fitZeroOffset: input.fitZeroOffset },
      ),
    }
  } catch (e) {
    return { problem: problemOf(e, t) }
  }
}

/** A parameter value, SI, in the stored unit of its kind. */
function storedParameter(name: RangeStringParameterName, si: number) {
  if (name === 'dragFactor') return si
  return storedOf(name === 'muzzleVelocity' ? 'velocity' : 'angle', si)
}

/** The stored truing schema's limits: rows of one result, results of one configuration. */
export const truingLimits = { rows: 50, results: 100 }

/**
 * Why a fit was not stored: the firearm or its configuration is gone, the configuration holds
 * `truingLimits.results` results, or the strings have more than `truingLimits.rows` rows.
 */
export type StoreRefusal = 'missing' | 'full' | 'rows'

/**
 * The truing result as a firearm configuration stores it: the strings as entered, the nominal
 * shot and the fitted parameters, in stored units. Only an identified parameter keeps its value
 * and interval. `input` is the one the fit was made from. 'rows' when there are more rows than
 * a result keeps.
 */
export function truingEntry(
  nominal: { shot: TrajectoryInput; bullet: string; zeroRange: number },
  input: TruingInputs,
  fit: RangeStringFit,
  date: Date,
): Truing | 'rows' {
  const { clickValue, entries, chronograph } = measured(input, untranslated())
  if (entries.length > truingLimits.rows) return 'rows'
  const { shot } = nominal
  const length = (x: number) => storedOf('length', x)
  return truing.parse({
    date: localDay(date),
    bullet: nominal.bullet,
    muzzleVelocity: storedOf('velocity', shot.muzzleVelocity),
    zeroRange: length(nominal.zeroRange),
    temperature: storedOf('temperature', shot.air.temperature),
    pressure: storedOf('pressure', shot.air.pressure),
    humidity: storedOf('relativeHumidity', shot.air.humidity),
    clickValue: storedOf('angle', clickValue),
    fitZeroOffset: input.fitZeroOffset,
    rows: entries.map((e) =>
      e.kind === 'impact'
        ? {
            kind: e.kind,
            range: length(e.range),
            shots: e.shotCount,
            mean: length(e.value),
            deviation: length(e.standardDeviation),
          }
        : {
            kind: e.kind,
            range: length(e.range),
            shots: e.shotCount,
            mean: e.value,
            deviation: e.standardDeviation,
          },
    ),
    ...(chronograph && {
      chronograph: {
        shots: chronograph.shotCount,
        mean: storedOf('velocity', chronograph.mean),
        deviation: storedOf('velocity', chronograph.standardDeviation),
      },
    }),
    parameters: fit.parameters.map((p) => {
      const known = p.status === 'identified'
      return {
        name: p.name,
        status: p.status,
        reasons: p.reasons,
        ...(known && p.value !== undefined && { value: storedParameter(p.name, p.value) }),
        ...(known &&
          p.interval && {
            lower: storedParameter(p.name, p.interval.lower),
            upper: storedParameter(p.name, p.interval.upper),
            confidenceLevel: p.interval.confidenceLevel,
          }),
      }
    }),
    ...(fit.consistent !== undefined && { consistent: fit.consistent }),
    intervalsTrusted: fit.intervalsTrusted,
  })
}

/**
 * The firearm record with `entry` appended to configuration `config`, saved at `now`; 'missing'
 * when `stored` is no valid firearm with that configuration, 'full' when the configuration holds
 * as many results as it keeps.
 */
export function withTruing(
  stored: unknown,
  config: string,
  entry: Truing,
  now: Date,
): UserRecord | Exclude<StoreRefusal, 'rows'> {
  const found = userRecord.safeParse(stored)
  if (!found.success || found.data.kind !== 'firearm') return 'missing'
  const f = found.data.data
  const target = f.configurations.find((c) => c.id === config)
  if (!target) return 'missing'
  if ((target.truing?.length ?? 0) >= truingLimits.results) return 'full'
  return userRecord.parse({
    ...found.data,
    saved: now.toISOString(),
    data: {
      ...f,
      configurations: f.configurations.map((c) =>
        c.id === config ? { ...c, truing: [...(c.truing ?? []), entry] } : c,
      ),
    },
  })
}

/** The parameter names as table row headings and, in lower case, inside a sentence. */
export const parameterLabels: Record<
  RangeStringParameterName,
  { label: Message; inline: Message }
> = {
  muzzleVelocity: { label: msg('Muzzle velocity'), inline: msg('muzzle velocity') },
  dragFactor: { label: msg('Drag factor'), inline: msg('drag factor') },
  clickValue: { label: msg('Click value'), inline: msg('click value') },
  zeroOffset: { label: msg('Zero offset'), inline: msg('zero offset') },
}

const reasonText: Record<WeakReason, Message> = {
  'no-information': msg('the data does not move it'),
  collinear: msg('the data cannot tell it from another parameter'),
  imprecise: msg('too imprecise'),
  'fit-failed': msg('the fit failed'),
}

/** One parameter as shown: a value and an interval only when it is identified. */
export type ParameterLine = {
  name: RangeStringParameterName
  label: string
  status: RangeStringParameter['status']
  /** "Identified", "Weak: ..." or "Unresolved: ...". */
  statusText: string
  /** Fitted value with its unit; absent unless identified, and in a plan. */
  value?: string | undefined
  /** Confidence interval with its level; absent unless identified. */
  interval?: string | undefined
  /** Standard error: relative to the value, the zero offset's in the correction unit. */
  error?: string | undefined
}

/** `x` in the display unit of the parameter, with its symbol. */
function quantityText(name: RangeStringParameterName, x: number, system: UnitSystem): string {
  if (name === 'muzzleVelocity') return withUnit('velocity', system, x)
  if (name === 'dragFactor') return formatNumber(x, 3)
  // a click or an offset: small angles, 3 digits in the correction unit
  return `${formatNumber(system.correction.fromSi(x), 3)} ${system.correction.symbol}`
}

const standardError = (p: RangeStringParameter, system: UnitSystem) => {
  if (p.name === 'zeroOffset')
    return p.standardUncertainty !== undefined && Number.isFinite(p.standardUncertainty)
      ? `±${quantityText(p.name, p.standardUncertainty, system)}`
      : undefined
  const r = p.relativeStandardUncertainty
  return r !== undefined && Number.isFinite(r) ? `±${formatNumber(100 * r, 2)} %` : undefined
}

/** "Identified", or "Weak" or "Unresolved" with the reasons. */
function statusText(p: RangeStringParameter, t: T): string {
  if (p.status === 'identified') return t('Identified')
  const reasons = p.reasons.map((r) => t(reasonText[r])).join('; ')
  if (p.status === 'weak') return reasons ? t('Weak: {reasons}', { reasons }) : t('Weak')
  return reasons ? t('Unresolved: {reasons}', { reasons }) : t('Unresolved')
}

/** "lower to upper (level %)" of an interval. */
function intervalText(p: RangeStringParameter, system: UnitSystem, t: T): string | undefined {
  if (!p.interval) return
  const { lower, upper, confidenceLevel } = p.interval
  return t('{lower} to {upper} ({level} %)', {
    lower: quantityText(p.name, lower, system),
    upper: quantityText(p.name, upper, system),
    level: formatNumber(100 * confidenceLevel, 0),
  })
}

/**
 * The parameters of a plan or a fit as lines. Only an identified parameter has a value and an
 * interval; a weak or unresolved one says why.
 */
export function parameterLines(
  parameters: readonly RangeStringParameter[],
  system: UnitSystem,
  t: T,
): ParameterLine[] {
  return parameters.map((p) => {
    const identified = p.status === 'identified'
    const value =
      identified && p.value !== undefined ? quantityText(p.name, p.value, system) : undefined
    return {
      name: p.name,
      label: t(parameterLabels[p.name].label),
      status: p.status,
      statusText: statusText(p, t),
      ...(value && { value }),
      ...(identified && { interval: intervalText(p, system, t) }),
      ...(standardError(p, system) && { error: standardError(p, system) }),
    }
  })
}

/** The residual check of a fit as sentences; the second one when the intervals are not to be relied on. */
export function residualLines(fit: RangeStringFit, t: T): string[] {
  const dof = fit.degreesOfFreedom
  const chi = formatNumber(fit.chiSquare, 2)
  const p = fit.pValue === undefined ? undefined : formatNumber(fit.pValue, 3)
  const values = { chi, dof, p: p ?? '' }
  let check: string
  if (dof <= 0) check = t('No residual check: as many parameters as rows.')
  else if (p === undefined)
    check = fit.consistent
      ? t(
          'Chi-square {chi} on {dof} degrees of freedom: the residuals agree with the stated uncertainties.',
          values,
        )
      : t(
          'Chi-square {chi} on {dof} degrees of freedom: the residuals do not agree with the stated uncertainties.',
          values,
        )
  else
    check = fit.consistent
      ? t(
          'Chi-square {chi} on {dof} degrees of freedom, p = {p}: the residuals agree with the stated uncertainties.',
          values,
        )
      : t(
          'Chi-square {chi} on {dof} degrees of freedom, p = {p}: the residuals do not agree with the stated uncertainties.',
          values,
        )
  return [
    check,
    ...(fit.intervalsTrusted
      ? []
      : [
          t(
            'The intervals are not to be relied on: the residuals disagree or a held parameter shifts them.',
          ),
        ]),
  ]
}

/** The nominal shot's line above the section: what is being trued. */
export const nominalLine = (
  n: { bullet: string; muzzleVelocity: number; zeroRange: number },
  system: UnitSystem,
  t: T,
) =>
  t('{label}, {velocity}, zero {range}', {
    label: n.bullet,
    velocity: withUnit('velocity', system, n.muzzleVelocity),
    range: withUnit('range', system, n.zeroRange),
  })

/**
 * A stored truing result as the firearm editor lists it: the distances of its strings, the
 * chronograph readings and the identified values, in the units of `system`.
 */
export function truingSummary(entry: Truing, system: UnitSystem, t: T) {
  const strings = entry.rows
    .map((r) =>
      t('{range} ({kind}, {shots} shots)', {
        range: withUnit('range', system, toSi('length', r.range.value)),
        kind: r.kind === 'impact' ? t('impact') : t('dial'),
        shots: r.shots,
      }),
    )
    .join(', ')
  const c = entry.chronograph
  const values = entry.parameters
    .flatMap((p) => {
      if (p.value === undefined) return []
      const si =
        typeof p.value === 'number'
          ? p.value
          : toSi(p.name === 'muzzleVelocity' ? 'velocity' : 'angle', p.value.value)
      return [`${t(parameterLabels[p.name].label)} ${quantityText(p.name, si, system)}`]
    })
    .join(', ')
  return {
    strings: c
      ? t('{strings}; chronograph {count} readings', { strings, count: c.shots })
      : strings,
    values: values || t('None identified'),
  }
}
