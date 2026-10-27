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
  /** Gap between the mean grey of the bullet and of the background, grey levels; 0 without a cut-out. */
  contrast: number
  /** The width the grey takes to go from the background to the bullet at the cut-out's edge, px (1 for a sharp edge); 0 for a cut-out not found or corrected by hand. */
  edgeSpread: number
}

/** The coverage of a cut-out: what the outline needs of a segmentation. */
export type Cutout = Pick<Segmentation, 'width' | 'height' | 'alpha'>

/** Below this gap between the mean grey of the bullet and of the background nothing is cut out. */
const minContrast = 25

/** Below this gap the cut-out is flagged as rough, grey levels. */
export const lowContrast = 60

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

/** The median of the pixels on the outer ring of the photograph (bars along some of its edges stay a minority of the ring). */
function borderLevel(g: Gray): number {
  const { width: w, height: h, data } = g
  const k = Math.max(2, Math.round(0.01 * Math.min(w, h)))
  const hist = new Float64Array(256)
  let n = 0
  for (let i = 0; i < data.length; i++) {
    const [x, y] = [i % w, Math.floor(i / w)]
    if (x < k || y < k || x >= w - k || y >= h - k) {
      const b = clamp(Math.round(at(data, i)), 0, 255)
      hist[b] = nth(hist, b) + 1
      n++
    }
  }
  let seen = 0
  for (let b = 0; b < 256; b++) {
    seen += nth(hist, b)
    if (seen >= n / 2) return b
  }
  return 255
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
  const border = borderLevel({ width: w, height: h, data: flat })
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
 * Clears the bars along the photograph's edges that are mostly mask (a letterbox or a ruler strip
 * that Otsu's threshold puts on the bullet's side): from each edge inward while at least 90 % of a
 * row or column is mask, at most a quarter of the photograph.
 */
function clearBars(inside: Uint8Array, w: number, h: number): void {
  const line = (k: number, vertical: boolean) => {
    let n = 0
    const len = vertical ? h : w
    for (let j = 0; j < len; j++) n += at(inside, vertical ? j * w + k : k * w + j)
    return n >= 0.9 * len
  }
  const clear = (k: number, vertical: boolean) => {
    for (let j = 0; j < (vertical ? h : w); j++) inside[vertical ? j * w + k : k * w + j] = 0
  }
  for (const [vertical, len] of [
    [true, w],
    [false, h],
  ] as const)
    for (const side of [0, 1]) {
      const ks = Array.from({ length: Math.floor(len / 4) }, (_, i) => (side ? len - 1 - i : i))
      const n = ks.findIndex((k) => !line(k, vertical))
      for (const k of ks.slice(0, n === -1 ? ks.length : n)) clear(k, vertical)
    }
}

/**
 * The mean grey of the pixels flagged in `rim` within `radius` of each pixel of the box (the radius
 * doubled up to eight times where fewer than 9 are in reach, `fallback` beyond). The rim is the
 * bullet's own colour at its edge, so the coverage of a pale part (a bright copper tip) is told
 * from the background by that part's grey and not by the shank's.
 */
function localLevels(
  flat: Float32Array,
  w: number,
  box: Box,
  rim: Uint8Array,
  radius: number,
  fallback: number,
): Float32Array {
  const [bw, bh] = [box.x1 - box.x0 + 1, box.y1 - box.y0 + 1]
  const cell = (x: number, y: number) => y * (bw + 1) + x
  // summed-area tables of the rim's count and grey
  const sw = new Float64Array((bw + 1) * (bh + 1))
  const sg = new Float64Array((bw + 1) * (bh + 1))
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const i = (y + box.y0) * w + x + box.x0
      const c = at(rim, i)
      const [u, l, ul] = [cell(x + 1, y), cell(x, y + 1), cell(x, y)]
      sw[cell(x + 1, y + 1)] = at(sw, u) + at(sw, l) - at(sw, ul) + c
      sg[cell(x + 1, y + 1)] = at(sg, u) + at(sg, l) - at(sg, ul) + (c ? at(flat, i) : 0)
    }
  const within = (a: Float64Array, x: number, y: number, r: number) =>
    at(a, cell(Math.min(bw, x + r + 1), Math.min(bh, y + r + 1))) -
    at(a, cell(Math.max(0, x - r), Math.min(bh, y + r + 1))) -
    at(a, cell(Math.min(bw, x + r + 1), Math.max(0, y - r))) +
    at(a, cell(Math.max(0, x - r), Math.max(0, y - r)))
  const meanAt = (x: number, y: number) => {
    for (let r = radius; r <= 8 * radius; r *= 2) {
      const n = within(sw, x, y, r)
      if (n >= 9) return within(sg, x, y, r) / n
    }
    return fallback
  }
  const out = new Float32Array(bw * bh)
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) out[y * bw + x] = meanAt(x, y)
  return out
}

