import { type InteriorLoad, interiorApply } from '@open-reloading/core'
import { formatNumber } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
import { longerBody } from './barrel-length.ts'
import type { LadderDirection } from './seating-ladder.ts'

/** The burn-rate change of the lot rows when none is typed, as a fraction. */
export const defaultLotFraction = 0.03

/** The most the request takes for a burn-rate tolerance (`burnRateFraction` of the API), as a fraction. */
export const maxLotFraction = 0.5

/** The two extra rows of a charge: a powder lot that burns slower (`low`) or faster (`high`). */
export type Lot = 'low' | 'high'

export const lots: readonly Lot[] = ['low', 'high']

const side: Record<Lot, -1 | 1> = { low: -1, high: 1 }

/**
 * The load at another powder lot: the burn rate scaled by `fraction` up (`high`) or down (`low`),
 * the coefficient of a geometric burn law or the vivacity of a vivacity law. The pressure range
 * moves the burn rate the same way for its tolerance.
 */
export function lotLoad(load: InteriorLoad, lot: Lot, fraction: number): InteriorLoad {
  const moved = interiorApply.burnRateFraction(load, side[lot], fraction)
  // the burn-rate move returns a reason only for an input another key refuses
  if (typeof moved === 'string') throw new Error(moved)
  return moved
}

/** The request of one lot: the run's charges as a ladder at the lot's burn rate, the limits of `cartridge` compared. */
export function lotBody(
  load: InteriorLoad,
  charges: number[],
  direction: LadderDirection,
  lot: Lot,
  fraction: number,
  cartridge?: string | undefined,
): ReturnType<typeof longerBody> & { cartridge?: string | undefined } {
  const body = longerBody(lotLoad(load, lot, fraction), charges, direction, load.barrel.length)
  return cartridge ? { ...body, cartridge } : body
}

/** Why `fraction` is no burn-rate change for the lot rows, or undefined. */
export function lotFractionError(fraction: number | undefined, t: Translator['t']) {
  if (fraction === undefined) return t('Enter a burn-rate change.')
  if (!(fraction > 0)) return t('The burn-rate change must be above 0.')
  if (fraction > maxLotFraction)
    return t('The burn-rate change is at most {percent} %.', { percent: maxLotFraction * 100 })
}

/** The burn-rate change of a lot as the rows name it: "+3 %" or "−3 %" (U+2212). */
export const lotLabel = (lot: Lot, fraction: number) =>
  `${lot === 'high' ? '+' : '−'}${formatNumber(fraction * 100, 1).replace(/[.,]0$/, '')} %`

/** What a screen reader hears of the chart before its values. */
export const lotChartDescription = (fraction: number, target: boolean, t: Translator['t']) =>
  [
    t(
      'The line is the nominal run. The shaded band spans the barrel times of the nominal row and the rows at a burn rate {high} and {low}.',
      { high: lotLabel('high', fraction), low: lotLabel('low', fraction) },
    ),
    target ? t('The dashed line is the target barrel time.') : '',
    t('The table gives the values.'),
  ]
    .filter(Boolean)
    .join(' ')

/** The row's burn-rate cell: "nominal", or the lot's change. */
export const burnRateLabel = (lot: Lot | undefined, fraction: number, t: Translator['t']) =>
  lot ? lotLabel(lot, fraction) : t('nominal')

/** The barrel times of one charge in the nominal run and the two lots, s; absent for a row without a result. */
export interface BarrelTimes {
  charge: number
  nominal?: number | undefined
  low?: number | undefined
  high?: number | undefined
}

/** The barrel times of the rows of each charge, in the order of the charges. */
export function barrelTimes(
  nominal: readonly { charge: number; barrelTime?: number | undefined }[],
  byLot: Record<Lot, readonly { barrelTime?: number | undefined }[]>,
): BarrelTimes[] {
  return nominal.map((s, i) => ({
    charge: s.charge,
    nominal: s.barrelTime,
    low: byLot.low[i]?.barrelTime,
    high: byLot.high[i]?.barrelTime,
  }))
}

/**
 * The band of a charge: the shortest and longest barrel time of its rows, s. Undefined unless both
 * lots and the nominal row have a result, so a band never spans fewer rows than it names.
 */
export function barrelTimeBand(t: BarrelTimes): [number, number] | undefined {
  if (t.nominal === undefined || t.low === undefined || t.high === undefined) return
  return [Math.min(t.nominal, t.low, t.high), Math.max(t.nominal, t.low, t.high)]
}
