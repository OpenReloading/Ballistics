import type { ChargeRange, ChargeTargetKind } from '@openreloading/core'
import type { ErrorBody, InteriorResponse } from './api-types.ts'
import { formatNumber, type UnitSystem, withUnit } from './units.ts'

/** Targets of `POST /interior/charge-target`. */
export type TargetKind = ChargeTargetKind

export const targetKinds: { value: TargetKind; label: string }[] = [
  { value: 'peakPressure', label: 'Peak pressure' },
  { value: 'muzzleVelocity', label: 'Muzzle velocity' },
  { value: 'loadRatio', label: 'Load ratio' },
  { value: 'barrelTime', label: 'Barrel time' },
  { value: 'bulletLeadTime', label: 'Bullet lead time' },
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
export function targetError(typed: string | number, unit: TargetUnit): string | undefined {
  const x = targetNumber(typed)
  const symbol = unit.symbol ? ` ${unit.symbol}` : ''
  if (!(x > 0)) return `Enter a target above 0${symbol}.`
  if (!Number.isFinite(unit.toSi(x)) || unit.toSi(x) > targetMax)
    return `Enter a target of at most ${unit.fromSi(targetMax)}${symbol}.`
}

/**
 * The request body: the load of `POST /interior` without `model`, the target and, with a powder
 * bulk density (kg/m3), the density that caps the charge at the load ratio limit in
 * `load.propellant.bulkDensity`.
 */
export function chargeTargetBody(
  base: { model?: string; load: { propellant: object }; cartridge?: string },
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
export const noComparableLimitText = 'The cartridge has no CIP limit to compare with.'

const number = (u: TargetUnit, si: number) => formatNumber(u.fromSi(si), u.decimals)

/** The refusal in words, in the units shown; the reachable range is part of it. */
export function refusalText(
  refusal: ChargeTargetRefusal,
  kind: TargetKind,
  system: UnitSystem,
  percent: boolean,
): string {
  const { reason, reachable, failure } = refusal
  if ((reason === 'belowRange' || reason === 'aboveRange') && reachable) {
    const limit = refusal.target?.limit?.pressure
    const u = targetUnit(kind, system, percent)
    // a percentage target: the reachable pressures as a share of the limit
    const shown = (si: number) => number(u, percent && limit ? (si / limit) * 100 : si)
    const at = ({ value, charge }: ChargeRange['minValue']) =>
      `${shown(value)}${u.symbol ? ` ${u.symbol}` : ''} at ${withUnit('charge', system, charge)}`
    return `The simulation does not reach this ${reason === 'aboveRange' ? 'high' : 'low'} a value. Over the charges tried, the lowest value is ${at(reachable.minValue)} and the highest is ${at(reachable.maxValue)}.`
  }
  // the load is the problem, not the target
  if (reason === 'noValidRun' && failure)
    return `The simulation gives no valid run for this load. Reason: ${failure.reason}${failure.field ? `; field: ${failure.field}` : ''}.`
  const reasons: Record<string, string> = {
    notMonotone: 'The value crosses the target at more than one charge.',
    bracketFailed: 'No two neighbouring charges with a valid run enclose the target.',
    toleranceNotReached: 'The search did not reach its tolerance.',
    noValidRun: 'No charge in the range gives a valid run with this value.',
    noComparableLimit: noComparableLimitText,
  }
  return (reason && reasons[reason]) ?? refusal.message ?? 'The charge could not be found.'
}
