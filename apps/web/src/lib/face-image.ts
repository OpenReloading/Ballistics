/**
 * Image steps of the target face search: grey levels on a coarse grid,
 * the black area by a sweep of thresholds, the edge of an ellipse refined along its normals, and the
 * Hessian ridge map of the ring lines. Pure: no React, DOM or Next.js.
 */
import { conicOf, type Ellipse, ellipsePoint, meanRadius, ransacEllipse } from './ellipse.ts'
import type { RgbaImage } from './image.ts'
import { nth } from './nth.ts'
import { clamp } from './raster-ops.ts'
import type { Point } from './target-geometry.ts'

// Unchecked pixel-buffer reads inside loops whose bounds keep the index in range; module-local so the calls inline.
const f32 = (a: Float32Array, i: number) => a[i] as number
const i8 = (a: Int8Array, i: number) => a[i] as number
const i32 = (a: Int32Array, i: number) => a[i] as number
const u8 = (a: Uint8Array | Uint8ClampedArray, i: number) => a[i] as number

/** Grey levels (ITU-R BT.601 luma) averaged over square blocks of `blockSize` image px of a crop of the image. */
export type Grid = {
  width: number
  height: number
  /** Image px per grid px. */
  blockSize: number
  /** Image px of the grid's left and top edge. */
  left: number
  top: number
  grey: Float32Array
  /** Chroma (largest minus smallest channel) over the same blocks. */
  chroma: Float32Array
}

/** Grid px centre to image px and back (a block of `blockSize` px has its centre at (i + 0.5) `blockSize` - 0.5). */
export const gridToImage = (grid: Grid, p: Point): Point => ({
  x: grid.left + (p.x + 0.5) * grid.blockSize - 0.5,
  y: grid.top + (p.y + 0.5) * grid.blockSize - 0.5,
})
export const imageToGrid = (grid: Grid, p: Point): Point => ({
  x: (p.x + 0.5 - grid.left) / grid.blockSize - 0.5,
  y: (p.y + 0.5 - grid.top) / grid.blockSize - 0.5,
})

export function grayGrid(
  image: RgbaImage,
  s: number,
  area?: { x0: number; y0: number; x1: number; y1: number },
): Grid {
  const box = area ?? { x0: 0, y0: 0, x1: image.width, y1: image.height }
  const x0 = Math.max(0, Math.floor(box.x0))
  const y0 = Math.max(0, Math.floor(box.y0))
  const x1 = Math.min(image.width, Math.ceil(box.x1))
  const y1 = Math.min(image.height, Math.ceil(box.y1))
  const w = Math.max(1, Math.ceil((x1 - x0) / s))
  const h = Math.max(1, Math.ceil((y1 - y0) / s))
  const sum = new Float32Array(w * h)
  const chroma = new Float32Array(w * h)
  const count = new Float32Array(w * h)
  const d = image.data
  for (let y = y0; y < y1; y++) {
    const row = Math.floor((y - y0) / s) * w
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4
      const j = row + Math.floor((x - x0) / s)
      const [red, green, blue] = [u8(d, i), u8(d, i + 1), u8(d, i + 2)]
      sum[j] = f32(sum, j) + (0.299 * red + 0.587 * green + 0.114 * blue)
      chroma[j] = f32(chroma, j) + (Math.max(red, green, blue) - Math.min(red, green, blue))
      count[j] = f32(count, j) + 1
    }
  }
  for (let j = 0; j < w * h; j++) {
    const c = f32(count, j)
    sum[j] = c ? f32(sum, j) / c : 255
    chroma[j] = c ? f32(chroma, j) / c : 0
  }
  return { width: w, height: h, blockSize: s, left: x0, top: y0, grey: sum, chroma: chroma }
}

/** Value at (x, y) by bilinear interpolation; edge pixels repeat. */
function sampleBilinear(g: Float32Array, w: number, h: number, x: number, y: number): number {
  const xc = clamp(x, 0, w - 1)
  const yc = clamp(y, 0, h - 1)
  const [i, j] = [Math.min(w - 2, Math.floor(xc)), Math.min(h - 2, Math.floor(yc))]
  const [fx, fy] = [xc - i, yc - j]
  if (w < 2 || h < 2) return f32(g, Math.round(yc) * w + Math.round(xc))
  const k = j * w + i
  return (
    f32(g, k) * (1 - fx) * (1 - fy) +
    f32(g, k + 1) * fx * (1 - fy) +
    f32(g, k + w) * (1 - fx) * fy +
    f32(g, k + w + 1) * fx * fy
  )
}

