/**
 * The bullet in a photograph (`apps/docs/docs/models/bullet-photo.md`): the bullet cut out of the
 * background, and the scale of the photograph from spans of a ruler. Lengths are in photo px, y
 * down, a pixel (i, j) covering [i, i + 1) x [j, j + 1). Pure: no React, DOM or Next.js, so it can
 * run in a Web Worker.
 */
import type { RgbaImage } from './image.ts'
import { nth } from './nth.ts'
import { clamp, components } from './raster-ops.ts'
import type { Point } from './target-geometry.ts'
import { otsu } from './target-paper.ts'

// Unchecked pixel-buffer reads inside loops whose bounds keep the index in range; module-local so the calls inline.
const at = (a: ArrayLike<number>, i: number) => a[i] as number

/** Luma (ITU-R BT.601 weights, 0..255) of a photograph, row by row. */
export interface Gray {
  width: number
  height: number
  data: Float32Array
}

/** The luma of `img`. */
export function grayOf(img: RgbaImage): Gray {
  const data = new Float32Array(img.width * img.height)
  for (let i = 0; i < data.length; i++)
    data[i] =
      0.299 * at(img.data, 4 * i) +
      0.587 * at(img.data, 4 * i + 1) +
      0.114 * at(img.data, 4 * i + 2)
  return { width: img.width, height: img.height, data }
}

/** The bullet's coverage of each pixel, 0 (background) to 255 (bullet), and what the search saw. */
export interface Segmentation {
  width: number
  height: number
  alpha: Uint8Array
  /** Sentences for the user, empty when the cut looks sound. */
  warnings: string[]
}

/** Below this gap between the mean grey of the bullet and of the background nothing is cut out. */
const minContrast = 25

const rowOf = (a: number[][], i: number) => a[i] as number[]

/**
 * Solves the `n` x `n` system `m x = b` (row-major `m`) by Gauss elimination with pivoting;
 * undefined for a singular system.
 */
export function solve(m: readonly number[], b: readonly number[], n: number): number[] | undefined {
  const a = Array.from({ length: n }, (_, i) => [...m.slice(i * n, i * n + n), at(b, i)])
  for (let c = 0; c < n; c++) {
    const p = Array.from({ length: n - c }, (_, k) => c + k).reduce(
      (best, r) => (Math.abs(at(rowOf(a, r), c)) > Math.abs(at(rowOf(a, best), c)) ? r : best),
      c,
    )
    const pivot = rowOf(a, p)
    if (Math.abs(at(pivot, c)) < 1e-12) return
    a[p] = rowOf(a, c)
    a[c] = pivot
    for (let r = c + 1; r < n; r++) {
      const row = rowOf(a, r)
      const f = at(row, c) / at(pivot, c)
      for (let k = c; k <= n; k++) row[k] = at(row, k) - f * at(pivot, k)
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    const row = rowOf(a, r)
    let s = at(row, n)
    for (let k = r + 1; k < n; k++) s -= at(row, k) * at(x, k)
    x[r] = s / at(row, r)
  }
  return x
}

/** Adds the point `q` of a plane fit with value `v` to its normal equations. */
function accumulate(m: number[], rhs: number[], q: number[], v: number) {
  for (let i = 0; i < 3; i++) {
    rhs[i] = at(rhs, i) + at(q, i) * v
    for (let j = 0; j < 3; j++) m[i * 3 + j] = at(m, i * 3 + j) + at(q, i) * at(q, j)
  }
}

/** The photograph's grey with the plane of its background (a lighting gradient) taken off, the background's mean kept. */
function flatten(g: Gray, isBackground: (v: number) => boolean): Float32Array {
  const { width: w, height: h, data } = g
  // normal equations of the plane a + b x + c y over the background pixels, on a stride
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000)))
  const m = new Array<number>(9).fill(0)
  const rhs = [0, 0, 0]
  let level = 0
  let n = 0
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step) {
      const v = at(data, y * w + x)
      if (!isBackground(v)) continue
      accumulate(m, rhs, [1, x / w - 0.5, y / h - 0.5], v)
      level += v
      n++
    }
  const plane = n >= 9 ? solve(m, rhs, 3) : undefined
  if (!plane) return Float32Array.from(data)
  const out = new Float32Array(w * h)
  for (let i = 0; i < out.length; i++) {
    const [x, y] = [(i % w) / w - 0.5, Math.floor(i / w) / h - 0.5]
    out[i] = at(data, i) - (at(plane, 0) + at(plane, 1) * x + at(plane, 2) * y) + level / n
  }
  return out
}

