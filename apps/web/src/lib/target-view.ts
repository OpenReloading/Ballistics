/**
 * The view of a target sheet as exported, printed and zoomed by touch. View units are photo px,
 * or target mm on a drawn target. No React, DOM or Next.js.
 */
import { fromSi } from '@openreloading/schema'

export type ViewBox = { x: number; y: number; w: number; h: number }
type Pt = { x: number; y: number }

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