/** `q`-quantile (0 to 1) of `v`, from at most 20 000 evenly spaced values. */
function quantile(v: ArrayLike<number>, q: number): number {
  const step = Math.max(1, Math.floor(v.length / 20000))
  const s: number[] = []
  for (let i = 0; i < v.length; i += step) s.push(nth(v, i))
  s.sort((a, b) => a - b)
  return nth(s, Math.min(s.length - 1, Math.floor(q * s.length)))
}

type Labels = {
  lab: Int32Array
  area: number[]
  box: Array<{ x0: number; y0: number; x1: number; y1: number }>
}

/** 8-connected components of the mask; the label image is -1 outside. */
function label(mask: Uint8Array, w: number, h: number): Labels {
  const lab = new Int32Array(w * h).fill(-1)
  const stack = new Int32Array(w * h)
  const area: number[] = []
  const box: Labels['box'] = []
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || i32(lab, start) >= 0) continue
    const grown = growComponent(start, area.length, mask, lab, stack, w, h)
    area.push(grown.n)
    box.push(grown.box)
  }
  return { lab, area, box }
}

/** Labels the component of `start` with `k` by a flood fill: its pixel count and bounding box. */
function growComponent(
  start: number,
  k: number,
  mask: Uint8Array,
  lab: Int32Array,
  stack: Int32Array,
  w: number,
  h: number,
) {
  let top = 0
  stack[top++] = start
  lab[start] = k
  let n = 0
  const b = { x0: w, y0: h, x1: -1, y1: -1 }
  while (top) {
    const i = i32(stack, --top)
    n++
    const x = i % w
    const y = Math.trunc(i / w)
    if (x < b.x0) b.x0 = x
    if (x > b.x1) b.x1 = x
    if (y < b.y0) b.y0 = y
    if (y > b.y1) b.y1 = y
    top = pushUnlabelled(x, y, k, mask, lab, stack, top, w, h)
  }
  return { n, box: b }
}

/** Labels the unlabelled mask pixels around (x, y) and pushes them on the stack; the new stack top. */
function pushUnlabelled(
  x: number,
  y: number,
  k: number,
  mask: Uint8Array,
  lab: Int32Array,
  stack: Int32Array,
  top: number,
  w: number,
  h: number,
): number {
  let next = top
  const [u0, u1, v0, v1] = [
    Math.max(0, x - 1),
    Math.min(w - 1, x + 1),
    Math.max(0, y - 1),
    Math.min(h - 1, y + 1),
  ]
  for (let v = v0; v <= v1; v++)
    for (let u = u0; u <= u1; u++) {
      const j = v * w + u
      if (mask[j] && i32(lab, j) < 0) {
        lab[j] = k
        stack[next++] = j
      }
    }
  return next
}

/** A dark area found by one threshold: its filled mask, outline and moment ellipse. */
type Blob = {
  threshold: number
  /** Pixels of the filled component (holes of the print filled). */
  area: number
  ellipse: Ellipse
  /** Share of the moment ellipse the filled area covers. */
  fill: number
  /** Root mean square Sampson distance of the outline's inliers to the ellipse, a share of its mean radius; NaN when rough. */
  relativeRms: number
  /** Share of the outline on the fitted ellipse. */
  outlineInlierShare: number
  /** Dark share of the rim of the filled area: the closed line of a ring is nearly 0, a black area near 1. */
  rimDarkShare: number
  outline: Point[]
  /** The moment ellipse of a component whose outline is no clean ellipse. */
  rough?: boolean
}

/** The dark pixels of a black area differ in colour by at most this much between their channels. */
const MAX_CHROMA = 50
/** A black area's minor over its major axis is at least this (a face tilted by about 70 degrees). */
const MIN_ASPECT = 0.3

/**
 * The dark components (grey level under `t`, 0 to 255) among the five largest of at least `minArea`
 * grid px, filled, and how well each is an ellipse. A component cut by the photo's edge is fitted
 * to its edge inside the photo.
 */
function blobsAt(grid: Grid, t: number, minArea: number): Blob[] {
  const { width: w, height: h, grey: g } = grid
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) mask[i] = f32(g, i) < t ? 1 : 0
  const { lab, area, box } = label(mask, w, h)
  const out: Blob[] = []
  const order = area.map((_a, k) => k).sort((a, b) => nth(area, b) - nth(area, a))
  for (const k of order.slice(0, 5)) {
    const b = nth(box, k)
    const size = nth(area, k)
    if (size < minArea) break
    const component = { lab, k, box: b, area: size }
    const filled = fillComponent(component, w, h)
    const m = momentsOf(filled)
    if (m.n < minArea || !isBlackArea(grid, component, m)) continue
    const blob = blobOf(grid, t, filled, m)
    if (blob) out.push(blob)
  }
  return out
}

/** Component `k` of the label image `lab`: its bounding box and its area, grid px. */
type Component = { lab: Int32Array; k: number; box: Labels['box'][number]; area: number }