/** The mean of the pixels on the outer ring of the photograph. */
function borderMean(g: Gray): number {
  const { width: w, height: h, data } = g
  const k = Math.max(2, Math.round(0.01 * Math.min(w, h)))
  let sum = 0
  let n = 0
  for (let i = 0; i < data.length; i++) {
    const [x, y] = [i % w, Math.floor(i / w)]
    if (x < k || y < k || x >= w - k || y >= h - k) {
      sum += at(data, i)
      n++
    }
  }
  return sum / n
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Applies a 3 x 3 minimum (`erode`) or maximum of `src` inside the box, a pixel outside the box staying 0. */
function morph3(src: Uint8Array, w: number, box: Box, erode: boolean): Uint8Array {
  const out = new Uint8Array(src.length)
  const px = (u: number, s: number) => (u < 0 || s < 0 || u >= w ? 0 : (src[s * w + u] ?? 0))
  for (let y = box.y0; y <= box.y1; y++)
    for (let x = box.x0; x <= box.x1; x++) {
      const around = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => px(x + dx, y + dy)))
      out[y * w + x] = erode ? Math.min(...around) : Math.max(...around)
    }
  return out
}

/** The mask of `pixels` with its holes (background not reached from the box's edge) filled. */
function filled(pixels: number[], w: number, h: number, box: Box): Uint8Array {
  const mask = new Uint8Array(w * h)
  for (const i of pixels) mask[i] = 1
  const [bw, bh] = [box.x1 - box.x0 + 1, box.y1 - box.y0 + 1]
  const reached = new Uint8Array(bw * bh)
  const stack: number[] = []
  const push = (x: number, y: number) => {
    const j = y * bw + x
    const out = x < 0 || y < 0 || x >= bw || y >= bh
    if (out || reached[j] || mask[(y + box.y0) * w + x + box.x0]) return
    reached[j] = 1
    stack.push(j)
  }
  for (let x = 0; x < bw; x++) {
    push(x, 0)
    push(x, bh - 1)
  }
  for (let y = 0; y < bh; y++) {
    push(0, y)
    push(bw - 1, y)
  }
  while (stack.length) {
    const j = stack.pop() as number
    const [x, y] = [j % bw, Math.floor(j / bw)]
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }
  for (let j = 0; j < reached.length; j++)
    if (!reached[j]) mask[(Math.floor(j / bw) + box.y0) * w + (j % bw) + box.x0] = 1
  return mask
}

/** The mean greys of the two sides of Otsu's threshold of `flat`, the one the photo's border lies on first (the background). */
function levels(flat: Float32Array, w: number, h: number): [number, number] | undefined {
  const hist = new Float64Array(256)
  for (const v of flat) {
    const k = clamp(Math.round(v), 0, 255)
    hist[k] = nth(hist, k) + 1
  }
  const t = otsu(hist, flat.length)
  const sums = [0, 0]
  const counts = [0, 0]
  for (const v of flat) {
    const k = v > t ? 1 : 0
    sums[k] = at(sums, k) + v
    counts[k] = at(counts, k) + 1
  }
  if (!(at(counts, 0) && at(counts, 1))) return
  const [lo, hi] = [at(sums, 0) / at(counts, 0), at(sums, 1) / at(counts, 1)]
  const border = borderMean({ width: w, height: h, data: flat })
  return Math.abs(border - hi) < Math.abs(border - lo) ? [hi, lo] : [lo, hi]
}

/** The components of `inside` the points `exclude` (the ruler) are on or within `reach` px of, by index. */
function touched(
  parts: number[][],
  w: number,
  h: number,
  exclude: readonly Point[],
  reach: number,
) {
  const labelOf = new Int32Array(w * h).fill(-1)
  parts.forEach((p, k) => {
    for (const i of p) labelOf[i] = k
  })
  const near = new Set<number>()
  for (const p of exclude)
    for (let y = Math.max(0, Math.floor(p.y - reach)); y <= Math.min(h - 1, p.y + reach); y++)
      for (let x = Math.max(0, Math.floor(p.x - reach)); x <= Math.min(w - 1, p.x + reach); x++) {
        const label = at(labelOf, y * w + x)
        if (label !== -1 && (x - p.x) ** 2 + (y - p.y) ** 2 <= reach ** 2) near.add(label)
      }
  return near
}

/** The box of a part of the mask, and whether it touches the photograph's edge. */
function boxOf(pixels: number[], w: number, h: number): Box & { edge: boolean } {
  const box = { x0: w, y0: h, x1: 0, y1: 0 }
  for (const i of pixels) {
    const [x, y] = [i % w, Math.floor(i / w)]
    box.x0 = Math.min(box.x0, x)
    box.x1 = Math.max(box.x1, x)
    box.y0 = Math.min(box.y0, y)
    box.y1 = Math.max(box.y1, y)
  }
  return { ...box, edge: box.x0 === 0 || box.y0 === 0 || box.x1 === w - 1 || box.y1 === h - 1 }
}

/**
 * Cuts the bullet out of the photograph: the lighting plane is taken off, Otsu's threshold splits
 * the greys, the background is the side the photo's border lies on, and the bullet is the largest
 * connected part that does not touch the photo's edge and lies away from `exclude` (the points the
 * user clicked on the ruler, which is a part of its own). Holes (glare) are filled. A band of 2 px
 * along the edge keeps the partial coverage of the grey, so the edge has sub-pixel position.
 */
