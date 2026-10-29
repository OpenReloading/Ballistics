/**
 * The view of a target sheet as exported, printed and zoomed by touch. View units are photo px,
 * or target mm on a drawn target. No React, DOM or Next.js.
 */
import { fromSi } from '@open-reloading/schema'

export type ViewBox = { x: number; y: number; w: number; h: number }
type Pt = { x: number; y: number }

/** The box around `pts` with a 10 % margin of the larger side (1 unit at least); a 1000 unit square without points. */
export function boxAround(pts: Pt[]): ViewBox {
  if (!pts.length) return { x: 0, y: 0, w: 1000, h: 1000 }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const m = 0.1 * Math.max(x1 - x0, y1 - y0, 1)
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m }
}

/** Export px per target mm of a drawn target. */
const drawnPxPerMm = 10

/** Pixel size of an export of `box`: the photo's resolution, or 10 px per mm without a photo. */
export function exportSize(photo: { width: number } | undefined, box: ViewBox) {
  const f = photo ? 1 : drawnPxPerMm
  return { w: Math.max(1, Math.round(box.w * f)), h: Math.max(1, Math.round(box.h * f)) }
}

/** 1, 2, 5 times powers of ten, largest first. */
const round = (lo: number, hi: number) =>
  Array.from({ length: hi - lo + 1 }, (_, i) => hi - i).flatMap((e) =>
    [5, 2, 1].map((m) => m * 10 ** e),
  )

/** The printed target's largest size on the sheet, mm. */
export const printArea = { width: 170, height: 140 }

/**
 * The print size of a view `box` (view units) at `mPerUnit` m of target per view unit: the
 * largest round scale (printed mm per target mm) that fits `maxW` x `maxH` mm, and a ruler of a
 * round number of display units (`unit` m each) at most 60 mm and the image's width long.
 */
export function printLayout(
  box: { w: number; h: number },
  mPerUnit: number,
  unit: number,
  maxW = printArea.width,
  maxH = printArea.height,
) {
  const w = fromSi('length', box.w * mPerUnit)
  const h = fromSi('length', box.h * mPerUnit)
  const scale = round(-4, 1).find((s) => w * s <= maxW + 1e-9 && h * s <= maxH + 1e-9) ?? 1e-4
  const perUnit = fromSi('length', unit) * scale
  const length = round(-3, 4).find((l) => l * perUnit <= Math.min(60, w * scale) + 1e-9) ?? 1e-3
  return { scale, width: w * scale, height: h * scale, ruler: { length, mm: length * perUnit } }
}

/** The scale as text: "2:1", "1:5". */
export const scaleText = (s: number) => (s >= 1 ? `${s}:1` : `1:${Math.round(1 / s)}`)

/**
 * The view after a two-finger move: `box` and `k` (view units per screen px) at the start, `p` the
 * view point that was between the fingers, `m0` and `m1` the screen midpoints then and now, `f` the
 * start distance of the fingers over the current one. `p` stays under the fingers.
 */
export function pinchView(box: ViewBox, k: number, p: Pt, m0: Pt, m1: Pt, f: number): ViewBox {
  return {
    x: p.x - (p.x - box.x) * f - (m1.x - m0.x) * k * f,
    y: p.y - (p.y - box.y) * f - (m1.y - m0.y) * k * f,
    w: box.w * f,
    h: box.h * f,
  }
}