/** A filled component: `outside` marks the pixels of its box (grown by 1 px) the outside reaches; `left`, `top` the box's grid px. */
type Filled = { outside: Uint8Array; width: number; height: number; left: number; top: number }

/** Component `k` filled: the pixels of its bounding box (plus a margin) the outside does not reach. */
function fillComponent({ lab, k, box: b }: Component, w: number, h: number): Filled {
  const [bw, bh] = [b.x1 - b.x0 + 3, b.y1 - b.y0 + 3]
  const [left, top] = [b.x0 - 1, b.y0 - 1]
  const outside = new Uint8Array(bw * bh)
  const stack: number[] = []
  const visit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= bw || y >= bh || outside[y * bw + x]) return
    const gx = x + left
    const gy = y + top
    if (gx >= 0 && gy >= 0 && gx < w && gy < h && lab[gy * w + gx] === k) return
    outside[y * bw + x] = 1
    stack.push(y * bw + x)
  }
  visit(0, 0)
  while (stack.length) {
    const i = stack.pop() as number
    const [x, y] = [i % bw, Math.trunc(i / bw)]
    visit(x + 1, y)
    visit(x - 1, y)
    visit(x, y + 1)
    visit(x, y - 1)
  }
  return { outside, width: bw, height: bh, left, top }
}

/** Pixel count, centroid, second moments and their eigenvalues `l1` >= `l2`, and the outline of a filled component, grid px. */
function momentsOf(f: Filled) {
  const { outside, width: bw, height: bh } = f
  let [n, sx, sy, sxx, sxy, syy] = [0, 0, 0, 0, 0, 0]
  const outline: Point[] = []
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      if (outside[y * bw + x]) continue
      const [px, py] = [x + f.left, y + f.top]
      n++
      sx += px
      sy += py
      sxx += px * px
      sxy += px * py
      syy += py * py
      if (
        x === 0 ||
        y === 0 ||
        x === bw - 1 ||
        y === bh - 1 ||
        outside[y * bw + x - 1] ||
        outside[y * bw + x + 1] ||
        outside[(y - 1) * bw + x] ||
        outside[(y + 1) * bw + x]
      )
        outline.push({ x: px, y: py })
    }
  const [mx, my] = [sx / n, sy / n]
  const [vxx, vxy, vyy] = [sxx / n - mx * mx, sxy / n - mx * my, syy / n - my * my]
  const mid = (vxx + vyy) / 2
  const rad = Math.hypot((vxx - vyy) / 2, vxy)
  const [l1, l2] = [mid + rad, mid - rad]
  // an ellipse of semi-axes a, b has the moment variances a^2 / 4 and b^2 / 4
  const fill = n / (Math.PI * 4 * Math.sqrt(l1 * l2))
  return { n, mx, my, vxx, vxy, vyy, l1, l2, fill, outline }
}

type Moments = ReturnType<typeof momentsOf>

/** Whether the component is grey, not coloured, and its moment ellipse a compact one. */
function isBlackArea(grid: Grid, { lab, k, box: b, area }: Component, m: Moments): boolean {
  const w = grid.width
  // black is not a colour: a red or green band is no black area
  let chromaSum = 0
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++)
      if (lab[y * w + x] === k) chromaSum += f32(grid.chroma, y * w + x)
  if (chromaSum / area > MAX_CHROMA) return false
  if (!(m.l2 > 0)) return false
  if (m.fill < 0.7 || m.fill > 1.3) return false
  // a face seen from a shallow angle is still no bar: its axes keep a ratio of at least 0.3
  return Math.sqrt(m.l2 / m.l1) >= MIN_ASPECT
}

/**
 * Dark share (grey level under `t`) of the filled pixels within 0.8 to 1.05 of the ellipse `e`: a
 * black area is dark to its edge (white ring lines cut it into annuli), the closed line of a ring is not.
 */
function rimDarkness(grid: Grid, t: number, f: Filled, e: Ellipse): number {
  const { width: w, height: h, grey: g } = grid
  const c = conicOf(e)
  let [total, darkRim] = [0, 0]
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      if (f.outside[y * f.width + x]) continue
      const [px, py] = [x + f.left, y + f.top]
      const u2 = c[0] * px * px + c[1] * px * py + c[2] * py * py + c[3] * px + c[4] * py + c[5] + 1
      if (u2 < 0.64 || u2 > 1.1) continue
      total++
      if (px >= 0 && py >= 0 && px < w && py < h && f32(g, py * w + px) < t) darkRim++
    }
  return total ? darkRim / total : 0
}

/**
 * The blob of a filled component: a robust ellipse through its outline, else its moment ellipse,
 * rough. A component cut by the grid's border is fitted to its outline inside the grid, needs half
 * of the ellipse there and its centre inside, and has no moment ellipse: undefined otherwise.
 */
