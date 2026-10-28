import {
  advisoryRules,
  fillLoadRatioLimit,
  loadRatio,
  solidFill,
  solidFillLimit,
} from '@open-reloading/core'
import { fromSi, sheetId, toSi } from '@open-reloading/schema'
import { formatNumber } from '../i18n/number.ts'
import { msg, type Say, type Translator } from '../i18n/translate.ts'
import type { InteriorResponse } from './api-types.ts'
import { translateMessage } from './core-messages.ts'
import type { LadderDirection } from './seating-ladder.ts'
import { formatQuantity, inchText, type UnitSystem } from './units.ts'

/** Input panels of the load workbench, in reading order. */
const panelOrder = ['cartridge', 'bullet', 'powder', 'firearm'] as const
export type InputPanel = (typeof panelOrder)[number]

type Limit = NonNullable<InteriorResponse['limits']>[number]

/** The first compared limit with a pressure: the limit "Percent of maximum" and the chart's limit line use. */
export const firstPressureLimit = (limits: Limit[] | undefined) =>
  limits?.find((l) => l.compared && l.pressure !== undefined)

/** `100 * peakPressure / p_limit` with `p_limit` the first compared limit; undefined without one. */
export function percentOfPressureLimit(peakPressure: number, limits: Limit[] | undefined) {
  const limit = firstPressureLimit(limits)
  if (!limit?.pressure) return
  return { percent: (100 * peakPressure) / limit.pressure, limit }
}

/** Bullet lead time: muzzle time less 10 % pressure time, both from ignition; undefined when the latter is 0. */
export function bulletLeadTime(r: { muzzleTime: number; tenPercentPressureTime: number }) {
  return r.tenPercentPressureTime > 0 ? r.muzzleTime - r.tenPercentPressureTime : undefined
}

/**
 * The warning of a charge above the solid fill limit, undefined within it; the workbench result and
 * its step flag show it. Charge kg, solid and bulk density kg/m³, volume m³.
 */
export function solidFillWarning(
  charge: number,
  density: number,
  bulkDensity: number | undefined,
  volume: number,
  t: Translator['t'],
) {
  const fill = solidFill(charge, density, volume)
  if (!(fill > solidFillLimit)) return
  const ratio = loadRatio(charge, bulkDensity, volume)
  const limit = solidFillLimit
  return {
    text:
      ratio === undefined || bulkDensity === undefined
        ? t(
            'Simulation: solid fill {fill} is above {limit}; the model is outside the range it was built for.',
            { fill: formatNumber(fill, 2), limit },
          )
        : t(
            'Simulation: load ratio {ratio} is above {max}, solid fill {limit} for this powder; the model is outside the range it was built for.',
            {
              ratio: formatNumber(ratio, 2),
              max: formatNumber(fillLoadRatioLimit(density, bulkDensity), 2),
              limit,
            },
          ),
    name: t('solid fill above {limit}', { limit }),
  }
}

/**
 * A ladder step's label relative to the main charge: the main charge is 0, lower
 * charges -1, -2 and higher ones +1, +2, with the minus sign U+2212. Step `i` of `steps` in the
 * order the API returns them: up and down start at the main charge, around is lowest first.
 */
export function stepLabel(i: number, steps: number, direction: LadderDirection) {
  const k = direction === 'around' ? i - (steps - 1) / 2 : direction === 'down' ? -i : i
  return k === 0 ? '0' : `${k > 0 ? '+' : '−'}${Math.abs(k)}`
}

/**
 * How many tabs of `widths` (px, in order) fit a row `room` px wide; the rest go into a More menu.
 * A row not measured yet (0) keeps them all.
 */
export function resultTabsFit(widths: number[], room: number) {
  if (room <= 0) return widths.length
  let used = 0
  for (const [i, w] of widths.entries()) {
    used += w
    if (used > room) return i
  }
  return widths.length
}

/**
 * The run status: text, or a result's line (after `prefix`) written in the units shown now. A `say`
 * is written in the language shown now, a plain string stays as it was written.
 */
export type Status = string | { say: Say } | { prefix: string | Say }

/** The status text; `line` is the shown result's line in the units shown now, undefined without a result. */
export const statusText = (status: Status, line: string | undefined, t: Translator['t']) => {
  const text = (x: string | Say) => (typeof x === 'string' ? x : x(t))
  if (typeof status === 'string') return status
  if ('say' in status) return status.say(t)
  return line === undefined ? '' : text(status.prefix) + line
}

