/**
 * The outline of a cut-out bullet (`apps/docs/docs/models/bullet-photo.md`): the axis found as the
 * symmetry line of both edges, and the half-width profile along it. Lengths are in photo px, y
 * down. Pure: no React, DOM or Next.js, so it can run in a Web Worker.
 */
import type { Segmentation } from './bullet-photo.ts'
import type { Point } from './target-geometry.ts'

// Unchecked pixel-buffer reads inside loops whose bounds keep the index in range; module-local so the calls inline.
const at = (a: ArrayLike<number>, i: number) => a[i] as number

/** The half-width profile of the bullet along its axis, photo px. */
export interface Outline {
  /** Where the axis crosses the base. */
  origin: Point
  /** The direction of the axis from the base to the tip, rad (y down). */
  angle: number
  /** From the base to the tip along the axis. */
  length: number
  /** Distance from the base of each sample, 1 px apart, the 1 px at each end left out. */
  z: number[]
  /** Half the width of the bullet at each sample. */
  r: number[]
  /** Whether the nose end was told apart from the base end by its longer taper only within 15 %, so a flip may be right. */
  ambiguous: boolean
}

/** What the outline search is told: the axis direction (base to tip) when the user fixed it. */
export interface OutlineOptions {
  angle?: number | undefined
}

interface Frame {
  ox: number
  oy: number
  ux: number
  uy: number
}

/** The frame with origin `o` and axis direction `theta`: a point is `o + u s + v t`, v turned 90 degrees from u. */
const frameOf = (o: Point, theta: number): Frame => ({
  ox: o.x,
  oy: o.y,
  ux: Math.cos(theta),
  uy: Math.sin(theta),
})

/** The coverage of `alpha` (0..1) at a point, bilinear between pixel centres; 0 outside. */
function coverage(seg: Segmentation, x: number, y: number): number {
  const { width: w, height: h, alpha } = seg
  const [fx, fy] = [x - 0.5, y - 0.5]
  const [i, j] = [Math.floor(fx), Math.floor(fy)]
  const [a, b] = [fx - i, fy - j]
  const px = (u: number, v: number) =>
    u < 0 || v < 0 || u >= w || v >= h ? 0 : at(alpha, v * w + u)
  return (
    ((1 - a) * (1 - b) * px(i, j) +
      a * (1 - b) * px(i + 1, j) +
      (1 - a) * b * px(i, j + 1) +
      a * b * px(i + 1, j + 1)) /
    255
  )
}

/** Where `value` first crosses one half going from `t0` towards `t1`, interpolated between samples `step` apart; undefined when it does not. */
function crossing(
  value: (t: number) => number,
  t0: number,
  t1: number,
  step: number,
): number | undefined {
  const dir = Math.sign(t1 - t0)
  let prev = value(t0)
  for (let t = t0 + dir * step; dir * (t1 - t) >= 0; t += dir * step) {
    const cur = value(t)
    if (prev < 0.5 !== cur < 0.5) return t - dir * step + (dir * step * (0.5 - prev)) / (cur - prev)
    prev = cur
  }
}

interface Column {
  s: number
  top: number
  bottom: number
}

/** The extent of the bullet pixels along (s) and across (t) a frame. */
interface Extent {
  sLo: number
  sHi: number
  tLo: number
  tHi: number
}

/** The extent of the pixels of at least half coverage in the frame. */
function extents(seg: Segmentation, f: Frame): Extent {
  const { width: w, alpha } = seg
  const e = { sLo: Infinity, sHi: -Infinity, tLo: Infinity, tHi: -Infinity }
  for (let i = 0; i < alpha.length; i++) {
    if (at(alpha, i) < 128) continue
    const [dx, dy] = [(i % w) + 0.5 - f.ox, Math.floor(i / w) + 0.5 - f.oy]
    const [s, t] = [dx * f.ux + dy * f.uy, -dx * f.uy + dy * f.ux]
    e.sLo = Math.min(e.sLo, s)
    e.sHi = Math.max(e.sHi, s)
    e.tLo = Math.min(e.tLo, t)
    e.tHi = Math.max(e.tHi, t)
  }
  return e
}

/** The edges of the bullet across the axis at each integer `s` from `sLo` to `sHi`; columns without two edges are left out. */
function columns(seg: Segmentation, f: Frame, sLo: number, sHi: number, e: Extent): Column[] {
  const out: Column[] = []
  for (let s = sLo; s <= sHi; s++) {
    const across = (t: number) =>
      coverage(seg, f.ox + f.ux * s - f.uy * t, f.oy + f.uy * s + f.ux * t)
    const top = crossing(across, e.tLo - 1.5, e.tHi + 1.5, 0.5)
    const bottom = crossing(across, e.tHi + 1.5, e.tLo - 1.5, 0.5)
    if (top !== undefined && bottom !== undefined && bottom > top) out.push({ s, top, bottom })
  }
  return out
}

/** The columns between the ends of the extent, 2 px in from each. */
const columnsOf = (seg: Segmentation, f: Frame, e: Extent) =>
  columns(seg, f, Math.ceil(e.sLo) + 2, Math.floor(e.sHi) - 2, e)