function blobOf(grid: Grid, t: number, f: Filled, m: Moments): Blob | undefined {
  const { n } = m
  const { width: w, height: h } = grid
  // the filled box has a margin of 1 px about the component
  const cut =
    f.left < 0 || f.top < 0 || f.left + f.width - 2 >= w - 1 || f.top + f.height - 2 >= h - 1
  const outline = cut
    ? m.outline.filter((p) => p.x > 0 && p.y > 0 && p.x < w - 1 && p.y < h - 1)
    : m.outline
  // a shadow or a neighbour joined to the black area leaves most of the outline on the ellipse
  const r0 = Math.sqrt(n / Math.PI)
  // about 300 outline points are enough for the fit
  const step = Math.max(1, Math.floor(outline.length / 300))
  const sparse = outline.filter((_, i) => i % step === 0)
  const fit = ransacEllipse(sparse, {
    tolerance: Math.max(1, 0.006 * r0),
    minPoints: Math.ceil(0.4 * sparse.length),
    rounds: 60,
  })
  const el = fit?.ellipse
  const ratio = el
    ? n / ((cut ? shareInside(el, w, h) : 1) * Math.PI * el.semiMajor * el.semiMinor)
    : 0
  const centred = el && el.centreX >= 0 && el.centreY >= 0 && el.centreX < w && el.centreY < h
  if (
    fit &&
    el &&
    ratio >= 0.85 &&
    ratio <= 1.3 &&
    (!cut || (centred && shareInside(el, w, h) >= 0.5))
  )
    return {
      threshold: t,
      area: n,
      ellipse: el,
      fill: ratio,
      relativeRms: fit.rms / meanRadius(el),
      outlineInlierShare: fit.inliers.length / sparse.length,
      rimDarkShare: rimDarkness(grid, t, f, el),
      outline,
    }
  if (cut) return undefined
  // no clean outline: the moment ellipse is a start for `refineEdge`
  const moment = {
    centreX: m.mx,
    centreY: m.my,
    semiMajor: 2 * Math.sqrt(m.l1),
    semiMinor: 2 * Math.sqrt(m.l2),
    angle: 0.5 * Math.atan2(2 * m.vxy, m.vxx - m.vyy),
  }
  return {
    threshold: t,
    area: n,
    ellipse: moment,
    fill: m.fill,
    relativeRms: Number.NaN,
    outlineInlierShare: 0,
    rimDarkShare: rimDarkness(grid, t, f, moment),
    outline,
    rough: true,
  }
}

/** Share of the ellipse's area inside the grid of `w` by `h` px, from a 40 x 40 lattice over it. */
export function shareInside(e: Ellipse, w: number, h: number): number {
  const [c, s] = [Math.cos(e.angle), Math.sin(e.angle)]
  let [inside, total] = [0, 0]
  for (let i = 0; i < 40; i++)
    for (let j = 0; j < 40; j++) {
      const [u, v] = [((i + 0.5) / 20 - 1) * e.semiMajor, ((j + 0.5) / 20 - 1) * e.semiMinor]
      if ((u / e.semiMajor) ** 2 + (v / e.semiMinor) ** 2 > 1) continue
      total++
      const [x, y] = [e.centreX + c * u - s * v, e.centreY + s * u + c * v]
      if (x >= -0.5 && y >= -0.5 && x < w - 0.5 && y < h - 0.5) inside++
    }
  return inside / total
}

/**
 * The black area: nine thresholds between the 2nd and the 98th percentile of the grey levels, the
 * compact dark components (also those the photo's edge cuts), filled, each fitted by a robust ellipse
 * (single Otsu failed on shadow and glare). The distinct candidates, best first: the area times
 * how well the outline fits, with a small bonus for the thresholds at which the same ellipse
 * stands.
 */
export function blackAreas(grid: Grid): Array<Blob & { stable: number }> {
  const lo = quantile(grid.grey, 0.02)
  const hi = quantile(grid.grey, 0.98)
  if (hi - lo < 40) return []
  const minArea = Math.max(400, 0.0035 * grid.width * grid.height)
  const all = thresholdSweep(grid, lo, hi, minArea)
  all.push(...refineRough(grid, all))
  return rankDistinct(grid, all)
}

/** The blobs at nine thresholds evenly between the grey levels `lo` and `hi`. */
function thresholdSweep(grid: Grid, lo: number, hi: number, minArea: number): Blob[] {
  const all: Blob[] = []
  for (let k = 1; k <= 9; k++) all.push(...blobsAt(grid, lo + ((hi - lo) * k) / 10, minArea))
  return all
}

