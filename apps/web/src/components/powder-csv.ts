import { fromSi, toSi } from '@open-reloading/schema'
import { canonicalNumberText, formatNumber } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
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

/** A heading with its unit: "Charge (gr)"; a soft hyphen of the German text stays out. */
const head = (name: string, unit: string) => `${name} (${unit})`.replaceAll('\u00AD', '')

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
    // the reason in the Flags column, the other cells empty: every row has the header's cells
    if (!v)
      return [
        productLabel(r),
        charge,
        t('Not computed: {reason}', { reason: reason(r) }),
        ...Array<string>(header.length - 3).fill(''),
      ]
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
  return toCsv([header, ...body]).replaceAll('\u00AD', '')
}

/** The tab's controls as the page holds them. */
export type PowderTabState = {
  kind: CompareMode['kind']
  fill: number | string
  /** As typed, in the unit of `percent`. */
  targetText: number | string
  /** The pressure in Pa shown as `text` after a unit switch or a restore: read while `targetText` is still `text`. */
  targetKept?: { text: number | string; si: number } | undefined
  /** The target is a share of the cartridge's CIP Pmax. */
  percent: boolean
  filters: PowderFilters
  /** The manufacturer id of a kept filter whose name is not known yet (names load after the tab). */
  maker?: string | undefined
}

const noFilters: PowderFilters = { manufacturerName: '', base: '', form: '' }

export const initialPowderTab: PowderTabState = {
  kind: 'typed',
  fill: caseFillPercentRange.initial,
  targetText: '',
  percent: false,
  filters: noFilters,
}

const validNumber = (x: number | string) =>
  typeof x === 'number' ? x : x.trim() === '' ? Number.NaN : Number(x)

type TargetState = Pick<PowderTabState, 'targetText' | 'targetKept' | 'percent'>

/** The pressure target in Pa: the kept one while the text is unchanged, else the text read in `system`. */
export function targetPressure(s: TargetState, system: UnitSystem): number | undefined {
  if (s.percent) return undefined
  if (s.targetKept?.text === s.targetText) return s.targetKept.si
  const target = validNumber(s.targetText)
  return Number.isFinite(target) && target > 0 ? system.pressure.toSi(target) : undefined
}

const shownPressure = (si: number, system: UnitSystem) =>
  Number(system.pressure.fromSi(si).toFixed(system.pressure.decimals))

/** The target after the units changed from `from` to `to`: a typed pressure shows in the new unit. */
export function switchedTarget(
  s: TargetState,
  from: UnitSystem,
  to: UnitSystem,
): Pick<PowderTabState, 'targetText' | 'targetKept'> {
  const si = targetPressure(s, from)
  if (si === undefined || from.pressure === to.pressure)
    return { targetText: s.targetText, targetKept: s.targetKept }
  const targetText = shownPressure(si, to)
  return { targetText, targetKept: { text: targetText, si } }
}

/**
 * The tab's state as the load keeps it; none while every control has its first value. The
 * manufacturer filter is kept by reference: `idOf` gives the id of a manufacturer name.
 */
export function savedPowderTab(
  s: PowderTabState,
  system: UnitSystem,
  idOf: (name: string) => string | undefined = () => undefined,
): SavedPowderTab | undefined {
  const maker = s.filters.manufacturerName ? idOf(s.filters.manufacturerName) : s.maker
  const fill = validNumber(s.fill)
  const target = validNumber(s.targetText)
  const hasFill = fill >= caseFillPercentRange.min && fill <= caseFillPercentRange.max
  const hasTarget = Number.isFinite(target) && target > 0
  const pressure = targetPressure(s, system) ?? 0
  const saved: SavedPowderTab = {
    mode: s.kind,
    ...(hasFill && fill !== caseFillPercentRange.initial && { fill }),
    ...(hasTarget && s.percent && { targetPercent: target }),
    ...(pressure > 0 && { targetPressure: fromSi('pressure', pressure) }),
    ...(maker && { manufacturer: `catalogue:${maker}` }),
    ...(s.filters.base && { base: s.filters.base }),
    ...(s.filters.form && { form: s.filters.form }),
  }
  return Object.keys(saved).length === 1 && s.kind === 'typed' ? undefined : saved
}

/** The tab's controls from what a load kept; the first values without it. */
export function restoredPowderTab(
  saved: SavedPowderTab | undefined,
  system: UnitSystem,
  names: ReadonlyMap<string, string> = new Map(),
): PowderTabState {
  if (!saved) return initialPowderTab
  const si = saved.targetPressure === undefined ? undefined : toSi('pressure', saved.targetPressure)
  const targetText = saved.targetPercent ?? (si === undefined ? '' : shownPressure(si, system))
  const maker = saved.manufacturer?.replace(/^catalogue:/, '')
  return {
    maker,
    kind: saved.mode,
    fill: saved.fill ?? caseFillPercentRange.initial,
    targetText,
    targetKept:
      saved.targetPercent === undefined && si !== undefined ? { text: targetText, si } : undefined,
    percent: saved.targetPercent !== undefined,
    filters: {
      manufacturerName: (maker && names.get(maker)) ?? '',
      base: saved.base ?? '',
      form: saved.form ?? '',
    },
  }
}