export function warningCountText(count: number, tn: Translator['tn']) {
  if (count === 0) return ''
  return tn(count, '{count} simulation warning', '{count} simulation warnings')
}

/** The short name of a warning code from the advisory registry, in the language of `t`. */
function ruleName(code: string, t: Translator['t']) {
  const name = advisoryRules.find((r) => r.id === code)?.name
  return name && translateMessage(name, t)
}

/** A limit as shown with `d` decimals: in bar the record's value while it needs no more. */
function limitNumber(pa: number, system: UnitSystem, d: number) {
  const u = system.pressure
  return u.symbol === 'bar' && d === u.decimals
    ? +fromSi('pressure', pa).toPrecision(12)
    : +u.fromSi(pa).toFixed(d)
}

/**
 * The decimals that keep simulated pressures on their side of a limit once both are rounded (the
 * API's rule in bar): the unit's, more while rounding would put one on or across the limit.
 */
function digitsAgainst(values: number[], limit: number, system: UnitSystem) {
  const u = system.pressure
  let d = u.decimals
  const kept = (pa: number) =>
    Math.sign(+u.fromSi(pa).toFixed(d) - limitNumber(limit, system, d)) === Math.sign(pa - limit)
  while (d < u.decimals + 5 && !values.every(kept)) d++
  return d
}

/** A plain warning message with its bar values written in the pressure unit of `system`. */
function convertBarMessage(message: string, system: UnitSystem) {
  const u = system.pressure
  return u.symbol === 'bar'
    ? message
    : message.replace(
        /(?<!\d)(\d+(?:\.\d+)?) bar\b/g,
        (_, v: string) =>
          `${formatNumber(u.fromSi(toSi('pressure', Number(v))), u.decimals)} ${u.symbol}`,
      )
}

/**
 * An exceeded limit's warning written again from the limit `l`, its pressure `pressure` (Pa) and
 * the pressure range of `body`, its source as the standard with the sheet's date and the
 * measuring method.
 */
function limitExceededText(
  body: InteriorResponse,
  l: Limit,
  pressure: number,
  system: UnitSystem,
  t: Translator['t'],
): { text: string; name: string } {
  const u = system.pressure
  const range = body.pressureRange
  const name = `CIP ${l.symbol}${l.variant ? ` (${l.variant})` : ''}`
  const d = digitsAgainst([range.nominalPressure, range.highPressure], pressure, system)
  const shown = {
    name,
    unit: u.symbol,
    limit: limitNumber(pressure, system, d),
    revised: l.revised,
    method: translateMessage(l.method ?? 'measuring method not stated', t),
    nominal: formatNumber(u.fromSi(range.nominalPressure), d),
    low: formatNumber(u.fromSi(range.lowPressure), u.decimals),
    high: formatNumber(u.fromSi(range.highPressure), d),
  }
  return l.nominalExceeded
    ? {
        text: t(
          'Simulated peak pressure {nominal} {unit} (range {low} to {high} {unit}) is above {name} {limit} {unit}, source CIP ({revised}, {method}).',
          shown,
        ),
        name: t('above {name}', { name }),
      }
    : {
        text: t(
          'The upper end of the simulated peak pressure range, {high} {unit}, is above {name} {limit} {unit}, source CIP ({revised}, {method}); the nominal value is {nominal} {unit}.',
          shown,
        ),
        name: t('range above {name}', { name }),
      }
}

/**
 * The API's warnings of `body` in the pressure unit of `system`, each with its short name: an
 * exceeded limit (the warning's sheet, symbol, variant and method) is written again from the
 * limit and the pressure range, its source as the
 * standard with the sheet's date and the measuring method; bar values of the other lines are
 * converted.
 */
export function shownWarnings(
  body: InteriorResponse,
  system: UnitSystem,
  t: Translator['t'],
): { text: string; name?: string | undefined }[] {
  return body.warnings.map((w) => {
    const l =
      w.code === 'limitExceeded'
        ? body.limits?.find(
            (x) =>
              x.exceeded &&
              sheetId({ id: x.cartridge, published: x.revised }) === w.spec &&
              x.symbol === w.symbol &&
              x.variant === w.variant &&
              x.method === w.method,
          )
        : undefined
    if (l?.pressure === undefined || !l.exceeded)
      return {
        text: translateMessage(convertBarMessage(w.message, system), t),
        name: ruleName(w.code, t),
      }
    return limitExceededText(body, l, l.pressure, system, t)
  })
}