/** A component joined to a shadow: its edge along rays from the moment ellipse, for the three largest rough blobs. */
function refineRough(grid: Grid, all: readonly Blob[]): Blob[] {
  const out: Blob[] = []
  const rough = all
    .filter((b) => b.rough)
    .sort((a, b) => b.area - a.area)
    .slice(0, 3)
  for (const b of rough) {
    const e = refineEdge(grid, b.ellipse, 0.3)
    if (e && e.support >= 0.5 && e.rms <= 0.012 * meanRadius(e.ellipse))
      out.push({
        ...b,
        ellipse: e.ellipse,
        relativeRms: e.rms / meanRadius(e.ellipse),
        outlineInlierShare: e.support,
        rough: false,
      })
  }
  return out
}

/** Two ellipses of one black area: centres within 8 % and mean radii within 12 % of each other. */
function sameEllipse(a: Ellipse, b: Ellipse): boolean {
  const r = meanRadius(a)
  return (
    Math.hypot(a.centreX - b.centreX, a.centreY - b.centreY) < 0.08 * r &&
    Math.abs(meanRadius(b) / r - 1) < 0.12
  )
}

/**
 * Share of the points in the photo 1.1 to 1.3 times out from the ellipse that are lighter than `t`:
 * the paper about a black area, not the black about a disc inside it.
 */
function paperAround(grid: Grid, e: Ellipse, t: number): number {
  let [light, total] = [0, 0]
  for (let k = 0; k < 72; k++)
    for (const u of [1.1, 1.2, 1.3]) {
      const p = ellipsePoint(
        { ...e, semiMajor: u * e.semiMajor, semiMinor: u * e.semiMinor },
        (2 * Math.PI * k) / 72,
      )
      const [x, y] = [Math.round(p.x), Math.round(p.y)]
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue
      total++
      if (f32(grid.grey, y * grid.width + x) >= t) light++
    }
  return total ? light / total : 0
}

/** The clean blobs with paper about them ranked best first, the first two that are distinct ellipses. */
function rankDistinct(grid: Grid, all: readonly Blob[]): Array<Blob & { stable: number }> {
  const rated = all
    .filter(
      (b) =>
        !b.rough &&
        b.relativeRms <= 0.025 &&
        b.outlineInlierShare >= 0.7 &&
        b.rimDarkShare >= 0.6 &&
        paperAround(grid, b.ellipse, b.threshold) >= 0.6,
    )
    .map((b) => {
      const stable = new Set(
        all.filter((o) => sameEllipse(b.ellipse, o.ellipse)).map((o) => o.threshold),
      ).size
      return {
        ...b,
        stable,
        key:
          b.area *
          b.rimDarkShare *
          b.outlineInlierShare *
          Math.exp(-b.relativeRms / 0.01) *
          (1 + 0.1 * stable),
      }
    })
    .sort((a, b) => b.key - a.key)
  const out: Array<Blob & { stable: number }> = []
  for (const b of rated) if (!out.some((o) => sameEllipse(o.ellipse, b.ellipse))) out.push(b)
  return out.slice(0, 2)
}

/**
 * The edge of an ellipse refined along its normals: on each of 180 rays the position within
 * `reach` (a share of the radius) where the grey level crosses halfway between the inside and the
 * outside and stays on the paper side, then a robust ellipse fit to those edge points. Undefined
 * when the rays do not agree on an edge.
 */
export function refineEdge(
  grid: Grid,
  start: Ellipse,
  reach = 0.1,
): { ellipse: Ellipse; inside: number; outside: number; support: number; rms: number } | undefined {
  const r = meanRadius(start)
  const span = Math.max(4, reach * r)
  const rays = 180
  const pts: Point[] = []
  const levels: Array<[number, number]> = []
  for (let k = 0; k < rays; k++) {
    const edge = edgeAlongRay(grid, start, (2 * Math.PI * k) / rays, span)
    if (!edge) continue
    pts.push(edge.point)
    levels.push([edge.inside, edge.outside])
  }
  if (pts.length < 0.5 * rays) return undefined
  const fit = ransacEllipse(pts, {
    tolerance: Math.max(0.6, 0.004 * r),
    minPoints: Math.floor(0.5 * pts.length),
  })
  if (!fit) return undefined
  return {
    ellipse: fit.ellipse,
    inside: levels.reduce((s, l) => s + l[0], 0) / levels.length,
    outside: levels.reduce((s, l) => s + l[1], 0) / levels.length,
    support: fit.inliers.length / rays,
    rms: fit.rms,
  }
}

/** The offset along the ray, from -span to span, of the upward crossing of `mid` nearest the ellipse. */
function firstCrossing(at: (o: number) => number, span: number, mid: number): number | undefined {
  let found: number | undefined
  const step = 0.25
  let prev = at(-span)
  for (let o = -span + step; o <= span; o += step) {
    const v = at(o)
    if (prev < mid && v >= mid) {
      const cand = o - step + ((mid - prev) / (v - prev)) * step
      if (
        paperSideHolds(at, o, span, mid) &&
        (found === undefined || Math.abs(cand) < Math.abs(found))
      )
        found = cand
    }
    prev = v
  }
  return found
}

