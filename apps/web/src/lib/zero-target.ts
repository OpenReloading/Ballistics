/**
 * The printable zero target: an A4 sheet in mm (y down from the top left) with four corner marks
 * whose centres span a known rectangle for the photo calibration, a 10 mm grid, a centre cross with
 * a black aiming square, a 100 mm check bar, a field row and a footer. Pure: no React, DOM or
 * Next.js.
 */
import type { ShotGroup } from '@open-reloading/schema'
import { plainNumber } from '../i18n/number.ts'
import type { Point } from './target-geometry.ts'

export const page = { width: 210, height: 297 }
/** Distance of the corner mark centres across and down, mm. */
export const markSpacing = { width: 160, height: 240 }
export const gridPitch = 10
export const targetId = 'zero-a4'
export const formatVersion = 1
/** Length of the check bar, mm. */
const barLength = 100

const centre: Point = { x: page.width / 2, y: page.height / 2 }
const left = centre.x - markSpacing.width / 2
const top = centre.y - markSpacing.height / 2
const right = left + markSpacing.width
const bottom = top + markSpacing.height

/** Centres of the corner marks, mm: top left, top right, bottom right, bottom left. */
export const markCentres: readonly [Point, Point, Point, Point] = [
  { x: left, y: top },
  { x: right, y: top },
  { x: right, y: bottom },
  { x: left, y: bottom },
]

type Line = { x1: number; y1: number; x2: number; y2: number; width: number; colour: string }
type Ring = { cx: number; cy: number; r: number; width: number }
type Rect = { x: number; y: number; w: number; h: number; colour: string }

const grey = '#999'
const black = '#000'
const white = '#fff'
const markRadius = 5
const squareSide = 25

/**
 * The drawing of the sheet, mm. The marks are thin rings with a cross, the top left one with a
 * second ring inside, so no mark prints as a filled spot of a hole's size.
 */
export function zeroTargetShapes(): { lines: Line[]; rings: Ring[]; rects: Rect[] } {
  const lines: Line[] = []
  const rings: Ring[] = []
  // the grid stops one pitch inside the marks, so the marks stand clear
  const [x0, x1, y0, y1] = [
    left + gridPitch,
    right - gridPitch,
    top + gridPitch,
    bottom - gridPitch,
  ]
  for (let x = x0; x <= x1 + 1e-9; x += gridPitch)
    lines.push({ x1: x, y1: y0, x2: x, y2: y1, width: 0.15, colour: grey })
  for (let y = y0; y <= y1 + 1e-9; y += gridPitch)
    lines.push({ x1: x0, y1: y, x2: x1, y2: y, width: 0.15, colour: grey })
  // the cross runs up to the square: its arms point at the centre
  lines.push({ x1: x0, y1: centre.y, x2: x1, y2: centre.y, width: 0.5, colour: black })
  lines.push({ x1: centre.x, y1: y0, x2: centre.x, y2: y1, width: 0.5, colour: black })
  const half = squareSide / 2
  const rects: Rect[] = [
    { x: centre.x - half, y: centre.y - half, w: squareSide, h: squareSide, colour: black },
    { x: centre.x - barLength / 2, y: 279.5, w: barLength, h: 1.5, colour: black },
  ]
  markCentres.forEach((c, i) => {
    rings.push({ cx: c.x, cy: c.y, r: markRadius, width: 0.5 })
    if (i === 0) rings.push({ cx: c.x, cy: c.y, r: 2.5, width: 0.5 })
    const arm = markRadius + 2
    lines.push({ x1: c.x - arm, y1: c.y, x2: c.x + arm, y2: c.y, width: 0.25, colour: black })
    lines.push({ x1: c.x, y1: c.y - arm, x2: c.x, y2: c.y + arm, width: 0.25, colour: black })
  })
  return { lines, rings, rects }
}

export const fieldKeys = ['rifle', 'date', 'caliber', 'shooter', 'distance', 'group'] as const
type FieldKey = (typeof fieldKeys)[number]
export type FieldValues = Record<FieldKey, string>

