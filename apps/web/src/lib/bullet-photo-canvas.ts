/**
 * What the bullet photo tool draws on its canvas (browser only, no React): the photograph with
 * the cut-out tinted, the measured axis and the drawing of the measured values over it, the placed
 * scale points and the cursor.
 */
import type { Outline } from './bullet-photo-outline.ts'
import type { Point } from './target-geometry.ts'

/** What is drawn over the photograph. */
export interface View {
  hasCut: boolean
  outline: Outline | undefined
  /** The drawing of the measured values, [r, z] in mm, laid on the photograph at `pxPerMm`. */
  drawing: { points: [number, number][]; pxPerMm: number } | undefined
  opacity: number
  points: Point[]
  cursor: Point | undefined
  /** The brush's radius, px, when a brush is the tool. */
  brush: number | undefined
}

/** The labels of the scale points: the two ends of each ruler span. */
export const pointLabels = ['A', 'B', 'C', 'D']

type Draw = () => void

/** Strokes a path twice, dark under light, so it shows on a dark photograph and on a light one. */
function halo(g: CanvasRenderingContext2D, px: number, path: Draw, colour: string, width = 1.5) {
  for (const [style, w] of [
    ['rgba(0,0,0,0.75)', width + 2],
    [colour, width],
  ] as const) {
    g.lineWidth = w * px
    g.strokeStyle = style
    path()
    g.stroke()
  }
}

function drawAxis(g: CanvasRenderingContext2D, px: number, o: Outline) {
  const [ux, uy] = [Math.cos(o.angle), Math.sin(o.angle)]
  halo(
    g,
    px,
    () => {
      g.beginPath()
      g.moveTo(o.origin.x - 8 * px * ux, o.origin.y - 8 * px * uy)
      g.lineTo(o.origin.x + (o.length + 8 * px) * ux, o.origin.y + (o.length + 8 * px) * uy)
    },
    '#ffd43b',
    1,
  )
}

/** The drawing's outline, both halves, laid along the axis. */
function drawDrawing(
  g: CanvasRenderingContext2D,
  px: number,
  o: Outline,
  v: NonNullable<View['drawing']>,
  opacity: number,
) {
  const [ux, uy] = [Math.cos(o.angle), Math.sin(o.angle)]
  const at = (r: number, z: number): Point => ({
    x: o.origin.x + (ux * z - uy * r) * v.pxPerMm,
    y: o.origin.y + (uy * z + ux * r) * v.pxPerMm,
  })
  const round = [...v.points, ...[...v.points].reverse().map(([r, z]): [number, number] => [-r, z])]
  g.globalAlpha = opacity
  halo(
    g,
    px,
    () => {
      g.beginPath()
      round.forEach(([r, z], i) => {
        const p = at(r, z)
        if (i === 0) g.moveTo(p.x, p.y)
        else g.lineTo(p.x, p.y)
      })
      g.closePath()
    },
    '#51cf66',
  )
  g.globalAlpha = 1
}

function drawPoints(g: CanvasRenderingContext2D, px: number, points: Point[]) {
  g.font = `${16 * px}px sans-serif`
  points.forEach((p, i) => {
    halo(
      g,
      px,
      () => {
        g.beginPath()
        g.moveTo(p.x - 14 * px, p.y)
        g.lineTo(p.x + 14 * px, p.y)
        g.moveTo(p.x, p.y - 14 * px)
        g.lineTo(p.x, p.y + 14 * px)
      },
      '#ff922b',
    )
    g.lineWidth = 3 * px
    g.strokeStyle = 'rgba(0,0,0,0.8)'
    g.strokeText(pointLabels[i] ?? '', p.x + 8 * px, p.y - 8 * px)
    g.fillStyle = '#ffd8a8'
    g.fillText(pointLabels[i] ?? '', p.x + 8 * px, p.y - 8 * px)
  })
}

/** Draws the photograph and everything over it. */
export function paintPhoto(
  g: CanvasRenderingContext2D,
  photo: HTMLCanvasElement,
  tint: HTMLCanvasElement,
  v: View,
) {
  g.clearRect(0, 0, photo.width, photo.height)
  g.drawImage(photo, 0, 0)
  if (v.hasCut) g.drawImage(tint, 0, 0)
  const px = Math.max(1, photo.width / 900)
  if (v.outline) drawAxis(g, px, v.outline)
  if (v.outline && v.drawing) drawDrawing(g, px, v.outline, v.drawing, v.opacity)
  drawPoints(g, px, v.points)
  const c = v.cursor
  if (c)
    halo(
      g,
      px,
      () => {
        g.beginPath()
        g.arc(c.x, c.y, v.brush ?? 5 * px, 0, 2 * Math.PI)
      },
      '#ffffff',
      1,
    )
}

/** Tints the pixels of `alpha` (row length `w`) from (x0, y0) to (x1, y1) inclusive into the tint canvas, which holds the whole cut-out. */
export function tintBox(
  alpha: Uint8Array,
  w: number,
  into: HTMLCanvasElement,
  [x0, y0, x1, y1]: [number, number, number, number],
) {
  const g = into.getContext('2d')
  if (!g) return
  const img = g.createImageData(x1 - x0 + 1, y1 - y0 + 1)
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const k = 4 * ((y - y0) * img.width + x - x0)
      img.data.set([214, 51, 132, Math.round(0.4 * (alpha[y * w + x] ?? 0))], k)
    }
  g.putImageData(img, x0, y0)
}

/** Sizes the tint canvas to the working image and tints the whole cut-out. */
export function tintOf(alpha: Uint8Array, w: number, h: number, into: HTMLCanvasElement) {
  into.width = w
  into.height = h
  tintBox(alpha, w, into, [0, 0, w - 1, h - 1])
}
