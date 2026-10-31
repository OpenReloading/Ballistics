/**
 * Burn-rate charts from fitted M3 parameters (`apps/docs/docs/models/interior-burn-forms.md`, "Dynamic vivacity"): dynamic vivacity
 * in 1/(MPa s), interval plus and minus `uncertaintyFactor` standard uncertainties of the fitted vivacity.
 */

import { dynamicVivacity, meanDynamicVivacity, type VivacityBurn } from '@open-reloading/core'
import { type Powder, toSi } from '@open-reloading/schema'
import { formatNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator, translator } from '../i18n/translate.ts'
import type { PowderSummary } from './api-types.ts'
import { type ManufacturerNames, productLabel } from './manufacturers.ts'
import { nth } from './nth.ts'
import { say, type Wording, worded } from './wording.ts'

/** Dash pattern per colour slot of the burn-rate charts: identity is not carried by colour alone. */
export const dashes = ['', '8 4', '2 3', '12 3 3 3', '4 4', '6 2 1 2'] as const

/** Number of standard uncertainties in the vivacity interval (2). */
export const uncertaintyFactor = 2

/** A powder with a curve: its burn law in SI and the relative interval of the fitted vivacity. */
export interface FittedPowder {
  id: string
  label: string
  /** Id of the manufacturer record; empty for typed parameters. */
  manufacturer: string
  form?: string | undefined
  base?: string | undefined
  burn: VivacityBurn
  /** `uncertaintyFactor` times sigma / vivacity; absent when the record has no sigma. */
  spread?: number | undefined
}

/** Why a powder has no curve: no fit, a pressure exponent other than 1, an interval reaching 0. */
type UnfitKind = 'none' | 'exponent' | 'unresolved'

export interface UnfittedPowder {
  id: string
  label: string
  kind: UnfitKind
  /** `why` in English: what a reader of the data sees where nothing translates it. */
  reason: string
  /** `reason` as a message with its numbers, for the language shown (`say(t, why)`). */
  why: Wording
  /** The powder's own numbers behind `kind`, for a list grouped by kind. */
  detail?: string
  /** `detail` as a message with its numbers. */
  detailWhy?: Wording
}

const english = translator().t

/** An unfitted powder with `reason` and `detail` written from their wordings in English. */
const unfit = (
  p: Pick<UnfittedPowder, 'id' | 'label' | 'kind'>,
  why: Wording,
  detailWhy?: Wording,
): UnfittedPowder => ({
  ...p,
  reason: say(english, why),
  why,
  ...(detailWhy && { detail: say(english, detailWhy), detailWhy }),
})

interface RateInterval {
  value: number
  low?: number | undefined
  high?: number | undefined
}

const noFitReason = msg(
  'No fitted parameters: the load-table fit gives parameters only to powders with at least 10 training rows from at least 2 cartridges.',
)

/** What `classifyPowder` reads: a powder record or a list summary, with its manufacturer's name where known. */
type BurnSource = Pick<Powder, 'id' | 'manufacturer' | 'name' | 'grainForm' | 'propellantBase'> & {
  manufacturerName?: string
  interior?: PowderSummary['interior']
}

/** Why a powder with a fitted pressure exponent `exponent` other than 1 has no curve. */
const exponentReason = (exponent: number) =>
  worded(
    msg(
      'Pressure exponent {exponent}, not 1: the burn rate per pressure depends on the pressure, so there is no single curve.',
    ),
    { exponent },
  )

/** Why the powder has no curve: no fit, an exponent other than 1, an interval reaching 0; none when it has one. */
function unfitReason(p: BurnSource, label: string): UnfittedPowder | undefined {
  const i = p.interior
  const own = { id: p.id, label }
  if (!i) return unfit({ ...own, kind: 'none' }, noFitReason)
  if (i.pressureExponent !== 1)
    return unfit(
      { ...own, kind: 'exponent' },
      exponentReason(i.pressureExponent),
      worded(msg('exponent {exponent}'), { exponent: i.pressureExponent }),
    )
  const { value, standardUncertainty: sigma } = i.vivacity
  if (sigma !== undefined && uncertaintyFactor * sigma >= value) {
    const numbers = { value, factor: uncertaintyFactor, sigma }
    return unfit(
      { ...own, kind: 'unresolved' },
      worded(
        msg(
          'Fit unresolved: the interval of the fitted vivacity ({value} 1/s, plus and minus {factor} times {sigma}) reaches 0, so the powder is not placed.',
        ),
        numbers,
      ),
      worded(msg('vivacity {value} 1/s, plus and minus {factor} times {sigma}'), numbers),
    )
  }
}