/** Applies a 3 x 3 erosion (`erode`) or dilation to `mask` `n` times, inside the box. */
const morphN = (mask: Uint8Array, w: number, box: Box, erode: boolean, n: number) =>
  Array.from({ length: n }).reduce<Uint8Array>((m) => morph3(m, w, box, erode), mask)

/**
 * The width the grey takes to go from the background to the bullet at the edge of `mask`, px: the
 * contrast over the steepest slope, its upper quartile along the boundary (a shadow lies along one side only). A step blurred by a Gaussian of
 * standard deviation s has its 10 to 90 % rise over about 2.5 s, which is that ratio; a sharp
 * edge reads 1 to 2 px, a shadow or an out-of-focus edge much more.
 */
function edgeSpreadOf(
  flat: Float32Array,
  mask: Uint8Array,
  w: number,
  box: Box,
  contrast: (i: number) => number,
): number {
  const edge = morphN(mask, w, box, true, 1)
  const slope = (i: number) =>
    Math.hypot(at(flat, i + 1) - at(flat, i - 1), at(flat, i + w) - at(flat, i - w)) / 2
  const spreads: number[] = []
  for (let y = Math.max(box.y0, 2); y <= Math.min(box.y1, flat.length / w - 3); y++)
    for (let x = Math.max(box.x0, 2); x <= Math.min(box.x1, w - 3); x++) {
      const i = y * w + x
      if (!at(mask, i) || at(edge, i)) continue
      const steepest = Math.max(slope(i), slope(i - 1), slope(i + 1), slope(i - w), slope(i + w))
      spreads.push(contrast(i) / Math.max(steepest, 1e-3))
    }
  return spreads.sort((a, b) => a - b)[Math.floor(0.75 * spreads.length)] ?? 0
}

/** The sentence about edges spread over more than 4 px and more than 4 % of the bullet's thickness. */
function softEdgeWarning(spread: number, thickness: number): string[] {
  return spread > Math.max(4, 0.04 * thickness)
    ? [
        `The edges of the bullet are soft, about ${Math.round(spread)} px wide: a shadow beside the bullet, or the photograph is out of focus or moved. Measured values are less certain; a sharp photograph in even light gives a more exact outline.`,
      ]
    : []
}

/** The largest part of `inside` that is not near `exclude` and does not touch the photograph's edge (else the largest that does). */
function bestPart(inside: Uint8Array, w: number, h: number, exclude: readonly Point[]) {
  const parts = components(inside, w, h)
  const near = touched(parts, w, h, exclude, Math.max(6, Math.round(0.005 * Math.max(w, h))))
  const candidates = parts
    .map((pixels, k) => ({ pixels, ...boxOf(pixels, w, h), skip: near.has(k) }))
    .filter((p) => !p.skip && p.pixels.length >= 0.0003 * w * h)
    .sort((a, b) => b.pixels.length - a.pixels.length)
  return candidates.find((p) => !p.edge) ?? candidates[0]
}

/** The share of the bullet's mean grey, from the background, that a pixel needs in the first pass to be a candidate. */
const generous = 0.25

/** A part of the mask with its box, and the coverage of every pixel at the bullet's own grey near it. */
interface Cover {
  soft: (i: number) => number
  /** The distance of the bullet's grey near a pixel from the background's. */
  contrast: (i: number) => number
  best: NonNullable<ReturnType<typeof bestPart>>
  thickness: number
}

const padded = (p: Box, k: number, w: number, h: number): Box => ({
  x0: Math.max(0, p.x0 - k),
  y0: Math.max(0, p.y0 - k),
  x1: Math.min(w - 1, p.x1 + k),
  y1: Math.min(h - 1, p.y1 + k),
})

/**
 * The two passes of the cut-out. The first keeps every pixel a quarter of the way to the bullet's
 * mean grey and takes the bars of the photograph's edges off; its part, and the grey of its rim,
 * give the bullet's own grey near each pixel (a pale tip is not the shank's grey). The second keeps
 * the pixels at half coverage of that grey.
 */