/** A thin line is not the edge: the paper side stays above halfway over half the span. */
function paperSideHolds(at: (o: number) => number, o: number, span: number, mid: number) {
  let above = 0
  let total = 0
  for (let q = o; q <= Math.min(span, o + span / 2); q += 0.5) {
    total++
    if (at(q) >= mid) above++
  }
  return above >= 0.7 * total
}

/**
 * The edge on the normal of `start` at parameter `t` (rad), within `span` grid px of the ellipse,
 * and the median grey levels inside and outside; undefined without a contrast or a crossing.
 */
function edgeAlongRay(
  grid: Grid,
  start: Ellipse,
  t: number,
  span: number,
): { point: Point; inside: number; outside: number } | undefined {
  const { width: w, height: h, grey: g } = grid
  const [c, sn] = [Math.cos(start.angle), Math.sin(start.angle)]
  const median = (v: number[]) =>
    nth(
      v.sort((a, b) => a - b),
      v.length >> 1,
    )
  // the outward normal of the ellipse at parameter t
  const nx = (Math.cos(t) * c) / start.semiMajor - (Math.sin(t) * sn) / start.semiMinor
  const ny = (Math.cos(t) * sn) / start.semiMajor + (Math.sin(t) * c) / start.semiMinor
  const nl = Math.hypot(nx, ny)
  const [dx, dy] = [nx / nl, ny / nl]
  const px = start.centreX + start.semiMajor * Math.cos(t) * c - start.semiMinor * Math.sin(t) * sn
  const py = start.centreY + start.semiMajor * Math.cos(t) * sn + start.semiMinor * Math.sin(t) * c
  const at = (o: number) => sampleBilinear(g, w, h, px + dx * o, py + dy * o)
  const inner: number[] = []
  const outer: number[] = []
  for (let o = -span; o <= -span / 2; o += 0.5) inner.push(at(o))
  for (let o = span / 2; o <= span; o += 0.5) outer.push(at(o))
  const [lo, hi] = [median(inner), median(outer)]
  // the black area is darker inside than outside
  if (hi - lo < 25) return undefined
  const mid = (lo + hi) / 2
  const found = firstCrossing(at, span, mid)
  if (found === undefined) return undefined
  return { point: { x: px + dx * found, y: py + dy * found }, inside: lo, outside: hi }
}

/** One-dimensional Gaussian kernel of derivative order 0, 1 or 2 at `sigma` (grid px), length 2 ceil(3 sigma) + 1. */
function kernel(sigma: number, order: 0 | 1 | 2): Float32Array {
  const r = Math.max(2, Math.ceil(3 * sigma))
  const k = new Float32Array(2 * r + 1)
  let sum = 0
  for (let i = -r; i <= r; i++) {
    const g = Math.exp(-(i * i) / (2 * sigma * sigma))
    k[i + r] = gaussianDerivative(g, i, sigma, order)
    if (order === 0) sum += g
  }
  if (order === 0) for (let i = 0; i < k.length; i++) k[i] = f32(k, i) / sum
  else normaliseDerivative(k, r, order)
  return k
}

/** The Gaussian value `g` at offset `i` as the derivative of the given order. */
function gaussianDerivative(g: number, i: number, sigma: number, order: 0 | 1 | 2): number {
  if (order === 0) return g
  if (order === 1) return (-i / (sigma * sigma)) * g
  return ((i * i) / sigma ** 4 - 1 / (sigma * sigma)) * g
}

/** Zero mean for the second derivative, unit moment for the first. */
function normaliseDerivative(k: Float32Array, r: number, order: 1 | 2) {
  let m = 0
  let mom = 0
  for (let i = -r; i <= r; i++) {
    m += f32(k, i + r)
    mom += i * f32(k, i + r)
  }
  if (order === 2) for (let i = 0; i < k.length; i++) k[i] = f32(k, i) - m / k.length
  else for (let i = -r; i <= r; i++) k[i + r] = f32(k, i + r) / -mom
}

/** 1 for a kernel with k[-i] = k[i], -1 for one with k[-i] = -k[i] (the Gaussian derivatives of order 0, 2 and 1). */
const parity = (k: Float32Array): 1 | -1 =>
  Math.abs(f32(k, 0) - f32(k, k.length - 1)) <= 1e-6 * (Math.abs(f32(k, 0)) + 1e-12) ? 1 : -1