/** A vivacity burn law with pressure exponent 1, SI. */
const burnLawOf = (
  vivacity: number,
  referencePressure: number,
  form: VivacityBurn['form'],
): VivacityBurn => ({ kind: 'vivacity', vivacity, exponent: 1, referencePressure, form })

/** The powder's burn law, or the reason it has no curve; labelled with the name from `names`. */
export function classifyPowder(
  p: BurnSource,
  names?: ManufacturerNames,
): FittedPowder | UnfittedPowder {
  const label = productLabel(p, names)
  const unfitted = unfitReason(p, label)
  if (unfitted) return unfitted
  const i = p.interior as NonNullable<BurnSource['interior']>
  const { value, standardUncertainty: sigma } = i.vivacity
  const { a, m, q, z1 } = i.burnForm
  return {
    id: p.id,
    label,
    manufacturer: p.manufacturer,
    form: p.grainForm,
    base: p.propellantBase,
    // stored in bar
    burn: burnLawOf(value, toSi('pressure', i.referencePressure.value), {
      kind: 'twoStage',
      a: a.value,
      m,
      q,
      z1,
    }),
    spread: sigma === undefined ? undefined : (uncertaintyFactor * sigma) / value,
  }
}

export const isFitted = (p: FittedPowder | UnfittedPowder): p is FittedPowder => 'burn' in p

/**
 * The burn law of typed model parameters (SI field values), as the workbench sends them: no
 * interval, no record. Undefined while a value the curve needs is missing.
 */
export function typedBurn(
  v: Partial<Record<string, number>>,
  t: Translator['t'] = english,
): FittedPowder | UnfittedPowder | undefined {
  const { vivacity, exponent, referencePressure, formA, formM, formQ, formZ1 } = v
  if (vivacity === undefined || exponent === undefined || referencePressure === undefined) return
  const id = 'typed'
  const label = t('Typed model parameters')
  if (exponent !== 1) return unfit({ id, label, kind: 'exponent' }, exponentReason(exponent))
  const form = [formA, formM, formQ, formZ1]
  return {
    id,
    label,
    manufacturer: '',
    burn: burnLawOf(
      vivacity,
      referencePressure,
      form.every((x) => x !== undefined)
        ? {
            kind: 'twoStage',
            a: formA as number,
            m: formM as number,
            q: formQ as number,
            z1: formZ1 as number,
          }
        : { kind: 'constant' },
    ),
  }
}

/** 1/(Pa s) to 1/(MPa s), with the interval (above 0: `classifyPowder` sets wider fits apart). */
function withInterval(p: FittedPowder, perPa: number): RateInterval {
  const value = perPa * 1e6
  if (p.spread === undefined) return { value }
  return { value, low: value * (1 - p.spread), high: value * (1 + p.spread) }
}

/** Dynamic vivacity at burnt fraction z, 1/(MPa s). */
export const curveAt = (p: FittedPowder, z: number) => withInterval(p, dynamicVivacity(p.burn, z))

/** Order scalar: mean dynamic vivacity over burnt fraction 0.1 to 0.9, 1/(MPa s). */
export const meanRate = (p: FittedPowder) => withInterval(p, meanDynamicVivacity(p.burn))

/** Burnt fractions of the chart (0 to 1 in steps of 0.01) and of the data tables (steps of 0.1). */
export const chartBurntFractions = Array.from({ length: 101 }, (_, i) => i / 100)
export const tableBurntFractions = Array.from({ length: 11 }, (_, i) => i / 10)

export const vivacityUnit = '1/(MPa·s)'

/** What a curve is: the caption of a powder record's chart. */
export const modelCaption = msg('Model output from fitted M3 parameters, not manufacturer data.')

