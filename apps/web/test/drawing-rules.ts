// Layout rules of the drawing checks on the verified records:
// each takes one laid-out side and returns its broken rules, so a test can break one on purpose

import { readdirSync, readFileSync } from 'node:fs'
import {
  arrowheadCorners,
  boxDistance,
  face,
  fullSection,
  headFace,
  type Label,
  type Layout,
  type LengthUnit,
  labelCorners,
  labelText,
  type PartPoint,
  type Profile,
  polygonsOverlap,
  steelBand,
} from '@openreloading/drawing'
import type { FigureModel } from '@openreloading/drawing/cartridge'
import type { SpecValue } from '@openreloading/schema'
import type { CartridgeDetail } from '../src/lib/api-types.ts'
import { drawable } from '../src/lib/cartridge-sheet.ts'

/** A cartridge record as the drawing reads it: `id` is its C.I.P. sheet id. */
export interface SpecRecord {
  id: string
  standard: string
  table?: string
  verification?: string
  values: SpecValue[]
}

const dir = new URL('../../../packages/data/records/cartridges/', import.meta.url)
/** The CIP records whose every value was checked by hand against the sheet. */
export const verified: SpecRecord[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as CartridgeDetail)
  .filter((c) => c.verification === 'verified')
  .map((c) => ({ ...drawable(c), verification: c.verification }))
  .sort((a, b) => (a.id < b.id ? -1 : 1))

export interface Laid {
  side: 'cartridge' | 'chamber'
  p: Profile
  layout: Layout
  /** The drawn dash-dot axis, z from and to. */
  axis: [number, number]
  /** Text size of the medium, mm. */
  em: number
  /** The record's values and the figure's table VII variant. */
  values: SpecValue[]
  variant?: string
  /** The unit of the length texts, mm by default. */
  unit?: LengthUnit
}

/** Distance from p to the segment from a to b. */
function segDistance([x, y]: PartPoint, [ax, ay]: PartPoint, [bx, by]: PartPoint) {
  const [dx, dy] = [bx - ax, by - ay]
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}

const polyDistance = (q: PartPoint, line: PartPoint[]) =>
  Math.min(...line.slice(1).map((b, n) => segDistance(q, line[n], b)))

/** Every value text shows the record's stored value of its symbol, side and variant. */
export function storedValues({ side, p, layout, values, variant, unit }: Laid) {
  const failures: string[] = []
  const { dimensions, angles, radii } = p.annotation
  for (const d of [...dimensions, ...angles, ...radii]) {
    if ('derived' in d && d.derived) continue
    const v = values.find(
      (x) =>
        x.side === side &&
        x.symbol === d.symbol &&
        x.value !== undefined &&
        (!x.variant || x.variant === variant),
    )
    const texts = layout.labels.filter((l) => l.owner === d.symbol).map((l) => l.text)
    const want = v && labelText({ ...d, value: v.value as number }, unit)
    if (!want) failures.push(`${d.symbol} not stored`)
    else if (texts.length !== 1 || texts[0] !== want)
      failures.push(`${d.symbol} text ${texts.join('|') || 'missing'}, stored ${want}`)
  }
  return failures
}

/** The strokes an extension line may start from: the outline, axis, steel edge, head face. */
function strokes({ side, p, em, axis }: Laid): PartPoint[][] {
  const section = fullSection(p.points)
  const mirrored = [[...section, section[0]], axis.map((z): PartPoint => [z, 0])]
  if (side === 'cartridge') return mirrored
  const head = headFace(p.points, p.annotation)
  return [
    ...mirrored,
    ...steelBand(p.points, em).sides.map((s) => s.stroke),
    ...(head ? [head] : []),
  ]
}

/** Each extension line of a length or diameter starts within its gap of a drawn stroke. */
export function extensionStarts(laid: Laid) {
  const owners = new Set(laid.p.annotation.dimensions.map((d) => d.symbol))
  const lines = strokes(laid)
  return laid.layout.segs
    .filter((s) => s.kind === 'thin' && !s.leader && owners.has(s.owner))
    .flatMap((s) => {
      const off = Math.min(...lines.map((line) => polyDistance(s.a, line)))
      return off > face.extensionGap + 0.01
        ? [`${s.owner} extension line starts ${off.toFixed(3)} mm off the outline`]
        : []
    })
}

/** No length or diameter of zero length, as stored or as drawn. */
export function nonZero({ p, layout }: Laid) {
  return [
    ...p.annotation.dimensions
      .filter((d) => d.kind !== 'diameter' && Math.abs(d.to - d.from) < 0.01)
      .map((d) => `${d.symbol} spans ${d.to - d.from} mm`),
    ...layout.spans.filter((s) => s.length < 0.01).map((s) => `${s.owner} drawn ${s.length} mm`),
    ...layout.diameterTips
      .filter(({ tips: [a, b] }) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01)
      .map((x) => `${x.owner} diameter of zero length`),
  ]
}

/** Every leader ends at its text, within 0.2 em of the box. */
export function leaderEnds({ layout, em }: Laid) {
  return layout.segs
    .filter((s) => s.leader)
    .flatMap((s) => {
      const texts = layout.labels.filter((l) => l.owner === s.owner)
      const off = Math.min(...texts.map((l) => boxDistance(l, s.b)))
      return off > 0.2 * em ? [`${s.owner} leader ends ${off.toFixed(3)} mm off its text`] : []
    })
}

/** No arrowhead on a text of another owner or on an arrowhead of another owner. */
export function arrowheadsClear({ layout }: Laid) {
  const failures: string[] = []
  const tips = layout.arrowheads.map((t) => ({ owner: t.owner, corners: arrowheadCorners(t) }))
  tips.forEach((t, k) => {
    for (const l of layout.labels as Label[])
      if (l.owner !== t.owner && polygonsOverlap(t.corners, labelCorners(l)))
        failures.push(`${t.owner} arrowhead on ${l.owner} text`)
    for (const u of tips.slice(k + 1))
      if (u.owner !== t.owner && polygonsOverlap(t.corners, u.corners))
        failures.push(`${t.owner} arrowhead on ${u.owner} arrowhead`)
  })
  return [...new Set(failures)]
}

/** Screen text height in CSS px with the page column `column` px wide, as the SVG scales. */
const textPx = (model: Pick<FigureModel, 'em' | 'frame'>, column: number) =>
  model.em * Math.min(face.pxPerMm, column / model.frame[2])

/** Screen text at least `face.minTextPx` high in the columns of a 390 and a 1280 px page. */
export function textSize(model: Pick<FigureModel, 'em' | 'frame'>) {
  return [face.phoneColumn, 1120].flatMap((column) =>
    textPx(model, column) < face.minTextPx - 1e-9
      ? [`text ${textPx(model, column).toFixed(2)} px in a ${column} px column`]
      : [],
  )
}

export const sideRules = { storedValues, extensionStarts, nonZero, leaderEnds, arrowheadsClear }
