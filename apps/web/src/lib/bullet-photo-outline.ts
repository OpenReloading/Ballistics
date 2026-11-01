/**
 * The outline of a cut-out bullet (`apps/docs/docs/models/bullet-photo.md`): the axis found as the
 * symmetry line of both edges, and the half-width profile along it. Lengths are in photo px, y
 * down. Pure: no React, DOM or Next.js, so it can run in a Web Worker.
 */
import type { Cutout } from './bullet-photo.ts'
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
  /** The distance of each side's edge from the axis at each sample: the side to the left of the axis seen from the base, and the one to the right. */
  sides?: { left: number[]; right: number[] } | undefined
  /** The side a shadow widens (`withoutShadow`): `removed` when it is taken out, by measuring the other side mirrored about the axis, with nothing left to doubt. */
  shadow?: { side: 'left' | 'right'; removed: boolean } | undefined
  /** Whether the nose end was told apart from the base end by its longer taper only within 15 %, so a flip may be right. */
  ambiguous: boolean
  /** Standard uncertainty of an edge position, px: `edgeUncertainty` of a sharp edge, more where the edge is spread. */
  edge: number
}

/** What the outline search is told: the axis direction (base to tip) when the user fixed it, and the width the cut-out's edge is spread over, px. */
export interface OutlineOptions {
  angle?: number | undefined
  edgeSpread?: number | undefined
}

/** Standard uncertainty of an edge position at a sharp edge, px: the edge is found at half coverage between samples, a uniform error of one px (1/sqrt(12) = 0.29 px) plus the noise of the grey. */
export const edgeUncertainty = 0.3

/** Edges spread over this many px or less keep the sharp edge's uncertainty. */
const sharpSpread = 3