function coverOf(
  flat: Float32Array,
  [bg, fg]: [number, number],
  [w, h]: [number, number],
  exclude: readonly Point[],
): Cover | undefined {
  const first = new Uint8Array(w * h)
  for (let i = 0; i < first.length; i++)
    first[i] = clamp((at(flat, i) - bg) / (fg - bg), 0, 1) >= generous ? 1 : 0
  clearBars(first, w, h)
  const rough = bestPart(first, w, h, exclude)
  if (!rough) return
  const roughBox = padded(rough, 4, w, h)
  const inner = morphN(filled(rough.pixels, w, h, roughBox), w, roughBox, true, 2)
  const deep = morphN(inner, w, roughBox, true, 3)
  const rim = inner.map((v, i) => (v && !at(deep, i) ? 1 : 0))
  const thickness = rough.pixels.length / Math.max(rough.x1 - rough.x0, rough.y1 - rough.y0, 1)
  const level = localLevels(flat, w, roughBox, rim, Math.max(4, Math.round(0.3 * thickness)), fg)
  const bw = roughBox.x1 - roughBox.x0 + 1
  const levelAt = (i: number) =>
    at(level, (Math.floor(i / w) - roughBox.y0) * bw + (i % w) - roughBox.x0)
  const soft = (i: number) => clamp((at(flat, i) - bg) / (levelAt(i) - bg), 0, 1)
  const inside = new Uint8Array(w * h)
  for (let y = roughBox.y0; y <= roughBox.y1; y++)
    for (let x = roughBox.x0; x <= roughBox.x1; x++)
      inside[y * w + x] = soft(y * w + x) >= 0.5 ? 1 : 0
  const best = bestPart(inside, w, h, exclude)
  return best && { soft, contrast: (i) => Math.abs(levelAt(i) - bg), best, thickness }
}

/**
 * Cuts the bullet out of the photograph: the lighting plane is taken off, Otsu's threshold splits
 * the greys, the background is the side the photo's border lies on, and the bullet is the largest
 * connected part that does not touch the photo's edge and lies away from `exclude` (the points the
 * user clicked on the ruler, which is a part of its own), found at the bullet's own grey near each
 * pixel (`coverOf`). Holes (glare) are filled. A band of 2 px along the edge keeps the partial
 * coverage of the grey, so the edge has sub-pixel position.
 */
export function segment(g: Gray, exclude: readonly Point[] = []): Segmentation {
  const { width: w, height: h } = g
  const none = (warning: string): Segmentation => ({
    width: w,
    height: h,
    alpha: new Uint8Array(w * h),
    warnings: [warning],
    contrast: 0,
    edgeSpread: 0,
  })
  const hist = new Float64Array(256)
  for (const v of g.data) {
    const k = clamp(Math.round(v), 0, 255)
    hist[k] = nth(hist, k) + 1
  }
  const t0 = otsu(hist, w * h)
  const backgroundHigh = borderLevel(g) > t0
  const flat = flatten(g, (v) => v > t0 === backgroundHigh)
  const grey = levels(flat, w, h)
  if (!grey) return none('The photograph has one grey only.')
  const gap = Math.abs(grey[1] - grey[0])
  if (gap < minContrast)
    return none('The bullet and the background are too alike in brightness to tell apart.')
  const cover = coverOf(flat, grey, [w, h], exclude)
  if (!cover)
    return none('No bullet found: no part of the photograph stands out from the background.')

  const { soft, contrast, best, thickness } = cover
  const box = padded(best, 4, w, h)
  const mask = filled(best.pixels, w, h, box)
  const eroded = morphN(mask, w, box, true, 2)
  const dilated = morphN(mask, w, box, false, 2)
  const alpha = new Uint8Array(w * h)
  for (let i = 0; i < alpha.length; i++)
    alpha[i] = at(eroded, i) ? 255 : at(dilated, i) ? Math.round(255 * soft(i)) : 0
  const edgeSpread = edgeSpreadOf(flat, mask, w, box, contrast)
  const warnings = [
    ...(best.edge
      ? ['The cut-out touches the edge of the photograph: the whole bullet may not be in it.']
      : []),
    ...(gap < lowContrast
      ? [
          `The bullet differs from the background by ${Math.round(gap)} grey levels only: the outline may be rough. A plainer background, or one much lighter or darker than the bullet, gives a better cut-out.`,
        ]
      : []),
    ...softEdgeWarning(edgeSpread, thickness),
  ]
  return { width: w, height: h, alpha, warnings, contrast: gap, edgeSpread }
}

/** Paints a disc of radius `r` at `c` with 255 (the bullet) or 0 (the background): the brush of the correction. */
export function paintDisc(s: Cutout, c: Point, r: number, value: 0 | 255): void {
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