/** What the band of a curve and the bar of a mean cover; 2 is `uncertaintyFactor`. */
export const bandNote = msg(
  'Plus and minus 2 standard uncertainties of the fitted vivacity, a lower bound.',
)

/** `bandNote` as the end of `modelCaption`: what the band and the bars of the burn-rate page's curves are. */
export const bandAndBarsNote = msg(
  'Band and bars: plus and minus 2 standard uncertainties of the fitted vivacity, a lower bound.',
)

const n2 = (v: number) => formatNumber(v, 2)

/** The order scalar with its interval, as text. */
function meanText(p: FittedPowder, t: Translator['t']): string {
  const m = meanRate(p)
  const unit = vivacityUnit
  return m.low === undefined || m.high === undefined
    ? t('{value} {unit}', { value: n2(m.value), unit })
    : t('{value} ({low} to {high}) {unit}', {
        value: n2(m.value),
        low: n2(m.low),
        high: n2(m.high),
        unit,
      })
}

/** Text alternative of one powder's curve: start, peak, end and the mean, in the language of `t`. */
export function describeCurve(p: FittedPowder, t: Translator['t'] = english): string {
  const values = chartBurntFractions.map((z) => curveAt(p, z).value)
  const peak = values.indexOf(Math.max(...values))
  return t(
    'Dynamic vivacity of {label} over burnt fraction 0 to 1: {start} {unit} at z 0, highest {top} at z {z}, {end} at z 1. Mean over z 0.1 to 0.9: {mean}.',
    {
      label: p.label,
      start: n2(nth(values, 0)),
      unit: vivacityUnit,
      top: n2(values[peak] ?? Number.NaN),
      z: formatNumber(chartBurntFractions[peak] ?? Number.NaN, 2),
      end: n2(values.at(-1) ?? 0),
      mean: meanText(p, t),
    },
  )
}

/** The sentence of each group of powders without a curve; the unresolved one has `{factor}` standard uncertainties. */
export const unfitTitles: Record<UnfitKind, Message> = {
  none: noFitReason,
  exponent: msg(
    'Pressure exponent other than 1: the burn rate per pressure depends on the pressure, so there is no single curve.',
  ),
  unresolved: msg(
    'Fit unresolved: the interval of the fitted vivacity (plus and minus {factor} standard uncertainties) reaches 0, so the powder is not placed.',
  ),
}

/** Powders without a curve in groups by kind, in the order of `unfitTitles`; empty groups left out. */
export function unfittedGroups(powders: readonly UnfittedPowder[]) {
  return (Object.keys(unfitTitles) as UnfitKind[])
    .map((kind) => ({ kind, powders: powders.filter((p) => p.kind === kind) }))
    .filter((g) => g.powders.length > 0)
}

/** A row of the powder list: the summary, the order scalar and the burn-rate order among all fitted powders. */
export interface PowderRow {
  id: string
  /** `user`: a powder of the browser, a Mine row. */
  origin?: 'user' | undefined
  /** Id of the manufacturer record. */
  manufacturer: string
  manufacturerName: string
  /** Other names of the manufacturer, searched by the list. */
  manufacturerAliases?: string[]
  name: string
  grainForm?: string | undefined
  propellantBase?: string | undefined
  /** Mean dynamic vivacity with its interval, 1/(MPa s); absent without a curve. */
  meanVivacity?: number | undefined
  low?: number | undefined
  high?: number | undefined
  /** 1 for the fastest fitted powder; kept when a filter hides others. */
  burnRateOrder?: number
}

