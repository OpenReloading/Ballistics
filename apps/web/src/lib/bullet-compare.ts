/** Bullets side by side: the rows in the preset, the difference marks, one drawing scale. */

import { face, type LengthUnit } from '@open-reloading/drawing'
import {
  type BulletModel,
  type BulletProfile,
  bulletFigureModel,
  bulletScreenEm,
} from '@open-reloading/drawing/bullet'
import type { Bullet } from '@open-reloading/schema'
import { msg, type Translator, translator } from '../i18n/translate.ts'
import {
  ballisticCoefficientRows,
  bulletDataGroups,
  type FieldGroup,
  type FieldRow,
  rowParts,
} from './record-fields.ts'
import { type UnitSystem, withUnit } from './units.ts'
import { type Wording, worded } from './wording.ts'

/** A row of the comparison: one value per bullet as shown in the preset, undefined where absent. */
interface CompareRow {
  label: Wording
  /** A coefficient's lower velocity bound, in the preset's unit, after the label. */
  from?: string
  symbol?: string | undefined
  unit: string
  values: (string | undefined)[]
}

/** A titled group of compared rows. */
interface CompareGroup {
  title: Wording
  rows: CompareRow[]
}

const groupOrder: Wording[] = [
  msg('Size'),
  msg('Shape'),
  msg('Tip and base'),
  msg('Build'),
  msg('Twist'),
  msg('Computed'),
]

const untitled: Wording = { verbatim: '' }

/** A wording as a map key: a message by its text, the others by their parts. */
const keyOf = (w: Wording) => (typeof w === 'string' ? w : JSON.stringify(w))

/** The rows of one bullet's group merged into `rows`: its value at place `at`, a repeated label once per repeat. */
function mergeRows(
  rows: Map<string, CompareRow>,
  own: FieldRow[],
  at: number,
  count: number,
  system: UnitSystem,
  t: Translator['t'],
) {
  const seen = new Map<string, number>()
  for (const r of own) {
    const from =
      r.fromVelocity === undefined ? undefined : withUnit('velocity', system, r.fromVelocity)
    const label = `${keyOf(r.label)}${from === undefined ? '' : ` from ${from}`}`
    const n = seen.get(label) ?? 0
    seen.set(label, n + 1)
    const key = `${label}#${n}`
    const { number, unit } = rowParts(r, system, t)
    const row = rows.get(key) ?? {
      label: r.label,
      ...(from !== undefined && { from }),
      ...(r.symbol && { symbol: r.symbol }),
      unit,
      values: Array.from({ length: count }, () => undefined),
    }
    row.values[at] = number
    rows.set(key, row)
  }
}

/**
 * The rows compared first, in this order, from the group they are taken out of: each by the start
 * of its key (a coefficient's key goes on with its band), the label it takes in the Key group.
 */
const keyRows: { group: Wording; key: string; label?: Wording }[] = [
  { group: msg('Size'), key: 'Mass#' },
  { group: msg('Size'), key: 'Diameter#' },
  { group: msg('Size'), key: 'Length#' },
  ...['G1', 'G7'].map((model) => ({
    group: msg('Ballistic coefficients'),
    key: keyOf({ verbatim: model }),
    label: worded(msg('BC {model}'), { model }),
  })),
  { group: msg('Computed'), key: 'Sectional density#' },
]

/** The Key group: the first row of each of `keyRows` the bullets have, taken out of its own group. */
function keyGroup(groups: Map<string, Map<string, CompareRow>>): Map<string, CompareRow> {
  const key = new Map<string, CompareRow>()
  for (const k of keyRows) {
    const rows = groups.get(keyOf(k.group))
    const found = [...(rows?.keys() ?? [])].find((r) => r.startsWith(k.key))
    const row = found === undefined ? undefined : rows?.get(found)
    if (found === undefined || !row) continue
    rows?.delete(found)
    key.set(found, k.label ? { ...row, label: k.label } : row)
  }
  return key
}

/**
 * The bullets' data tables merged: the Key group (mass, diameter, length, BC G1 and G7, sectional
 * density), then the rest of the groups of the bullet record's data table and the ballistic
 * coefficients, each row once in the order first met (a repeated label once per repeat), a value
 * per bullet where its record has the row.
 */