/** The centroid and the long axis (image moments, Hu 1962) of the pixels of at least half coverage. */
function momentsOf(seg: Segmentation): { x: number; y: number; theta: number } | undefined {
  const { width: w, alpha } = seg
  let [n, sx, sy, sxx, sxy, syy] = [0, 0, 0, 0, 0, 0]
  for (let i = 0; i < alpha.length; i++) {
    if (at(alpha, i) < 128) continue
    const [x, y] = [(i % w) + 0.5, Math.floor(i / w) + 0.5]
    ;[n, sx, sy, sxx, sxy, syy] = [n + 1, sx + x, sy + y, sxx + x * x, sxy + x * y, syy + y * y]
  }
  if (n < 50) return
  const [cx, cy] = [sx / n, sy / n]
  const theta = 0.5 * Math.atan2(2 * (sxy / n - cx * cy), sxx / n - cx * cx - (syy / n - cy * cy))
  return { x: cx, y: cy, theta }
}

const sum = (xs: readonly number[]) => xs.reduce((a, v) => a + v, 0)

/**
 * The line `c = a + b s` through the middles of the two edges where the bullet is at least 0.3 of
 * its widest, `s` from the origin of the frame; `b` is 0 for a fixed axis. Undefined for fewer than 10 columns.
 */
function middleLine(seg: Segmentation, o: Point, theta: number, fixed: boolean) {
  const f = frameOf(o, theta)
  const cols = columnsOf(seg, f, extents(seg, f))
  const widest = Math.max(...cols.map((c) => c.bottom - c.top))
  const use = cols.filter((c) => c.bottom - c.top >= 0.3 * widest)
  if (use.length < 10) return
  const [s, mid] = [use.map((c) => c.s), use.map((c) => (c.top + c.bottom) / 2)]
  const [n, ss, sc] = [use.length, sum(s), sum(mid)]
  const sss = sum(s.map((v) => v * v))
  const ssc = sum(s.map((v, i) => v * at(mid, i)))
  const det = n * sss - ss * ss
  const b = !fixed && det > 0 ? (n * ssc - ss * sc) / det : 0
  return { a: (sc - b * ss) / n, b }
}

interface Axis {
  o: Point
  theta: number
}

/** Turns and shifts the axis until the middle of the two edges lies on it (4 passes of a least squares line); a fixed axis is only shifted. */
function settleAxis(seg: Segmentation, start: Axis, fixed: boolean): Axis | undefined {
  let { o, theta } = start
  for (let pass = 0; pass < 4; pass++) {
    const line = middleLine(seg, o, theta, fixed)
    if (!line) return
    const f = frameOf(o, theta)
    o = { x: o.x - f.uy * line.a, y: o.y + f.ux * line.a }
    theta += Math.atan(line.b)
    if (Math.abs(line.b) < 1e-6 && Math.abs(line.a) < 1e-3) break
  }
  return { o, theta }
}

/** How far each end of the bullet runs before it is 90 % of its widest, in samples. */
function tapers(cols: readonly Column[]): [number, number] {
  const widths = cols.map((c) => c.bottom - c.top)
  const full = 0.9 * Math.max(...widths)
  return [
    widths.findIndex((v) => v >= full),
    widths.length - 1 - widths.findLastIndex((v) => v >= full),
  ]
}

/** The axis turned so the nose, the end with the longer taper, is at the tip; whether the two tapers are within 15 %. */
function orient(seg: Segmentation, axis: Axis): (Axis & { ambiguous: boolean }) | undefined {
  const f = frameOf(axis.o, axis.theta)
  const cols = columnsOf(seg, f, extents(seg, f))
  if (cols.length < 10) return
  const [low, high] = tapers(cols)
  return {
    ...axis,
    theta: low > high ? axis.theta + Math.PI : axis.theta,
    ambiguous: Math.abs(low - high) < 0.15 * Math.max(low, high),
  }
}

/** The profile along the axis, from where it crosses the base to where it leaves the tip. */
function profileOf(seg: Segmentation, axis: Axis, ambiguous: boolean): Outline | undefined {
  const f = frameOf(axis.o, axis.theta)
  const e = extents(seg, f)
  const along = (s: number) => coverage(seg, f.ox + f.ux * s, f.oy + f.uy * s)
  const quarter = 0.25 * (e.sHi - e.sLo)
  const base = crossing(along, e.sLo - 3, e.sLo + quarter, 0.25)
  const tip = crossing(along, e.sHi + 3, e.sHi - quarter, 0.25)
  if (base === undefined || tip === undefined || tip - base < 20) return
  const cols = columns(seg, f, Math.ceil(base) + 1, Math.floor(tip) - 1, e)
  return {
    origin: { x: f.ox + f.ux * base, y: f.oy + f.uy * base },
    angle: Math.atan2(f.uy, f.ux),
    length: tip - base,
    z: cols.map((c) => c.s - base),
    r: cols.map((c) => (c.bottom - c.top) / 2),
    ambiguous,
  }
}

/**
 * The outline of the segmented bullet. The axis starts at the long axis of the pixels and is
 * turned and shifted until the middle of the two edges lies on it: the symmetry line of both
 * edges. The nose end is the end with the longer taper. A fixed `angle` is kept and only the offset
 * is fitted. Undefined without a bullet.
 */
export function fitOutline(seg: Segmentation, opt: OutlineOptions = {}): Outline | undefined {
  const m = momentsOf(seg)
  if (!m) return
  const fixed = opt.angle !== undefined
  const axis = settleAxis(seg, { o: { x: m.x, y: m.y }, theta: opt.angle ?? m.theta }, fixed)
  if (!axis) return
  const turned = fixed ? { ...axis, ambiguous: false } : orient(seg, axis)
  return turned && profileOf(seg, turned, turned.ambiguous)
}