/** The list rows of `summaries` in their order, each fitted powder with its global order. */
export function orderPowders(
  summaries: readonly (PowderSummary & {
    manufacturerName: string
    manufacturerAliases?: string[]
  })[],
): PowderRow[] {
  const rows = summaries.map((s): PowderRow => {
    const p = classifyPowder(s)
    const row: PowderRow = {
      id: s.id,
      manufacturer: s.manufacturer,
      manufacturerName: s.manufacturerName,
      ...(s.manufacturerAliases && { manufacturerAliases: s.manufacturerAliases }),
      name: s.name,
      grainForm: s.grainForm,
      propellantBase: s.propellantBase,
    }
    if (!isFitted(p)) return row
    const m = meanRate(p)
    // 3 decimals: the list shows 2, and the page carries the numbers as text
    const r3 = (x: number | undefined) => (x === undefined ? undefined : Number(x.toFixed(3)))
    return { ...row, meanVivacity: r3(m.value), low: r3(m.low), high: r3(m.high) }
  })
  const placed = rows.filter((r) => r.meanVivacity !== undefined)
  placed.sort((a, b) => (b.meanVivacity ?? 0) - (a.meanVivacity ?? 0))
  for (const [i, r] of placed.entries()) r.burnRateOrder = i + 1
  return rows
}

/**
 * The order of powder `id` among the placed rows (1 the fastest) with up to `n` faster and `n`
 * slower powders, nearest first; undefined for a powder without an order.
 */
export function neighbours(rows: readonly PowderRow[], id: string, n = 5) {
  const placed = rows
    .filter((r) => r.burnRateOrder !== undefined)
    .sort((a, b) => (a.burnRateOrder ?? 0) - (b.burnRateOrder ?? 0))
  const at = placed.findIndex((r) => r.id === id)
  if (at < 0) return
  return {
    order: at + 1,
    total: placed.length,
    faster: placed.slice(Math.max(0, at - n), at).reverse(),
    slower: placed.slice(at + 1, at + 1 + n),
  }
}

/** Powders in the overlay at once. */
export const maxOverlay = 6

/** A powder of the overlay and its colour slot. */
export type OverlayPick = { id: string; slot: number }

/** The overlay of the URL's `?add=`: its ids in order, deduplicated, at most `max`, colour slots by place. */
export function overlayFrom(search: string, max: number): OverlayPick[] {
  const add = (new URLSearchParams(search).get('add') ?? '').split(',').filter(Boolean)
  return [...new Set(add)].slice(0, max).map((id, slot) => ({ id, slot }))
}

/** URL of `/powders/burn-rates` with `?add=` set to the comma-separated ids, no query for none. */
export const overlayHref = (ids: readonly string[]) =>
  `/powders/burn-rates${ids.length > 0 ? `?add=${ids.join(',')}` : ''}`

/** A log scale of burn rates, 1/(MPa s), its ends on the 1, 2, 5 steps. */
export type RateDomain = [number, number]

const steps = [1, 2, 5]
const near = 1 + 1e-9

/** The 1, 2, 5 step at or below `v` (`dir` -1) or at or above it (`dir` 1). */
function step(v: number, dir: -1 | 1): number {
  const e = 10 ** Math.floor(Math.log10(v))
  const at = steps.map((s) => s * e)
  return dir < 0
    ? (at.findLast((s) => s <= v * near) ?? e)
    : (at.find((s) => s * near >= v) ?? 10 * e)
}

/** The scale over the lows and highs (else the means) of the fitted rows. */
export function rateDomain(rows: readonly PowderRow[]): RateDomain {
  const values = rows
    .flatMap((r) => [r.low ?? r.meanVivacity, r.high ?? r.meanVivacity])
    .filter((v): v is number => v !== undefined && v > 0)
  if (values.length === 0) return [1, 10]
  const lo = step(Math.min(...values), -1)
  const hi = step(Math.max(...values), 1)
  return [lo, hi > lo ? hi : step(lo * 1.5, 1)]
}

/** The ticks of the scale: every 1, 2, 5 step from end to end. */
export function rateTicks([lo, hi]: RateDomain): number[] {
  const ticks: number[] = []
  for (let e = 10 ** Math.floor(Math.log10(lo)); e <= hi * near; e *= 10)
    for (const s of steps) {
      const t = Number((s * e).toPrecision(3))
      if (t * near >= lo && t <= hi * near) ticks.push(t)
    }
  return ticks
}

/** Where `v` sits on the scale, 0 to 1; values outside it at its ends. */
export function rateAt([lo, hi]: RateDomain, v: number): number {
  const f = (Math.log(Math.max(v, Number.MIN_VALUE)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))
  return Math.min(1, Math.max(0, f))
}