/** What the sheet's fields are filled from; any of them may be missing. */
export type ZeroTargetSource = {
  group?: Pick<ShotGroup, 'name' | 'distance'> | undefined
  /** Name of the load's firearm. */
  firearm?: string | undefined
  /** Name of the load's cartridge. */
  cartridge?: string | undefined
  /** Day of the session, ISO 8601. */
  date?: string | undefined
}

/** The printed field values: blank for an absent source or value; the shooter is always blank. */
export function zeroTargetValues(source: ZeroTargetSource | undefined): FieldValues {
  const distance = source?.group?.distance
  return {
    rifle: source?.firearm ?? '',
    date: source?.date ?? '',
    caliber: source?.cartridge ?? '',
    shooter: '',
    distance: distance === undefined ? '' : plainNumber(Math.round(distance * 10) / 10),
    group: source?.group?.name ?? '',
  }
}

/** The session the first chronograph-linked shot of `group` names. */
export const sessionRefOf = (group: Pick<ShotGroup, 'shots'> | undefined) =>
  group?.shots.find((s) => s.chrono)?.chrono?.session

/** The sheet's text, translated by the caller. */
export type ZeroTargetText = {
  labels: FieldValues
  values: FieldValues
  /** The text under the check bar. */
  check: string
  footer: string
  /** "+5 cm" and "-5 cm" as the axes write them. */
  plus: string
  minus: string
}

const escapeXml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

const n = (x: number) => String(Number(x.toFixed(3)))

/** The sheet as one SVG document, viewBox in mm, sized 210 x 297 mm. */
export function zeroTargetSvg(text: ZeroTargetText): string {
  const { lines, rings, rects } = zeroTargetShapes()
  const out: string[] = []
  const label = (x: number, y: number, size: number, s: string, extra = '') =>
    out.push(`<text x="${n(x)}" y="${n(y)}" font-size="${size}"${extra}>${escapeXml(s)}</text>`)
  // the square over the grid and the cross
  for (const l of lines)
    out.push(
      `<line x1="${n(l.x1)}" y1="${n(l.y1)}" x2="${n(l.x2)}" y2="${n(l.y2)}" stroke="${l.colour}" stroke-width="${l.width}"/>`,
    )
  for (const r of rects)
    out.push(
      `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" fill="${r.colour}"/>`,
    )
  for (const r of rings)
    out.push(
      `<circle cx="${n(r.cx)}" cy="${n(r.cy)}" r="${r.r}" fill="none" stroke="${black}" stroke-width="${r.width}"/>`,
    )
  const off = 5 * gridPitch
  const middle = ' text-anchor="middle"'
  label(centre.x - off, centre.y + 4, 3, text.minus, middle)
  label(centre.x + off, centre.y + 4, 3, text.plus, middle)
  label(centre.x + 1.5, centre.y - off - 1, 3, text.plus)
  label(centre.x + 1.5, centre.y + off - 1, 3, text.minus)
  const width = (page.width - 30) / fieldKeys.length
  fieldKeys.forEach((k, i) => {
    const x = 15 + i * width
    label(x, 9.5, 2.5, text.labels[k], ` fill="${grey}"`)
    label(x, 16.5, 3.5, text.values[k])
    out.push(
      `<line x1="${n(x)}" y1="18" x2="${n(x + width - 3)}" y2="18" stroke="${black}" stroke-width="0.25"/>`,
    )
  })
  label(centre.x, 278, 2.5, `${barLength} mm`, middle)
  label(centre.x, 285, 2.8, text.check, middle)
  label(centre.x, 291, 2.2, text.footer, `${middle} fill="#555"`)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}mm" height="${page.height}mm" viewBox="0 0 ${page.width} ${page.height}" font-family="sans-serif">`,
    `<rect width="${page.width}" height="${page.height}" fill="${white}"/>`,
    ...out,
    '</svg>',
  ].join('\n')
}