export function compareGroups(
  bullets: Bullet[],
  system: UnitSystem,
  t: Translator['t'] = translator().t,
): CompareGroup[] {
  // the groups in `bulletDataGroups` order, also where the first bullet lacks one
  const titles = new Map<string, Wording>()
  const groups = new Map<string, Map<string, CompareRow>>(
    [...groupOrder, msg('Ballistic coefficients')].map((title) => {
      titles.set(keyOf(title), title)
      return [keyOf(title), new Map()]
    }),
  )
  bullets.forEach((b, i) => {
    const own: FieldGroup[] = [
      ...bulletDataGroups(b),
      { title: msg('Ballistic coefficients'), rows: ballisticCoefficientRows(b) },
    ]
    for (const g of own) {
      const wording = g.title ?? untitled
      const title = keyOf(wording)
      titles.set(title, wording)
      const rows = groups.get(title) ?? new Map<string, CompareRow>()
      groups.set(title, rows)
      mergeRows(rows, g.rows, i, bullets.length, system, t)
    }
  })
  const key = keyGroup(groups)
  return [
    { title: msg('Key values') as Wording, rows: [...key.values()] },
    ...[...groups].map(([title, rows]) => ({
      title: titles.get(title) ?? untitled,
      rows: [...rows.values()],
    })),
  ].filter((g) => g.rows.length > 0)
}

/** Whether a row's shown values are not all the same. An absent value differs from a present one. */
export const rowDiffers = (values: readonly (string | undefined)[]) => new Set(values).size > 1

/** The text before a twist's length per turn in the language of `t`. */
export const turnPrefixOf = (t: Translator['t']) => t('1 turn in {length}', { length: '' })

/**
 * The largest and smallest of a row's shown values, compared as shown (so two values that read
 * the same are equal), a twist by its length per turn after `turnPrefix`. A decimal comma reads
 * as a point. Nothing where fewer than two values show or all are the same.
 */
export function differenceMarks(
  shown: readonly (string | undefined)[],
  turnPrefix = turnPrefixOf(translator().t),
) {
  const xs = shown.map((s) =>
    s === undefined
      ? undefined
      : Number((s.startsWith(turnPrefix) ? s.slice(turnPrefix.length) : s).replace(',', '.')),
  )
  const present = xs.filter((x): x is number => x !== undefined && Number.isFinite(x))
  const [lo, hi] = [Math.min(...present), Math.max(...present)]
  if (present.length < 2 || lo === hi) return xs.map(() => undefined)
  return xs.map((x) => (x === hi ? 'max' : x === lo ? 'min' : undefined))
}

/** A shown value as a number: a decimal comma reads as a point, a twist by its length per turn after `turnPrefix`. */
const shownNumber = (s: string, turnPrefix: string) =>
  Number((s.startsWith(turnPrefix) ? s.slice(turnPrefix.length) : s).replace(',', '.'))

/**
 * The difference of each value to the first bullet's, as shown: signed (minus U+2212, ±0 where
 * equal), in the decimals of the longer of the two, with the decimal mark the values use. None for
 * the first column, an absent or a non-numeric value.
 */
export function differenceToFirst(
  shown: readonly (string | undefined)[],
  turnPrefix = turnPrefixOf(translator().t),
): (string | undefined)[] {
  const [first] = shown
  const base = first === undefined ? Number.NaN : shownNumber(first, turnPrefix)
  const decimals = (s: string) => s.match(/[.,](\d+)$/)?.[1]?.length ?? 0
  const difference = (s: string | undefined, i: number): string | undefined => {
    if (i === 0 || s === undefined || first === undefined) return undefined
    const x = shownNumber(s, turnPrefix)
    if (!Number.isFinite(x) || !Number.isFinite(base)) return undefined
    const digits = Math.max(decimals(s), decimals(first))
    const d = Number((x - base).toFixed(digits))
    const text = Math.abs(d).toFixed(digits)
    const marked = s.includes(',') || first.includes(',') ? text.replace('.', ',') : text
    return d === 0 ? `±${marked}` : `${d < 0 ? '−' : '+'}${marked}`
  }
  return shown.map(difference)
}

/**
 * Height in CSS px the tallest drawing gets at 1280 x 800: the window less `--drawing-chrome` of
 * `.compare-view` (30rem: the bar, the drawings panel's head and names, and the first rows of the
 * table below it).
 */
const compareDrawingPx = 800 - 30 * 16

/**
 * One text size and one frame width for every drawing, so one scale on screen: the largest of
 * their own sizes, raised until the tallest frame fitted to `fitPx` still shows 11 px text (a long
 * bullet beside short ones would otherwise need more height than the window has).
 */
export function sharedScale(
  profiles: readonly BulletProfile[],
  fitPx = compareDrawingPx,
  unit: LengthUnit = 'mm',
): { models: BulletModel[]; tallest: number } {
  let em = Math.max(...profiles.map((p) => bulletScreenEm(p, unit)))
  const laid = () => {
    const across = Math.max(
      ...profiles.map((p) => bulletFigureModel(p, 'screen', em, 0, unit).frame[2]),
    )
    const models = profiles.map((p) => bulletFigureModel(p, 'screen', em, across, unit))
    return { models, tallest: Math.max(...models.map((m) => m.frame[3])) }
  }
  let out = laid()
  for (let n = 0; n < 30 && (em * fitPx) / out.tallest < face.minTextPx; n++) {
    em = Math.ceil(em * 1100) / 1000
    out = laid()
  }
  return out
}
