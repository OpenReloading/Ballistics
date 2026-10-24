/**
 * Burn-rate charts from fitted M3 parameters (`apps/docs/docs/models/interior-burn-forms.md`, "Dynamic vivacity"): dynamic vivacity
 * in 1/(MPa s), interval plus and minus `uncertaintyFactor` standard uncertainties of the fitted vivacity.
 */

import { dynamicVivacity, meanDynamicVivacity, type VivacityBurn } from '@open-reloading/core'
import type { Powder } from '@open-reloading/schema'
import type { PowderSummary } from './api-types.ts'
import { type ManufacturerNames, productLabel } from './manufacturers.ts'
import { formatNumber } from './units.ts'

/** Dash pattern per colour slot of the burn-rate charts: identity is not carried by colour alone. */
export const dashes = ['', '8 4', '2 3', '12 3 3 3', '4 4', '1 5'] as const

/** Number of standard uncertainties in the vivacity interval (2). */
export const uncertaintyFactor = 2

/** A powder with a curve: its burn law in SI and the relative interval of the fitted vivacity. */
export interface FittedPowder {
  id: string
  label: string
  /** Id of the manufacturer record; empty for typed parameters. */
  manufacturer: string
  form?: string
  base?: string
  burn: VivacityBurn
  /** `uncertaintyFactor` times sigma / vivacity; absent when the record has no sigma. */
  spread?: number
}

/** Why a powder has no curve: no fit, a pressure exponent other than 1, an interval reaching 0. */
type UnfitKind = 'none' | 'exponent' | 'unresolved'

export interface UnfittedPowder {
  id: string
  label: string
  kind: UnfitKind
  reason: string
  /** The powder's own numbers behind `kind`, for a list grouped by kind. */
  detail?: string
}

interface RateInterval {
  value: number
  low?: number
  high?: number
}

const noFitReason =
  'No fitted parameters: the load-table fit gives parameters only to powders with at least 10 training rows from at least 2 cartridges.'

/** What `classifyPowder` reads: a powder record or a list summary, with its manufacturer's name where known. */
type BurnSource = Pick<Powder, 'id' | 'manufacturer' | 'name' | 'grainForm' | 'propellantBase'> & {
  manufacturerName?: string
  interior?: PowderSummary['interior']
}

/** Why a powder with a fitted pressure exponent `exponent` other than 1 has no curve. */
const exponentReason = (exponent: number) =>
  `Pressure exponent ${exponent}, not 1: the burn rate per pressure depends on the pressure, so there is no single curve.`

/** Why the powder has no curve: no fit, an exponent other than 1, an interval reaching 0; none when it has one. */
function unfitReason(p: BurnSource, label: string): UnfittedPowder | undefined {
  const i = p.interior
  if (!i) return { id: p.id, label, kind: 'none', reason: noFitReason }
  if (i.pressureExponent !== 1)
    return {
      id: p.id,
      label,
      kind: 'exponent',
      reason: exponentReason(i.pressureExponent),
      detail: `exponent ${i.pressureExponent}`,
    }
  const { value, standardUncertainty: sigma } = i.vivacity
  if (sigma !== undefined && uncertaintyFactor * sigma >= value)
    return {
      id: p.id,
      label,
      kind: 'unresolved',
      reason: `Fit unresolved: the interval of the fitted vivacity (${value} 1/s, plus and minus ${uncertaintyFactor} times ${sigma}) reaches 0, so the powder is not placed.`,
      detail: `vivacity ${value} 1/s, plus and minus ${uncertaintyFactor} times ${sigma}`,
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
  const unfit = unfitReason(p, label)
  if (unfit) return unfit
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
    burn: burnLawOf(value, i.referencePressure.value * 1e5, {
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
): FittedPowder | UnfittedPowder | undefined {
  const { vivacity, exponent, referencePressure, formA, formM, formQ, formZ1 } = v
  if (vivacity === undefined || exponent === undefined || referencePressure === undefined) return
  const id = 'typed'
  const label = 'Typed model parameters'
  if (exponent !== 1) return { id, label, kind: 'exponent', reason: exponentReason(exponent) }
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
export const modelCaption = 'Model output from fitted M3 parameters, not manufacturer data.'

/** What the band of a curve and the bar of a mean cover. */
export const bandNote = `plus and minus ${uncertaintyFactor} standard uncertainties of the fitted vivacity, a lower bound`

export const modelNote = `${modelCaption} Band and bars: ${bandNote}.`

const n2 = (v: number) => formatNumber(v, 2)

/** The order scalar with its interval, as text. */
function meanText(p: FittedPowder): string {
  const m = meanRate(p)
  const range =
    m.low === undefined || m.high === undefined ? '' : ` (${n2(m.low)} to ${n2(m.high)})`
  return `${n2(m.value)}${range} ${vivacityUnit}`
}

/** Text alternative of one powder's curve: start, peak, end and the mean. */
export function describeCurve(p: FittedPowder): string {
  const values = chartBurntFractions.map((z) => curveAt(p, z).value)
  const peak = values.indexOf(Math.max(...values))
  return `Dynamic vivacity of ${p.label} over burnt fraction 0 to 1: ${n2(values[0])} ${vivacityUnit} at z 0, highest ${n2(values[peak])} at z ${formatNumber(chartBurntFractions[peak], 2)}, ${n2(values.at(-1) ?? 0)} at z 1. Mean over z 0.1 to 0.9: ${meanText(p)}.`
}

/** The sentence of each group of powders without a curve. */
export const unfitTitles: Record<UnfitKind, string> = {
  none: noFitReason,
  exponent:
    'Pressure exponent other than 1: the burn rate per pressure depends on the pressure, so there is no single curve.',
  unresolved: `Fit unresolved: the interval of the fitted vivacity (plus and minus ${uncertaintyFactor} standard uncertainties) reaches 0, so the powder is not placed.`,
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
  /** Id of the manufacturer record. */
  manufacturer: string
  manufacturerName: string
  /** Other names of the manufacturer, searched by the list. */
  manufacturerAliases?: string[]
  name: string
  grainForm?: string
  propellantBase?: string
  /** ISO 3166-1 alpha-2 code of the manufacturer's country. */
  country?: string
  /** Mean dynamic vivacity with its interval, 1/(MPa s); absent without a curve. */
  meanVivacity?: number
  low?: number
  high?: number
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
      country: s.country,
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