/** The standard uncertainty of an edge position where the edge is spread over `spread` px: one px more for each px beyond a sharp edge's spread, in quadrature (the edge of a soft shadow can lie anywhere within its spread). */
const edgeUncertaintyOf = (spread: number) =>
  Math.hypot(edgeUncertainty, Math.max(0, spread - sharpSpread))

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
function coverage(seg: Cutout, x: number, y: number): number {
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
function extents(seg: Cutout, f: Frame): Extent {
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
function columns(seg: Cutout, f: Frame, sLo: number, sHi: number, e: Extent): Column[] {
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
const columnsOf = (seg: Cutout, f: Frame, e: Extent) =>
  columns(seg, f, Math.ceil(e.sLo) + 2, Math.floor(e.sHi) - 2, e)

/** The centroid and the long axis (image moments, Hu 1962) of the pixels of at least half coverage. */
function momentsOf(seg: Cutout): { x: number; y: number; theta: number } | undefined {
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
function middleLine(seg: Cutout, o: Point, theta: number, fixed: boolean) {
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
function settleAxis(seg: Cutout, start: Axis, fixed: boolean): Axis | undefined {
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
function orient(seg: Cutout, axis: Axis): (Axis & { ambiguous: boolean }) | undefined {
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

/** How far the end of a cut-out lies beyond its extreme pixel centre along the axis, px (half a pixel's reach, a pixel being 1 px square). */
const extentReach = 0.35

/** The profile along the axis, from where it crosses the base to where it leaves the tip. */
function profileOf(seg: Cutout, axis: Axis, ambiguous: boolean, edge: number): Outline | undefined {
  const f = frameOf(axis.o, axis.theta)
  const e = extents(seg, f)
  const along = (s: number) => coverage(seg, f.ox + f.ux * s, f.oy + f.uy * s)
  const quarter = 0.25 * (e.sHi - e.sLo)
  // a reflection or the mouth of a hollow point can leave the axis itself uncovered: an end the
  // axis finds more than 3 px inside the extent of the cut-out is taken from the extent
  const [baseAxis, tipAxis] = [
    crossing(along, e.sLo - 3, e.sLo + quarter, 0.25),
    crossing(along, e.sHi + 3, e.sHi - quarter, 0.25),
  ]
  const base = baseAxis !== undefined && baseAxis - e.sLo < 3 ? baseAxis : e.sLo - extentReach
  const tip = tipAxis !== undefined && e.sHi - tipAxis < 3 ? tipAxis : e.sHi + extentReach
  if (tip - base < 20) return
  const cols = columns(seg, f, Math.ceil(base) + 1, Math.floor(tip) - 1, e)
  return {
    origin: { x: f.ox + f.ux * base, y: f.oy + f.uy * base },
    angle: Math.atan2(f.uy, f.ux),
    length: tip - base,
    z: cols.map((c) => c.s - base),
    r: cols.map((c) => (c.bottom - c.top) / 2),
    sides: { left: cols.map((c) => -c.top), right: cols.map((c) => c.bottom) },
    ambiguous,
    edge,
  }
}

/** The line `y = a + b x` through the points by least squares; undefined for fewer than two distinct x. */
function lineOf(xs: readonly number[], ys: readonly number[]) {
  const n = xs.length
  const [sx, sy] = [sum(xs), sum(ys)]
  const sxx = sum(xs.map((v) => v * v))
  const sxy = sum(xs.map((v, i) => v * at(ys, i)))
  const det = n * sxx - sx * sx
  if (!(det > 0)) return
  const b = (n * sxy - sx * sy) / det
  return { a: (sy - b * sx) / n, b }
}

const median = (xs: readonly number[]) => {
  const a = [...xs].sort((p, q) => p - q)
  const m = a.length >> 1
  return a.length % 2 ? at(a, m) : (at(a, m - 1) + at(a, m)) / 2
}

/** The shank is where the half width is at least this share of its widest. */
const shankShare = 0.97

/** The base's samples: this many, from where both sides have reached half their shank line and move by less than a px per sample, clear of the corner, which a slightly turned axis moves along one side. */
const baseCount = 6

/**
 * How far each side's edge at the base lies inside the line of that side's shank, px (left, right),
 * with each side's shank line and the samples `base` (start, end) taken as the base; undefined
 * without sides or a shank. The shank is where the half width is within 3 % of its widest, from
 * where it starts up to its middle.
 */
export function sideTapers(o: Outline) {
  const sides = o.sides
  if (!sides || o.r.length < 40) return
  const widest = Math.max(...o.r)
  const shank = o.r.flatMap((v, i) => (v >= shankShare * widest ? [i] : []))
  const first = shank[0]
  const last = shank.at(-1)
  if (first === undefined || last === undefined) return
  const use = shank.filter((i) => i <= (first + last) / 2 || i - first < 10)
  if (use.length < 10) return
  const z = use.map((i) => at(o.z, i))
  const shankLine = (side: readonly number[]) =>
    lineOf(
      z,
      use.map((i) => at(side, i)),
    )
  const [lineL, lineR] = [shankLine(sides.left), shankLine(sides.right)]
  if (!lineL || !lineR) return
  const level = (line: { a: number; b: number }, i: number) => line.a + line.b * at(o.z, i)
  const reached = o.z.findIndex(
    (_, i) =>
      at(sides.left, i) >= 0.5 * level(lineL, i) && at(sides.right, i) >= 0.5 * level(lineR, i),
  )
  if (reached < 0) return
  // past the corner, where neither side moves by a px from one sample to the next
  const settled = (i: number) =>
    Math.abs(at(sides.left, i + 1) - at(sides.left, i)) < 1 &&
    Math.abs(at(sides.right, i + 1) - at(sides.right, i)) < 1
  let start = reached
  while (start < first && !settled(start)) start++
  // a corner that does not settle before the shank (an axis turned far off on a squat bullet): two past it
  if (start + 1 + baseCount > first) start = reached + 1
  const base: [number, number] = [start + 1, start + 1 + baseCount]
  if (base[1] > first) return
  const zb = median(o.z.slice(...base))
  const taper = (line: { a: number; b: number }, side: readonly number[]) => ({
    line,
    taper: line.a + line.b * zb - median(side.slice(...base)),
  })
  return { left: taper(lineL, sides.left), right: taper(lineR, sides.right), base }
}

/** One side tapers at the base by more than this, px or share of the half width, while the other does not: a shadow, not a boat tail. */
const oneSidedTaper = (halfWidth: number) => Math.max(2.5, 0.02 * halfWidth)

/**
 * The outline with a one-sided shadow taken out. A body of revolution is symmetric about its axis;
 * a soft shadow beside it widens the cut-out on one side only, and where the shadow is offset along
 * the axis it leaves that side short at the base, so the base looks tapered on that side alone.
 * When one side's edge at the base lies inside its shank line by more than `oneSidedTaper` more
 * than the other's, the shadow is on that side. Where the shadow leaves the base clear, the base's
 * width plus the other (sharp) side's own taper is the shank's half width `a`. When both sides run
 * parallel over the base samples (the shadow's blurred end does not reach them) and `a` is below
 * the cut-out's shank half width (a shadow only widens it), the sharp side, taken from its shank
 * line, is measured for both sides, about the axis it gives, and where the shadow carries the
 * cut-out on past a flat tip the bullet ends with the sharp side. A flat tip with no such gap may
 * still carry the shadow in its length: the shadow is then named as not removed. Otherwise the
 * shadow is named and the outline kept.
 */
export function withoutShadow(o: Outline): Outline {
  const t = sideTapers(o)
  if (!t || !o.sides) return o
  const gap = t.right.taper - t.left.taper
  const half = median(o.r.slice(...t.base))
  const tol = oneSidedTaper(half)
  if (Math.abs(gap) <= tol) return o
  const [sharp, line, blurred, side] =
    gap > 0
      ? [o.sides.left, t.left, o.sides.right, 'right' as const]
      : [o.sides.right, t.right, o.sides.left, 'left' as const]
  // over the base samples a clear base runs parallel on both sides; a shadow's blurred end rises
  const [b0, b1] = t.base
  const rise = (v: readonly number[]) => median(v.slice(b1 - 2, b1)) - median(v.slice(b0, b0 + 2))
  const a = half + Math.max(0, line.taper)
  const widest = Math.max(...o.r)
  const shank = median(o.r.filter((v) => v >= shankShare * widest))
  const clear = a < shank && Math.abs(rise(blurred) - rise(sharp)) <= tol / 2
  if (!clear) return { ...o, shadow: { side, removed: false } }
  const r = o.z.map((z, i) => Math.max(0, at(sharp, i) - (line.line.a + line.line.b * z) + a))
  // beyond a flat tip the shadow alone can carry the cut-out on along the axis: the bullet ends
  // where the sharp side does, half a sample past its last
  const end = r.findLastIndex((v) => v > 0.5)
  const trimmed = end >= 0 && r.length - 1 - end >= 3
  const keep = trimmed ? end + 1 : r.length
  const kept = r.slice(0, keep)
  // a flat tip the shadow runs past by less than its meplat leaves no gap to trim: its length may still carry the shadow
  const flatTip = median(kept.slice(-3)) > Math.max(2, 0.1 * a)
  // the axis the sharp side gives: moved across to it and turned along its shank line
  const s = side === 'right' ? -1 : 1
  const shift = s * (line.line.a - a)
  const angle = o.angle + Math.atan(s * line.line.b)
  return {
    ...o,
    origin: {
      x: o.origin.x - Math.sin(o.angle) * shift,
      y: o.origin.y + Math.cos(o.angle) * shift,
    },
    angle,
    ...(trimmed && { length: at(o.z, end) + 0.5 }),
    z: o.z.slice(0, keep),
    r: kept,
    sides: { left: kept, right: kept },
    shadow: { side, removed: trimmed || !flatTip },
  }
}

/**
 * The outline of the segmented bullet. The axis starts at the long axis of the pixels and is
 * turned and shifted until the middle of the two edges lies on it: the symmetry line of both
 * edges. The nose end is the end with the longer taper. A fixed `angle` is kept and only the offset
 * is fitted. A shadow that widens one side is taken out (`withoutShadow`) when the axis is found,
 * not fixed. Undefined without a bullet.
 */
export function fitOutline(seg: Cutout, opt: OutlineOptions = {}): Outline | undefined {
  const m = momentsOf(seg)
  if (!m) return
  const fixed = opt.angle !== undefined
  const axis = settleAxis(seg, { o: { x: m.x, y: m.y }, theta: opt.angle ?? m.theta }, fixed)
  if (!axis) return
  const turned = fixed ? { ...axis, ambiguous: false } : orient(seg, axis)
  const o =
    turned && profileOf(seg, turned, turned.ambiguous, edgeUncertaintyOf(opt.edgeSpread ?? 0))
  // an axis the user fixed is not the symmetry line, so the two sides need not agree
  return o && (fixed ? o : withoutShadow(o))
}