function convolve(
  src: Float32Array,
  w: number,
  h: number,
  kx: Float32Array,
  ky: Float32Array,
): Float32Array {
  const tmp = convolveRows(src, w, h, kx, parity(kx))
  return convolveColumns(tmp, w, h, ky, parity(ky))
}

/** The kernel `kx` (parity `px`) over row `row` at column `x`; the row's edge pixels repeat. */
function rowSum(
  src: Float32Array,
  row: number,
  x: number,
  w: number,
  kx: Float32Array,
  px: 1 | -1,
): number {
  const rx = (kx.length - 1) / 2
  let s = f32(kx, rx) * f32(src, row + x)
  if (x >= rx && x < w - rx)
    for (let i = 1; i <= rx; i++)
      s += f32(kx, rx + i) * (f32(src, row + x + i) + px * f32(src, row + x - i))
  else
    for (let i = 1; i <= rx; i++)
      s +=
        f32(kx, rx + i) *
        (f32(src, row + clamp(x + i, 0, w - 1)) + px * f32(src, row + clamp(x - i, 0, w - 1)))
  return s
}

function convolveRows(src: Float32Array, w: number, h: number, kx: Float32Array, px: 1 | -1) {
  const tmp = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      const s = rowSum(src, row, x, w, kx, px)
      tmp[row + x] = s
    }
  }
  return tmp
}

/** The columns, a row at a time: the reads stay in order. */
function convolveColumns(tmp: Float32Array, w: number, h: number, ky: Float32Array, py: 1 | -1) {
  const ry = (ky.length - 1) / 2
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    const mid = f32(ky, ry)
    for (let x = 0; x < w; x++) out[row + x] = mid * f32(tmp, row + x)
    for (let i = 1; i <= ry; i++) {
      const [k, up, down] = [
        f32(ky, ry + i),
        clamp(y + i, 0, h - 1) * w,
        clamp(y - i, 0, h - 1) * w,
      ]
      for (let x = 0; x < w; x++)
        out[row + x] = f32(out, row + x) + k * (f32(tmp, up + x) + py * f32(tmp, down + x))
    }
  }
  return out
}

type Ridges = {
  /** Thin ridge pixels with a sub-pixel position on the grid, grouped by 8-connected component. */
  components: Point[][]
}

/**
 * Hessian ridges of the ring lines (dark lines on light paper and light lines on black), at the
 * scales `sigmas` (grid px): the stronger eigenvalue of the Hessian, scaled by sigma squared,
 * where the other one is under a third of it, thinned along the normal, with the grey levels
 * `2 sigma` to both sides lower (or higher) than the line: a step edge gives one side only.
 * Hysteresis between `low` and `high` times the 99th percentile of the strength, then 8-connected
 * components of at least `minLength` pixels. Only pixels where `searchMask` is set are looked at.
 */
export function ridges(
  grid: Grid,
  searchMask: Uint8Array,
  sigmas: number[],
  minLength: number,
): Ridges {
  const hessian = hessianStrength(grid, searchMask, sigmas)
  const inside: number[] = []
  for (let i = 0; i < hessian.strength.length; i++) {
    const s = f32(hessian.strength, i)
    if (s > 0) inside.push(s)
  }
  if (inside.length < 50) return { components: [] }
  const p99 = quantile(Float32Array.from(inside), 0.99)
  const thin = thinRidges(grid, hessian, 0.12 * p99, 0.3 * p99)
  return { components: hysteresisComponents(thin, grid.width, grid.height, minLength) }
}

type Hessian = {
  strength: Float32Array
  normalX: Float32Array
  normalY: Float32Array
  sgn: Int8Array
  sigmaAt: Float32Array
}

/**
 * Per pixel the strongest line response over the scales (the dominant Hessian eigenvalue times
 * sigma squared, where the other is under a third of it), its normal, its sign (1 bright, -1 dark)
 * and its sigma.
 */
function hessianStrength(grid: Grid, searchMask: Uint8Array, sigmas: number[]) {
  const n = grid.width * grid.height
  const acc = {
    strength: new Float32Array(n),
    normalX: new Float32Array(n),
    normalY: new Float32Array(n),
    sgn: new Int8Array(n),
    sigmaAt: new Float32Array(n),
  }
  for (const sigma of sigmas) accumulateScale(grid, searchMask, sigma, acc)
  return acc
}

/** The vector scaled to length 1, (1, 0) for a null one. */
function unitVector(vx: number, vy: number): [number, number] {
  const l = Math.hypot(vx, vy)
  return l < 1e-9 ? [1, 0] : [vx / l, vy / l]
}

