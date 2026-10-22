/** Bullets side by side: the rows in the preset, the difference marks, one drawing scale. */
import { face, type LengthUnit } from '@openreloading/drawing'
import {
  type BulletModel,
  type BulletProfile,
  bulletFigureModel,
  bulletScreenEm,
} from '@openreloading/drawing/bullet'
import type { BulletRecord } from './api-types.ts'
import {
  ballisticCoefficientRows,
  bulletDataGroups,
  type FieldGroup,
  rowLabel,
  rowParts,
  turnPrefix,
} from './record-fields.ts'
import type { UnitSystem } from './units.ts'

/** A row of the comparison: one value per bullet as shown in the preset, undefined where absent. */
interface CompareRow {
  label: string
  symbol?: string
  unit: string
  values: (string | undefined)[]
}

/** A titled group of compared rows. */
interface CompareGroup {
  title: string
  rows: CompareRow[]
}

const groupOrder = ['Size', 'Shape', 'Tip and base', 'Build', 'Twist', 'Computed']

/**
 * The bullets' data tables merged: the groups of the bullet record's data table, then the
 * ballistic coefficients, each row once in the order first met (a repeated label once per
 * repeat), a value per bullet where its record has the row.
 */
export function compareGroups(bullets: BulletRecord[], system: UnitSystem): CompareGroup[] {
  // the groups in `bulletDataGroups` order, also where the first bullet lacks one
  const groups = new Map<string, Map<string, CompareRow>>(
    [...groupOrder, 'Ballistic coefficients'].map((t) => [t, new Map()]),
  )
  bullets.forEach((b, i) => {
    const own: FieldGroup[] = [
      ...bulletDataGroups(b),
      { title: 'Ballistic coefficients', rows: ballisticCoefficientRows(b) },
    ]
    for (const g of own) {
      const title = g.title ?? ''
      const rows = groups.get(title) ?? new Map<string, CompareRow>()
      groups.set(title, rows)
      const seen = new Map<string, number>()
      for (const r of g.rows) {
        const label = rowLabel(r, system)
        const n = seen.get(label) ?? 0
        seen.set(label, n + 1)
        const key = `${label}#${n}`
        const { number, unit } = rowParts(r, system)
        const row = rows.get(key) ?? {
          label,
          ...(r.symbol && { symbol: r.symbol }),
          unit,
          values: bullets.map(() => undefined),
        }
        row.values[i] = number
        rows.set(key, row)
      }
    }
  })
  return [...groups]
    .map(([title, rows]) => ({ title, rows: [...rows.values()] }))
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
