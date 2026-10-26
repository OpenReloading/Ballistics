/** The truing section of the Trajectory tab: rows as typed, the core plan and fit, and their readouts. */
import {
  fitTruingStrings,
  planTruingStrings,
  type RangeStringEntry,
  type RangeStringFit,
  type RangeStringParameter,
  type RangeStringParameterName,
  type TrajectoryInput,
  type TruingPlan,
  type WeakReason,
} from '@open-reloading/core'
import { errorText } from './error-text.ts'
import { formatNumber, type UnitSystem, withUnit } from './units.ts'

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

/** The number in `text`; undefined while empty or not a finite number. */
function numberOf(text: string): number | undefined {
  const x = Number(text)
  return text.trim() === '' || !Number.isFinite(x) ? undefined : x
}

/** A whole number of at least 1, else undefined. */
const shotsOf = (text: string) => {
  const x = numberOf(text)
  return x !== undefined && Number.isInteger(x) && x >= 1 ? x : undefined
}

/** A row's number and where it stands in the message when it is missing. */
function need(x: number | undefined, what: string, positive = false): number {
  if (x === undefined) throw new RangeError(`${what}: enter a number.`)
  if (positive && !(x > 0)) throw new RangeError(`${what}: must be greater than 0.`)
  return x
}

const rowName = (i: number) => `Row ${i + 1}`

/** The rows that carry anything, with their position; a blank trailing row is not an error. */
const filled = (rows: readonly TruingRow[]) =>
  rows.flatMap((r, i) => (r.range || r.shots || r.mean || r.deviation ? [{ r, i }] : []))

/** Planned entries (no measured values) and the chronograph that has shots and a deviation, SI. */
function planned(input: TruingInputs) {
  const { system: s } = input
  const entries = filled(input.rows).map(({ r, i }) => ({
    kind: r.kind,
    range: s.range.toSi(need(numberOf(r.range), `${rowName(i)} distance`, true)),
    shotCount: need(shotsOf(r.shots), `${rowName(i)} shots`),
  }))
  const { shots, deviation } = input.chrono
  const chronograph =
    shots || deviation
      ? {
          shotCount: need(shotsOf(shots), 'Chronograph shots'),
          standardDeviation: s.velocity.toSi(
            need(numberOf(deviation), 'Chronograph deviation', true),
          ),
        }
      : undefined
  return { entries, chronograph }
}

const clickOf = (input: TruingInputs) =>
  input.system.correction.toSi(need(numberOf(input.click), 'Click value', true))

/** Why the plan or the fit has no answer, or the answer. */
export type Attempt<T> = { answer: T } | { problem: string }

/**
 * The statuses and standard errors of the planned string: the rows' kinds, distances and shots, the
 * chronograph's shots and deviation, and the dispersion of one shot.
 */
export function planSession(shot: TrajectoryInput, input: TruingInputs): Attempt<TruingPlan> {
  try {
    const { entries, chronograph } = planned(input)
    const dispersion = input.system.correction.toSi(
      need(numberOf(input.dispersion), 'Dispersion of one shot', true),
    )
    const plan = planTruingStrings(
      {
        shot,
        clickValue: clickOf(input),
        dispersion,
        entries,
        ...(chronograph && { chronograph }),
      },
      { fitZeroOffset: input.fitZeroOffset },
    )
    return { answer: plan }
  } catch (e) {
    return { problem: errorText(e) }
  }
}