/** Workbench decimals of lengths by kind and unit. */
const lengthDigits = { travel: { mm: 1, in: 2 }, diameter: { mm: 2, in: 3 } } as const

/** A length in the display unit of `system` with the workbench decimals of its kind, without the symbol. */
export function lengthText(kind: keyof typeof lengthDigits, system: UnitSystem, si: number) {
  const unit = system.length
  const digits = (lengthDigits[kind] as Record<string, number>)[unit.symbol] ?? unit.decimals
  return formatNumber(unit.fromSi(si), digits)
}

/** A length in the display unit of `system` with the workbench decimals of its kind, and the symbol. */
export function shownLength(kind: keyof typeof lengthDigits, system: UnitSystem, si: number) {
  const { symbol } = system.length
  return `${inchText(lengthText(kind, system, si), symbol)} ${symbol}`
}

/** A length given in mm in the display unit of `system`, with the symbol. */
export const mmLength = (system: UnitSystem, mm: number) =>
  shownLength('diameter', system, toSi('length', mm))

/**
 * Why the range card is out of reach after a run: a missing bullet record at once; any other
 * reason once the Trajectory result has stayed away (`waited`), never during the wait for it.
 */
export const rangeCardNote = (
  ran: boolean,
  bullet: string | undefined,
  waited: boolean,
  t: Translator['t'],
) =>
  !ran
    ? ''
    : !bullet
      ? t('The range card needs a bullet record.')
      : waited
        ? t('The range card needs a Trajectory result: see the Trajectory tab.')
        : ''

/**
 * The two values the phone range view leads with: the shown step's charge and muzzle
 * velocity in the page's units, and the step's label on a ladder.
 */
export function rangeHero(
  system: UnitSystem,
  charge: number,
  velocity: number,
  label: string | undefined,
  t: Translator['t'],
) {
  return {
    step: label === undefined ? undefined : t('Step {label}', { label }),
    charge: { value: formatQuantity('charge', system, charge), unit: system.charge.symbol },
    velocity: { value: formatQuantity('velocity', system, velocity), unit: system.velocity.symbol },
  }
}

/**
 * The band of the peak pressure (Pa) and the muzzle velocity (m/s) a result shows: the 5th and 95th
 * percentile of the sampled band, else the corner-case range of the pressure and no velocity band.
 * `cornerOnly` (the printed report) always takes the corner-case range, so a print does not depend on
 * whether the sampling had answered.
 */
export function resultBand(body: InteriorResponse, cornerOnly = false) {
  const { sampled, pressureRange: range } = body
  const sample = sampled?.status === 'sampled' && !cornerOnly ? sampled : undefined
  return {
    sampled: sample !== undefined,
    pressure: sample?.pressure
      ? { low: sample.pressure.p05, high: sample.pressure.p95 }
      : { low: range.lowPressure, high: range.highPressure },
    velocity: sample?.velocity && { low: sample.velocity.p05, high: sample.velocity.p95 },
  }
}

/** What the sampled band of a result says: its reach, or why the corner-case range stands in (shown instead); undefined without one. */
export function bandNotice(
  sampled: InteriorResponse['sampled'],
  t: Translator['t'],
): string | undefined {
  if (sampled === undefined) return
  if (sampled.status === 'sampled') return t('input tolerances only')
  return t(
    {
      overBudget: msg('over budget'),
      invalid: msg('no valid draw'),
      failed: msg('not finished'),
    }[sampled.status],
  )
}

/**
 * The line under the key tiles of a result with a sampling answer: the velocity band and what the
 * bands cover, or why the corner-case range is shown instead; undefined without a sampling answer.
 */
export function bandLine(
  body: InteriorResponse,
  system: UnitSystem,
  t: Translator['t'],
): string | undefined {
  const notice = bandNotice(body.sampled, t)
  if (notice === undefined) return
  const { velocity } = resultBand(body)
  if (!velocity) return t('Sampled bands {notice}: corner-case range shown.', { notice })
  const v = (si: number) => formatQuantity('velocity', system, si)
  return t('Velocity {low} to {high} {unit}. 5th to 95th percentile, {notice}.', {
    low: v(velocity.low),
    high: v(velocity.high),
    unit: system.velocity.symbol,
    notice,
  })
}