/** Raises the line response in `acc` where the scale `sigma` gives a stronger one. */
function accumulateScale(
  { width: w, height: h, grey: g }: Grid,
  searchMask: Uint8Array,
  sigma: number,
  { strength, normalX, normalY, sgn, sigmaAt }: Hessian,
) {
  const n = w * h
  const [k0, k1, k2] = [kernel(sigma, 0), kernel(sigma, 1), kernel(sigma, 2)]
  const lxx = convolve(g, w, h, k2, k0)
  const lyy = convolve(g, w, h, k0, k2)
  const lxy = convolve(g, w, h, k1, k1)
  const s2 = sigma * sigma
  for (let i = 0; i < n; i++) {
    if (!searchMask[i]) continue
    const [xx, yy, xy] = [f32(lxx, i), f32(lyy, i), f32(lxy, i)]
    const mid = (xx + yy) / 2
    const half = (xx - yy) / 2
    const rad = Math.sqrt(half * half + xy * xy)
    const [e1, e2] = [mid + rad, mid - rad]
    // bright line: e2 very negative; dark line: e1 very positive
    const bright = -e2 > e1
    const [main, other] = bright ? [-e2, Math.abs(e1)] : [e1, Math.abs(e2)]
    if (other > main / 3) continue
    const v = main * s2
    if (v <= f32(strength, i)) continue
    strength[i] = v
    sgn[i] = bright ? 1 : -1
    sigmaAt[i] = sigma
    // normal: eigenvector of the dominant eigenvalue
    const e = bright ? e2 : e1
    ;[normalX[i], normalY[i]] = unitVector(xy, e - xx)
  }
}

/** Whether either neighbour is stronger than `v`. */
const exceeds = (v: number, a: number, b: number) => a > v || b > v

/** A line, not a step: both sides at distance `d` along the normal are lower (bright) or higher (dark). */
function isLine(
  g: Float32Array,
  w: number,
  h: number,
  x: number,
  y: number,
  nx: number,
  ny: number,
  sign: number,
  d: number,
): boolean {
  const i = y * w + x
  const [a, b] = [
    sampleBilinear(g, w, h, x + nx * d, y + ny * d),
    sampleBilinear(g, w, h, x - nx * d, y - ny * d),
  ]
  const diffA = sign * (f32(g, i) - a)
  const diffB = sign * (f32(g, i) - b)
  return !(Math.min(diffA, diffB) < 0.35 * Math.max(diffA, diffB) || !(diffA > 0 && diffB > 0))
}

/** The sub-pixel offset of the peak by a parabola through the three strengths. */
function parabolaOffset(m1: number, v: number, p1: number): number {
  const den = m1 - 2 * v + p1
  return den < 0 ? clamp((0.5 * (m1 - p1)) / den, -0.5, 0.5) : 0
}

/**
 * The response thinned along the normal to lines (both sides at 2 sigma lower or higher, not a
 * step): `thin` is 2 at or above `high`, 1 at or above `low`; `sub` holds the sub-pixel positions.
 */
function thinRidges(
  grid: Grid,
  { strength, normalX, normalY, sgn, sigmaAt }: Hessian,
  low: number,
  high: number,
): { thin: Uint8Array; sub: Float32Array } {
  const { width: w, height: h, grey: g } = grid
  const n = w * h
  const thin = new Uint8Array(n)
  const sub = new Float32Array(2 * n)
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x
      const v = f32(strength, i)
      if (v < low) continue
      const [nx, ny] = [f32(normalX, i), f32(normalY, i)]
      const at = (o: number) => f32(strength, Math.round(y + ny * o) * w + Math.round(x + nx * o))
      if (exceeds(v, at(1), at(-1))) continue
      if (!isLine(g, w, h, x, y, nx, ny, i8(sgn, i), 2 * f32(sigmaAt, i))) continue
      thin[i] = v >= high ? 2 : 1
      // sub-pixel offset along the normal by a parabola through the three strengths
      const off = parabolaOffset(at(-1), v, at(1))
      sub[2 * i] = x + nx * off
      sub[2 * i + 1] = y + ny * off
    }
  return { thin, sub }
}

/** Hysteresis: the 8-connected components of the thin pixels that hold a strong one, of at least `minLength` pixels. */
function hysteresisComponents(
  { thin, sub }: { thin: Uint8Array; sub: Float32Array },
  w: number,
  h: number,
  minLength: number,
): Point[][] {
  const n = w * h
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = thin[i] ? 1 : 0
  const { lab, area } = label(mask, w, h)
  const strong = new Uint8Array(area.length)
  for (let i = 0; i < n; i++) if (thin[i] === 2 && i32(lab, i) >= 0) strong[i32(lab, i)] = 1
  const comps: Point[][] = area.map(() => [])
  for (let i = 0; i < n; i++) {
    const k = i32(lab, i)
    if (k >= 0 && strong[k]) nth(comps, k).push({ x: f32(sub, 2 * i), y: f32(sub, 2 * i + 1) })
  }
  return comps.filter((c) => c.length >= minLength)
}