export function segment(g: Gray, exclude: readonly Point[] = []): Segmentation {
  const { width: w, height: h } = g
  const none = (warning: string): Segmentation => ({
    width: w,
    height: h,
    alpha: new Uint8Array(w * h),
    warnings: [warning],
  })
  const hist = new Float64Array(256)
  for (const v of g.data) {
    const k = clamp(Math.round(v), 0, 255)
    hist[k] = nth(hist, k) + 1
  }
  const t0 = otsu(hist, w * h)
  const backgroundHigh = borderMean(g) > t0
  const flat = flatten(g, (v) => v > t0 === backgroundHigh)
  const grey = levels(flat, w, h)
  if (!grey) return none('The photograph has one grey only.')
  const [bg, fg] = grey
  if (Math.abs(fg - bg) < minContrast)
    return none('The bullet and the background are too alike in brightness to tell apart.')
  const soft = (i: number) => clamp((at(flat, i) - bg) / (fg - bg), 0, 1)
  const inside = new Uint8Array(w * h)
  for (let i = 0; i < inside.length; i++) inside[i] = soft(i) >= 0.5 ? 1 : 0

  const parts = components(inside, w, h)
  const near = touched(parts, w, h, exclude, Math.max(6, Math.round(0.005 * Math.max(w, h))))
  const candidates = parts
    .map((pixels, k) => ({ pixels, ...boxOf(pixels, w, h), skip: near.has(k) }))
    .filter((p) => !p.skip && p.pixels.length >= 0.0003 * w * h)
    .sort((a, b) => b.pixels.length - a.pixels.length)
  const best = candidates.find((p) => !p.edge) ?? candidates[0]
  if (!best)
    return none('No bullet found: no part of the photograph stands out from the background.')

  const box: Box = {
    x0: Math.max(0, best.x0 - 4),
    y0: Math.max(0, best.y0 - 4),
    x1: Math.min(w - 1, best.x1 + 4),
    y1: Math.min(h - 1, best.y1 + 4),
  }
  const mask = filled(best.pixels, w, h, box)
  const eroded = morph3(morph3(mask, w, box, true), w, box, true)
  const dilated = morph3(morph3(mask, w, box, false), w, box, false)
  const alpha = new Uint8Array(w * h)
  for (let i = 0; i < alpha.length; i++)
    alpha[i] = at(eroded, i) ? 255 : at(dilated, i) ? Math.round(255 * soft(i)) : 0
  const warnings = best.edge
    ? ['The cut-out touches the edge of the photograph: the whole bullet may not be in it.']
    : []
  return { width: w, height: h, alpha, warnings }
}

/** Paints a disc of radius `r` at `c` with 255 (the bullet) or 0 (the background): the brush of the correction. */
export function paintDisc(s: Segmentation, c: Point, r: number, value: 0 | 255): void {
  for (let y = Math.max(0, Math.floor(c.y - r)); y <= Math.min(s.height - 1, c.y + r); y++)
    for (let x = Math.max(0, Math.floor(c.x - r)); x <= Math.min(s.width - 1, c.x + r); x++)
      if ((x + 0.5 - c.x) ** 2 + (y + 0.5 - c.y) ** 2 <= r * r) s.alpha[y * s.width + x] = value
}

/** What a scale is read from: a stated distance between two points the user placed on the ruler. */
export interface ScaleSpan {
  a: Point
  b: Point
  /** The distance on the ruler, mm. */
  mm: number
}

/** The scale of a photograph: px per mm and its relative standard uncertainty. */
export interface Scale {
  pxPerMm: number
  relUncertainty: number
}

/** Standard uncertainty of one placed point, px (the user's aim and the ruler's own tick width). */
export const pointUncertainty = 1

/**
 * The scale from one or two spans on the ruler. Each span's two points carry `pointUncertainty`;
 * with two spans the mean is taken and half of the disagreement between them, as a rectangular
 * distribution (divided by the root of 3), joins the placement terms in quadrature.
 */
export function scaleOf(spans: readonly ScaleSpan[]): Scale | undefined {
  const each = spans.map((s) => {
    const px = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y)
    return { ppm: px / s.mm, rel: (Math.SQRT2 * pointUncertainty) / px }
  })
  if (each.length === 0 || each.some((e) => !(e.ppm > 0) || !Number.isFinite(e.ppm))) return
  const mean = each.reduce((a, e) => a + e.ppm, 0) / each.length
  const placement = Math.sqrt(each.reduce((a, e) => a + e.rel ** 2, 0)) / each.length
  const half = (Math.max(...each.map((e) => e.ppm)) - Math.min(...each.map((e) => e.ppm))) / 2
  return { pxPerMm: mean, relUncertainty: Math.hypot(placement, half / Math.sqrt(3) / mean) }
}
