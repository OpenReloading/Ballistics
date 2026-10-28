import type { ChargeRange, ChargeTargetKind } from '@open-reloading/core'
import { formatNumber, plainNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import type { ErrorBody, InteriorResponse } from './api-types.ts'
import { translateMessage } from './core-messages.ts'
import { type UnitSystem, withUnit } from './units.ts'

/** Targets of `POST /interior/charge-target`. */
export type TargetKind = ChargeTargetKind

export const targetKinds: { value: TargetKind; label: Message }[] = [
  { value: 'peakPressure', label: msg('Peak pressure') },
  { value: 'muzzleVelocity', label: msg('Muzzle velocity') },
  { value: 'loadRatio', label: msg('Load ratio') },
  { value: 'barrelTime', label: msg('Barrel time') },
  { value: 'bulletLeadTime', label: msg('Bullet lead time') },
]

/** The unit a target is typed and shown in; `toSi` and `fromSi` for the request's SI value. */
interface TargetUnit {
  symbol: string
  toSi(x: number): number
  fromSi(si: number): number
  decimals: number
}

/** `percent`: the peak pressure as a percentage of the cartridge's compared CIP limit. */
export function targetUnit(kind: TargetKind, system: UnitSystem, percent = false): TargetUnit {
  if (kind === 'peakPressure')
    return percent ? { symbol: '% of Pmax', ...same, decimals: 1 } : system.pressure
  if (kind === 'muzzleVelocity') return system.velocity
  if (kind === 'loadRatio') return { symbol: '', ...same, decimals: 3 }
  return { symbol: 'ms', toSi: (x) => x * 1e-3, fromSi: (si) => si * 1e3, decimals: 3 }
}
const same = { toSi: (x: number) => x, fromSi: (x: number) => x }

/** 200 answer; `result` has no `points`. */
export interface ChargeTargetResponse {
  notice: string
  /** kg. */
  charge: number
  achievedValue: number
  relativeTolerance: number
  target: { kind: TargetKind; value: number; limit?: { pressure: number } }
  reachable: ChargeRange
  burnoutInBarrel: boolean
  result: Omit<InteriorResponse['result'], 'points'>
  pressureRange: InteriorResponse['pressureRange']
  limits?: InteriorResponse['limits']
  warnings: InteriorResponse['warnings']
}

/** 422 answer of a target the solver refuses, or any other error body. */
export type ChargeTargetRefusal = ErrorBody & {
  target?: { limit?: { pressure: number } }
  reachable?: ChargeRange
  /** `noValidRun`: `reason` and `field` of the first scanned run that failed. */
  failure?: { reason: string; field?: string }
}

/** A target as typed: a number, or the text of a `NumberInput` such as "12." or "0.", NaN where it is no number. */
export function targetNumber(typed: string | number): number {
  if (typeof typed === 'number') return typed
  const text = typed.trim()
  return text === '' ? Number.NaN : Number(text)
}

/** Highest `target.value` the API accepts (`src/compute/charge-schema.ts`), Pa or percent. */
const targetMax = 1e12

/**
 * Why `typed` is no target in `unit`: not above 0, or above what the API accepts; undefined for a
 * valid target. The message names the unit shown.
 */
export function targetError(
  typed: string | number,
  unit: TargetUnit,
  t: Translator['t'],
): string | undefined {
  const x = targetNumber(typed)
  const symbol = unit.symbol ? ` ${unit.symbol}` : ''
  if (!(x > 0)) return t('Enter a target above 0{unit}.', { unit: symbol })
  if (!Number.isFinite(unit.toSi(x)) || unit.toSi(x) > targetMax)
    return t('Enter a target of at most {max}{unit}.', {
      max: plainNumber(unit.fromSi(targetMax)),
      unit: symbol,
    })
}

/**
 * The request body: the load of `POST /interior` without `model`, the target and, with a powder
 * bulk density (kg/m3), the density that caps the charge at the load ratio limit in
 * `load.propellant.bulkDensity`.
 */
export function chargeTargetBody(
  base: {
    model?: string | undefined
    load: { propellant: object }
    cartridge?: string | undefined
  },
  bulkDensity: number | undefined,
  target: { kind: TargetKind; value: number; percent: boolean },
) {
  const { model: _model, load, ...rest } = base
  return {
    ...rest,
    load:
      bulkDensity === undefined
        ? load
        : { ...load, propellant: { ...load.propellant, bulkDensity } },
    target: {
      kind: target.kind,
      value: target.value,
      ...(target.percent && { unit: 'percentOfLimit' as const }),
    },
  }
}

/** The sentence for a percentage target of a cartridge without a comparable CIP limit. */
export const noComparableLimitText = msg('The cartridge has no CIP limit to compare with.')

const number = (u: TargetUnit, si: number) => formatNumber(u.fromSi(si), u.decimals)

/** The refusal in words, in the units shown; the reachable range is part of it. */
export function refusalText(
  refusal: ChargeTargetRefusal,
  kind: TargetKind,
  system: UnitSystem,
  percent: boolean,
  t: Translator['t'],
): string {
  const { reason, reachable, failure } = refusal
  if ((reason === 'belowRange' || reason === 'aboveRange') && reachable) {
    const limit = refusal.target?.limit?.pressure
    const u = targetUnit(kind, system, percent)
    // a percentage target: the reachable pressures as a share of the limit
    const shown = (si: number) => number(u, percent && limit ? (si / limit) * 100 : si)
    const at = ({ value, charge }: ChargeRange['minValue']) =>
      t('{value} at {charge}', {
        value: `${shown(value)}${u.symbol ? ` ${u.symbol}` : ''}`,
        charge: withUnit('charge', system, charge),
      })
    const range = { low: at(reachable.minValue), high: at(reachable.maxValue) }
    return reason === 'aboveRange'
      ? t(
          'The simulation does not reach this high a value. Over the charges tried, the lowest value is {low} and the highest is {high}.',
          range,
        )
      : t(
          'The simulation does not reach this low a value. Over the charges tried, the lowest value is {low} and the highest is {high}.',
          range,
        )
  }
  // the load is the problem, not the target
  if (reason === 'noValidRun' && failure) {
    const why = translateMessage(failure.reason, t)
    return failure.field
      ? t('The simulation gives no valid run for this load. Reason: {reason}; field: {field}.', {
          reason: why,
          field: failure.field,
        })
      : t('The simulation gives no valid run for this load. Reason: {reason}.', { reason: why })
  }
  const reasons: Record<string, Message> = {
    notMonotone: msg('The value crosses the target at more than one charge.'),
    bracketFailed: msg('No two neighbouring charges with a valid run enclose the target.'),
    toleranceNotReached: msg('The search did not reach its tolerance.'),
    noValidRun: msg('No charge in the range gives a valid run with this value.'),
    noComparableLimit: noComparableLimitText,
  }
  const known = reason && reasons[reason]
  if (known) return t(known)
  return refusal.message
    ? translateMessage(refusal.message, t)
    : t('The charge could not be found.')
}
