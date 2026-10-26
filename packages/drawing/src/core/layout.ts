import * as face from './face.ts'
import type { PartPoint } from './section.ts'
import { textWidth } from './text.ts'
import type { Layout, Profile } from './types.ts'
import { type LengthUnit, perUnit, scaleLength, unitNote } from './units.ts'

/** The sides of one figure, each with its profile. */
export type Drawn<Side extends string = string, P extends Profile = Profile> = {
  side: Side
  p: P
}[]

/** Screen: the part frame turned -90 deg (head at the bottom); print: unturned. */
export type Medium = 'screen' | 'print'

/** The part frame direction that reads level on the medium. */
export const readingDirection = (medium: Medium): PartPoint =>
  medium === 'screen' ? [0, 1] : [1, 0]

/**
 * The dash-dot axis of a side: from 1 mm behind the head to 2 mm past the part, or on to the
 * stations dimensioned past it (S, L6 short of the break) plus the overrun.
 */
export function axisReach(p: Profile): [number, number] {
  const zMax = Math.max(...p.points.map(([, z]) => z))
  const reach = p.annotation.dimensions
    .filter((d) => d.kind !== 'diameter' && d.to <= zMax + face.breakAllowance * zMax)
    .map((d) => d.to)
  return [-1, Math.max(zMax + 2, ...reach.map((z) => z + face.overrun))]
}

/** Width of the drawing across the medium's page direction, in mm, with its margins. */
export const frameWidth = (
  box: Layout['box'],
  medium: Medium,
  em: number,
  unit: LengthUnit = 'mm',
) =>
  Math.max(
    (medium === 'screen' ? box[3] - box[1] : box[2] - box[0]) + 2 * face.frameMargin,
    textWidth(unitNote(unit), em) + 2 * face.frameMargin,
  )

/**
 * The smallest text size of at least 1.8 mm that renders 11 CSS px when the widest figure
 * (`widest(em)`, its frame width in mm) fills the 358 px phone column (8 px per mm at most): the
 * width is near linear in the text size, so two layouts give it in closed form; a last check steps
 * up where it is not.
 */
export function fitEm(widest: (em: number) => number) {
  const px = (em: number, w = widest(em)) => em * Math.min(face.pxPerMm, face.phoneColumn / w)
  const e1 = face.minEm
  const w1 = widest(e1)
  if (px(e1, w1) >= face.minTextPx) return e1
  // the layout is linear only between label moves: the slope comes from a nearby size
  const e2 = 1.15 * e1
  const b = (widest(e2) - w1) / (e2 - e1)
  const a = w1 - b * e1
  const room = face.phoneColumn - face.minTextPx * b
  let em = Math.ceil(Math.max(e1, room > 0 ? (face.minTextPx * a) / room : e1) * 1000) / 1000
  for (let n = 0; n < 60 && px(em) < face.minTextPx - 1e-9; n++) em = Math.ceil(em * 1020) / 1000
  return em
}

/** The scale bar and the unit note, in the outer frame. */
export interface ScaleBar {
  x: number
  y: number
  /** In mm. */
  length: number
  /** The bar's text: its length in the unit, "10 mm" or "0.5 in". */
  label: string
  text: [number, number]
  /** "Dimensions in mm" or "Dimensions in inches". */
  note: string
}

/**
 * The outer frame (x, y, width, height in mm) around the part-frame box of the layout, at least
 * `across` mm across the medium's page direction, with the scale bar strip below.
 */
export function figureFrame(
  box: [number, number, number, number],
  medium: Medium,
  em: number,
  across: number,
  unit: LengthUnit = 'mm',
): { frame: [number, number, number, number]; scale: ScaleBar } {
  const m = face.frameMargin
  // the outer frame: screen x = part y, screen y = -part x
  let [x0, y0, x1, y1] = medium === 'screen' ? [box[1], -box[2], box[3], -box[0]] : box
  x0 -= m
  y0 -= m
  x1 += m
  y1 += m
  const note = unitNote(unit)
  const w = Math.max(x1 - x0, across, textWidth(note, em) + 2 * m)
  const strip = 2.6 * em
  const bar = scaleLength(w - 2 * m - textWidth(unit === 'mm' ? '00 mm' : '0.0 in', em) - em, unit)
  return {
    frame: [x0, y0, w, y1 - y0 + strip],
    scale: {
      x: x0 + m,
      y: y1 - m / 2 + 0.6 * em,
      length: bar * perUnit[unit],
      label: `${unit === 'mm' ? bar : String(bar).replace(/^0\./, '.')} ${unit}`,
      text: [x0 + m, y1 - m / 2 + 1.9 * em],
      note,
    },
  }
}
