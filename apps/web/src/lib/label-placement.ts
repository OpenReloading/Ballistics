/** Placement of overlay labels in view units, clear of circles, segments and other labels. */

import { nth } from './nth.ts'
import type { Point } from './target-geometry.ts'

/** A label box in view units: top left, width, height. */
export type LabelBox = { x: number; y: number; w: number; h: number }

/** What labels keep clear of, view units; `placeLabel` adds each label it places to `boxes`. */
export type LabelScene = {
  circles: { x: number; y: number; r: number }[]
  segments: [Point, Point][]
  boxes: LabelBox[]
  /** The visible view; a label stays inside it when it can. */
  view: LabelBox
  fontSize: number
  /** Distance of a label from its anchor and from what it keeps clear of. */
  gap: number
}

const boxHitsBox = (a: LabelBox, b: LabelBox, gap: number) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap

const boxHitsCircle = (b: LabelBox, c: { x: number; y: number; r: number }, gap: number) =>
  Math.hypot(Math.max(b.x - c.x, 0, c.x - b.x - b.w), Math.max(b.y - c.y, 0, c.y - b.y - b.h)) <
  c.r + gap

/** Whether segment p-q enters box `b` (Liang-Barsky clipping). */
function boxHitsSegment(b: LabelBox, [p, q]: [Point, Point]): boolean {
  const [dx, dy] = [q.x - p.x, q.y - p.y]
  let [t0, t1] = [0, 1]
  const axes: [number, number, number][] = [
    [dx, b.x - p.x, b.x + b.w - p.x],
    [dy, b.y - p.y, b.y + b.h - p.y],
  ]
  for (const [d, lo, hi] of axes) {
    if (d === 0) {
      if (lo > 0 || hi < 0) return false
      continue
    }
    const [a, c] = [lo / d, hi / d]
    t0 = Math.max(t0, Math.min(a, c))
    t1 = Math.min(t1, Math.max(a, c))
    if (t0 > t1) return false
  }
  return true
}

/**
 * Places `text` next to the first of `anchors` where its box clears every circle, segment and box of
 * `scene`: outward from `from` first, then turned in steps of 45 degrees, then farther out in half
 * lines; inside the view when it can. Close to an anchor a crossing line is taken before a far
 * place. The box is estimated (0.6 font size per character) and added to `scene.boxes`.
 */
export function placeLabel(
  scene: LabelScene,
  text: string,
  anchors: Point[],
  from: Point,
): LabelBox {
  const { fontSize, gap, view } = scene
  const [w, h] = [0.6 * fontSize * text.length, 1.2 * fontSize]
  const candidates: { box: LabelBox; near: boolean }[] = []
  for (let step = 0; step < 32; step++)
    for (const a of anchors) {
      const d0 = Math.hypot(a.x - from.x, a.y - from.y)
      const [ux, uy] = d0 > 1e-9 ? [(a.x - from.x) / d0, (a.y - from.y) / d0] : [1, 0]
      for (const turn of [0, 1, -1, 2, -2, 3, -3, 4]) {
        const t = (turn * Math.PI) / 4
        const [dx, dy] = [ux * Math.cos(t) - uy * Math.sin(t), ux * Math.sin(t) + uy * Math.cos(t)]
        // the box centre, so that the box edge toward the anchor is `gap` + step / 2 lines away
        const r = gap + Math.abs(dx) * (w / 2) + Math.abs(dy) * (h / 2) + (step * h) / 2
        const box = { x: a.x + dx * r - w / 2, y: a.y + dy * r - h / 2, w, h }
        candidates.push({ box, near: step <= 4 })
      }
    }
  const free = (b: LabelBox) =>
    !scene.circles.some((c) => boxHitsCircle(b, c, gap)) &&
    !scene.boxes.some((o) => boxHitsBox(b, o, gap / 2))
  const clear = (b: LabelBox) => free(b) && !scene.segments.some((s) => boxHitsSegment(b, s))
  const inside = (b: LabelBox) =>
    b.x >= view.x && b.y >= view.y && b.x + b.w <= view.x + view.w && b.y + b.h <= view.y + view.h
  const pick = (ok: (c: { box: LabelBox; near: boolean }) => boolean) => candidates.find(ok)?.box
  const box =
    pick((c) => c.near && clear(c.box) && inside(c.box)) ??
    pick((c) => c.near && free(c.box) && inside(c.box)) ??
    pick((c) => clear(c.box) && inside(c.box)) ??
    pick((c) => free(c.box)) ??
    nth(candidates, 0).box
  scene.boxes.push(box)
  return box
}
