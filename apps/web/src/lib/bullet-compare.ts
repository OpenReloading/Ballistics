/** Bullets side by side: the rows in the preset, the difference marks, one drawing scale. */

import { face, type LengthUnit } from '@open-reloading/drawing'
import {
  type BulletModel,
  type BulletProfile,
  bulletFigureModel,
  bulletScreenEm,
} from '@open-reloading/drawing/bullet'
import type { Bullet } from '@open-reloading/schema'
import { msg } from '../i18n/translate.ts'
import {
  ballisticCoefficientRows,
  bulletDataGroups,
  type FieldGroup,
  type FieldRow,
  rowParts,
  turnPrefix,
} from './record-fields.ts'
import { type UnitSystem, withUnit } from './units.ts'
import type { Wording } from './wording.ts'

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
) {
  const seen = new Map<string, number>()
  for (const r of own) {
    const from =
      r.fromVelocity === undefined ? undefined : withUnit('velocity', system, r.fromVelocity)
    const label = `${keyOf(r.label)}${from === undefined ? '' : ` from ${from}`}`
    const n = seen.get(label) ?? 0
    seen.set(label, n + 1)
    const key = `${label}#${n}`
    const { number, unit } = rowParts(r, system)
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
 * The bullets' data tables merged: the groups of the bullet record's data table, then the
 * ballistic coefficients, each row once in the order first met (a repeated label once per
 * repeat), a value per bullet where its record has the row.
 */
export function compareGroups(bullets: Bullet[], system: UnitSystem): CompareGroup[] {
  // the groups in `bulletDataGroups` order, also where the first bullet lacks one
  const titles = new Map<string, Wording>()
  const groups = new Map<string, Map<string, CompareRow>>(
    [...groupOrder, msg('Ballistic coefficients')].map((t) => {
      titles.set(keyOf(t), t)
      return [keyOf(t), new Map()]
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
      mergeRows(rows, g.rows, i, bullets.length, system)
    }
  })
  return [...groups]
    .map(([title, rows]) => ({ title: titles.get(title) ?? untitled, rows: [...rows.values()] }))
    .filter((g) => g.rows.length > 0)
}

/** Whether a row's shown values are not all the same. An absent value differs from a present one. */
export const rowDiffers = (values: readonly (string | undefined)[]) => new Set(values).size > 1

/**
 * The largest and smallest of a row's shown values, compared as shown (so two values that read
 * the same are equal), a twist by its length per turn. Nothing where fewer than two values show
 * or all are the same.
 */
export function differenceMarks(shown: readonly (string | undefined)[]) {
  const xs = shown.map((s) =>
    s === undefined ? undefined : Number(s.startsWith(turnPrefix) ? s.slice(turnPrefix.length) : s),
  )
  const present = xs.filter((x): x is number => x !== undefined && Number.isFinite(x))
  const [lo, hi] = [Math.min(...present), Math.max(...present)]
  if (present.length < 2 || lo === hi) return xs.map(() => undefined)
  return xs.map((x) => (x === hi ? 'max' : x === lo ? 'min' : undefined))
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