/** The fit of the measured rows and chronograph readings. */
export function fitSession(shot: TrajectoryInput, input: TruingInputs): Attempt<RangeStringFit> {
  try {
    const { system: s } = input
    const entries = filled(input.rows).map(({ r, i }): RangeStringEntry => {
      // an impact is a length, a dial is in clicks
      const toSi = (x: number) => (r.kind === 'impact' ? s.lineOfSightOffset.toSi(x) : x)
      return {
        kind: r.kind,
        range: s.range.toSi(need(numberOf(r.range), `${rowName(i)} distance`, true)),
        shotCount: need(shotsOf(r.shots), `${rowName(i)} shots`),
        value: toSi(need(numberOf(r.mean), `${rowName(i)} mean`)),
        standardDeviation: toSi(need(numberOf(r.deviation), `${rowName(i)} deviation`, true)),
      }
    })
    const c = input.chrono
    const chronograph =
      c.shots || c.mean || c.deviation
        ? {
            shotCount: need(shotsOf(c.shots), 'Chronograph shots'),
            mean: s.velocity.toSi(need(numberOf(c.mean), 'Chronograph mean', true)),
            standardDeviation: s.velocity.toSi(
              need(numberOf(c.deviation), 'Chronograph deviation', true),
            ),
          }
        : undefined
    return {
      answer: fitTruingStrings(
        { shot, clickValue: clickOf(input), entries, ...(chronograph && { chronograph }) },
        { fitZeroOffset: input.fitZeroOffset },
      ),
    }
  } catch (e) {
    return { problem: errorText(e) }
  }
}

export const parameterLabels: Record<RangeStringParameterName, string> = {
  muzzleVelocity: 'Muzzle velocity',
  dragFactor: 'Drag factor',
  clickValue: 'Click value',
  zeroOffset: 'Zero offset',
}

const reasonText: Record<WeakReason, string> = {
  'no-information': 'the data does not move it',
  collinear: 'the data cannot tell it from another parameter',
  imprecise: 'too imprecise',
  'fit-failed': 'the fit failed',
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
function statusText(p: RangeStringParameter): string {
  if (p.status === 'identified') return 'Identified'
  const reasons = p.reasons.map((r) => reasonText[r]).join('; ')
  return `${p.status === 'weak' ? 'Weak' : 'Unresolved'}${reasons ? `: ${reasons}` : ''}`
}

/** "lower to upper (level %)" of an interval. */
function intervalText(p: RangeStringParameter, system: UnitSystem): string | undefined {
  if (!p.interval) return
  const { lower, upper, confidenceLevel } = p.interval
  return `${quantityText(p.name, lower, system)} to ${quantityText(p.name, upper, system)} (${formatNumber(100 * confidenceLevel, 0)} %)`
}

/**
 * The parameters of a plan or a fit as lines. Only an identified parameter has a value and an
 * interval; a weak or unresolved one says why.
 */
export function parameterLines(
  parameters: readonly RangeStringParameter[],
  system: UnitSystem,
): ParameterLine[] {
  return parameters.map((p) => {
    const identified = p.status === 'identified'
    const value =
      identified && p.value !== undefined ? quantityText(p.name, p.value, system) : undefined
    return {
      name: p.name,
      label: parameterLabels[p.name],
      status: p.status,
      statusText: statusText(p),
      ...(value && { value }),
      ...(identified && { interval: intervalText(p, system) }),
      ...(standardError(p, system) && { error: standardError(p, system) }),
    }
  })
}

/** The residual check of a fit as sentences; the second one when the intervals are not to be relied on. */
export function residualLines(fit: RangeStringFit): string[] {
  const dof = fit.degreesOfFreedom
  const check =
    dof > 0
      ? `Chi-square ${formatNumber(fit.chiSquare, 2)} on ${dof} degrees of freedom${fit.pValue === undefined ? '' : `, p = ${formatNumber(fit.pValue, 3)}`}: the residuals ${fit.consistent ? 'agree' : 'do not agree'} with the stated uncertainties.`
      : 'No residual check: as many parameters as rows.'
  return [
    check,
    ...(fit.intervalsTrusted
      ? []
      : [
          'The intervals are not to be relied on: the residuals disagree or a held parameter shifts them.',
        ]),
  ]
}

/** The nominal shot's line above the section: what is being trued. */
export const nominalLine = (
  n: { bullet: string; muzzleVelocity: number; zeroRange: number },
  system: UnitSystem,
) =>
  `${n.bullet}, ${withUnit('velocity', system, n.muzzleVelocity)}, zero ${withUnit('range', system, n.zeroRange)}`
