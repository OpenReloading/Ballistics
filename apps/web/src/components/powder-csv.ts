import { fromSi, toSi } from '@open-reloading/schema'
import { canonicalNumberText, formatNumber } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
import { targetUnit } from '../lib/charge-target.ts'
import { toCsv } from '../lib/csv.ts'
import { productLabel } from '../lib/manufacturers.ts'
import {
  type CompareMode,
  caseFillPercentRange,
  type PowderFilters,
} from '../lib/powder-compare.ts'
import { lengthText, type UnitSystem } from '../lib/units.ts'
import type { CompareRow } from './use-powder-compare.ts'
import type { SavedPowderTab } from './use-powder-tab.ts'

type T = Translator['t']

/** A number with the point a file and a spreadsheet read, whatever the language shown. */
const plain = (x: number, digits: number) => formatNumber(x, digits, 'en')

/** A heading with its unit: "Charge (gr)". */
const head = (name: string, unit: string) => `${name} (${unit})`

/**
 * The Powders table as CSV: its columns with the units of its header, one row per powder in the
 * order shown. A powder not computed has its reason in the Flags column, as the table words it.
 */
export function powderTableCsv(
  rows: readonly CompareRow[],
  target: boolean,
  system: UnitSystem,
  t: T,
  reason: (r: CompareRow) => string,
) {
  const pressure = (pa: number) => plain(system.pressure.fromSi(pa), system.pressure.decimals)
  const header = [
    t('Powder'),
    head(t('Charge'), system.charge.symbol),
    t('Flags'),
    ...(target
      ? [
          head(t('Pressure range, low'), system.pressure.symbol),
          head(t('Pressure range, high'), system.pressure.symbol),
        ]
      : [head(t('Peak pressure'), system.pressure.symbol)]),
    head(t('Percent of maximum'), '%'),
    head(t('Muzzle velocity'), system.velocity.symbol),
    head(t('Case fill'), '%'),
    head(t('Burnt at the muzzle'), '%'),
    head(t('Burnout'), system.length.symbol),
  ]
  const body = rows.map((r) => {
    const charge =
      r.charge === undefined ? '' : plain(system.charge.fromSi(r.charge), system.charge.decimals)
    const v = r.values
    if (!v) return [productLabel(r), charge, t('Not computed: {reason}', { reason: reason(r) })]
    return [
      productLabel(r),
      charge,
      r.flagText?.(t) ?? '',
      ...(target ? [pressure(v.range.low), pressure(v.range.high)] : [pressure(v.peak)]),
      v.percent === undefined ? '' : plain(v.percent, 0),
      plain(system.velocity.fromSi(v.velocity), system.velocity.decimals),
      r.ratio === undefined ? '' : plain(r.ratio * 100, 0),
      plain(v.burnt * 100, 0),
      v.burnout === undefined
        ? t('none')
        : canonicalNumberText(lengthText('travel', system, v.burnout)),
    ]
  })
  return toCsv([header, ...body])
}

/** The tab's controls as the page holds them. */
export type PowderTabState = {
  kind: CompareMode['kind']
  fill: number | string
  /** As typed, in the unit of `percent`. */
  targetText: number | string
  /** The target is a share of the cartridge's CIP Pmax. */
  percent: boolean
  filters: PowderFilters
}

export const noFilters: PowderFilters = { manufacturerName: '', base: '', form: '' }

export const initialPowderTab: PowderTabState = {
  kind: 'typed',
  fill: caseFillPercentRange.initial,
  targetText: '',
  percent: false,
  filters: noFilters,
}

const validNumber = (x: number | string) =>
  typeof x === 'number' ? x : x.trim() === '' ? Number.NaN : Number(x)

/** The tab's state as the load keeps it; none while every control has its first value. */
export function savedPowderTab(s: PowderTabState, system: UnitSystem): SavedPowderTab | undefined {
  const fill = validNumber(s.fill)
  const target = validNumber(s.targetText)
  const hasFill = fill >= caseFillPercentRange.min && fill <= caseFillPercentRange.max
  const hasTarget = Number.isFinite(target) && target > 0
  const pressure = hasTarget && !s.percent ? targetUnit('peakPressure', system).toSi(target) : 0
  const saved: SavedPowderTab = {
    mode: s.kind,
    ...(hasFill && fill !== caseFillPercentRange.initial && { fill }),
    ...(hasTarget && s.percent && { targetPercent: target }),
    ...(pressure > 0 && { targetPressure: fromSi('pressure', pressure) }),
    ...(s.filters.manufacturerName && { manufacturer: s.filters.manufacturerName }),
    ...(s.filters.base && { base: s.filters.base }),
    ...(s.filters.form && { form: s.filters.form }),
  }
  return Object.keys(saved).length === 1 && s.kind === 'typed' ? undefined : saved
}

/** The tab's controls from what a load kept; the first values without it. */
export function restoredPowderTab(
  saved: SavedPowderTab | undefined,
  system: UnitSystem,
): PowderTabState {
  if (!saved) return initialPowderTab
  const unit = targetUnit('peakPressure', system)
  const targetText =
    saved.targetPercent ??
    (saved.targetPressure === undefined
      ? ''
      : Number(unit.fromSi(toSi('pressure', saved.targetPressure)).toFixed(unit.decimals)))
  return {
    kind: saved.mode,
    fill: saved.fill ?? caseFillPercentRange.initial,
    targetText,
    percent: saved.targetPercent !== undefined,
    filters: {
      manufacturerName: saved.manufacturer ?? '',
      base: saved.base ?? '',
      form: saved.form ?? '',
    },
  }
}
