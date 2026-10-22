/**
 * Geometry of a target photo: image pixels (x right, y down) to
 * target coordinates (x right, y up) from scale references, a known rectangle for perspective and
 * a rotation. Unit-free: target coordinates are in the unit of the reference lengths (the record
 * uses m; "mm" below reads as that unit). Pure: no React, DOM or Next.js.
 */

export type Point = { x: number; y: number }
/** A 3 x 3 matrix in row-major order, acting on homogeneous points (x, y, 1). */
export type Matrix = readonly number[]

/** A scale reference on the photo, its points in image pixels and its lengths in mm. */
export type Reference =
  | { kind: 'line'; a: Point; b: Point; length: number }
  | { kind: 'ringCentre'; centre: Point; edge: Point; diameter: number }
  | { kind: 'ringEdge'; points: readonly [Point, Point, Point]; diameter: number }
  /** Corners as `rectangleCorners` orders them. */
  | {
      kind: 'rectangle'
      corners: readonly [Point, Point, Point, Point]
      width: number
      height: number
    }

export type Calibration = {
  toTarget: Matrix
  toImage: Matrix
  /** Known over measured length per reference, in the order given. */
  factors: number[]
  /** Mean of the factors: mm per pixel, or 1 near a rectangle's own scale. */
  scale: number
  /** (largest - smallest factor) / scale; 0 with one reference. */
  spread: number
}

/** `a b` (row-major). */
export function mul3(a: Matrix, b: Matrix): number[] {
  const out: number[] = []
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      out.push(a[3 * r] * b[c] + a[3 * r + 1] * b[3 + c] + a[3 * r + 2] * b[6 + c])
  return out
}

export const transpose3 = (m: Matrix) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]

/** `m v` for a 3-vector `v` (a homogeneous point stays undivided). */
export const apply3 = (m: Matrix, v: readonly number[]) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]

export const det3 = (m: Matrix) =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) -
  m[1] * (m[3] * m[8] - m[5] * m[6]) +
  m[2] * (m[3] * m[7] - m[4] * m[6])

/** Inverse of `m` by its adjugate; undefined when `m` is singular or not finite. */
export function inv3(m: Matrix): number[] | undefined {
  const d = det3(m)
  if (!d || !Number.isFinite(d)) return undefined
  return [
    (m[4] * m[8] - m[5] * m[7]) / d,
    (m[2] * m[7] - m[1] * m[8]) / d,
    (m[1] * m[5] - m[2] * m[4]) / d,
    (m[5] * m[6] - m[3] * m[8]) / d,
    (m[0] * m[8] - m[2] * m[6]) / d,
    (m[2] * m[3] - m[0] * m[5]) / d,
    (m[3] * m[7] - m[4] * m[6]) / d,
    (m[1] * m[6] - m[0] * m[7]) / d,
    (m[0] * m[4] - m[1] * m[3]) / d,
  ]
}

/** `p` mapped by `m` and divided by the third coordinate. */
export function applyMatrix(m: Matrix, p: Point): Point {
  const w = m[6] * p.x + m[7] * p.y + m[8]
  return { x: (m[0] * p.x + m[1] * p.y + m[2]) / w, y: (m[3] * p.x + m[4] * p.y + m[5]) / w }
}

/** Inverse of `m`; throws when it is singular. */
export function invertMatrix(m: Matrix): Matrix {
  const inverse = inv3(m)
  if (!inverse) throw new Error('Matrix is singular')
  return inverse
}

/** Moves the centroid to 0 and the mean distance from it to sqrt(2). */
function normalizing(points: readonly Point[]): Matrix {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length
  const mean = points.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / points.length
  const s = Math.SQRT2 / mean
  return [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1]
}

/** Solves a x = b in place by Gaussian elimination with partial pivoting. */
export function solve(a: number[][], b: number[]): number[] {
  const n = b.length
  for (let k = 0; k < n; k++) {
    let p = k
    for (let r = k + 1; r < n; r++) if (Math.abs(a[r][k]) > Math.abs(a[p][k])) p = r
    if (Math.abs(a[p][k]) < 1e-10) throw new Error('Points are degenerate')
    ;[a[k], a[p]] = [a[p], a[k]]
    ;[b[k], b[p]] = [b[p], b[k]]
    for (let r = k + 1; r < n; r++) {
      const f = a[r][k] / a[k][k]
      for (let c = k; c < n; c++) a[r][c] -= f * a[k][c]
      b[r] -= f * b[k]
    }
  }
  const x = new Array<number>(n)
  for (let k = n - 1; k >= 0; k--) {
    let s = b[k]
    for (let c = k + 1; c < n; c++) s -= a[k][c] * x[c]
    x[k] = s / a[k][k]
  }
  return x
}

/**
 * The homography that maps four points `from` onto four points `to`: the direct linear
 * transformation with the last entry fixed at 1, on normalized points (Hartley 2004,
 * chapter 4). Throws when three points of either set lie on one line.
 */
export function solveHomography(from: readonly Point[], to: readonly Point[]): Matrix {
  if (from.length !== 4 || to.length !== 4) throw new Error('Four point pairs are needed')
  const t1 = normalizing(from)
  const t2 = normalizing(to)
  const ps = from.map((p) => applyMatrix(t1, p))
  const qs = to.map((q) => applyMatrix(t2, q))
  for (const set of [ps, qs])
    for (let skip = 0; skip < 4; skip++) {
      const [a, b, c] = set.filter((_, i) => i !== skip)
      // normalized points lie about 1 from their centroid, so an absolute bound fits
      if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 1e-9)
        throw new Error('Three points lie on one line')
    }
  const a: number[][] = []
  const b: number[] = []
  ps.forEach((p, i) => {
    const q = qs[i]
    a.push([p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y])
    b.push(q.x)
    a.push([0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y])
    b.push(q.y)
  })
  return mul3(invertMatrix(t2), mul3([...solve(a, b), 1], t1))
}

/** Corners of a width x height rectangle in mm, y up: top left, top right, bottom right, bottom left. */
export function rectangleCorners(width: number, height: number): [Point, Point, Point, Point] {
  return [
    { x: 0, y: height },
    { x: width, y: height },
    { x: width, y: 0 },
    { x: 0, y: 0 },
  ]
}

/** The circle through three points; throws when they lie on one line. */
export function circleThrough(a: Point, b: Point, c: Point): { centre: Point; radius: number } {
  const [bx, by, cx, cy] = [b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y]
  const d = 2 * (bx * cy - by * cx)
  if (Math.abs(d) <= 1e-12 * (bx * bx + by * by + cx * cx + cy * cy))
    throw new Error('Points lie on one line')
  const b2 = bx * bx + by * by
  const c2 = cx * cx + cy * cy
  const ux = (cy * b2 - by * c2) / d
  const uy = (bx * c2 - cx * b2) / d
  return { centre: { x: a.x + ux, y: a.y + uy }, radius: Math.hypot(ux, uy) }
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const flipY: Matrix = [1, 0, 0, 0, -1, 0, 0, 0, 1]

/** Known over measured length of a reference, its points mapped through `base` first. */
function factor(r: Reference, base: Matrix): number {
  const m = (p: Point) => applyMatrix(base, p)
  const [known, measured] =
    r.kind === 'line'
      ? [r.length, distance(m(r.a), m(r.b))]
      : r.kind === 'ringCentre'
        ? [r.diameter, 2 * distance(m(r.centre), m(r.edge))]
        : r.kind === 'ringEdge'
          ? [r.diameter, 2 * circleThrough(m(r.points[0]), m(r.points[1]), m(r.points[2])).radius]
          : [1, 1]
  if (!(known > 0) || !(measured > 0) || !Number.isFinite(known / measured))
    throw new Error(`A ${r.kind} reference needs a length above 0 on the photo and on the target`)
  return known / measured
}

/**
 * Image pixels to target mm. With a rectangle (at most one) the photo is rectified onto it first;
 * every reference then gives a scale factor, and their mean scales the result. `origin` (image
 * pixels) maps to (0, 0); `rotation` (rad, counter-clockwise) is the angle of the target's x axis
 * on the photo, so target coordinates turn by minus that angle.
 */
export function calibrate(
  references: readonly Reference[],
  rotation: number,
  origin: Point,
): Calibration {
  if (!references.length) throw new Error('A reference is needed')
  const rects = references.filter((r) => r.kind === 'rectangle')
  if (rects.length > 1) throw new Error('One rectangle at most')
  const rect = rects[0]
  const base = rect
    ? solveHomography(rect.corners, rectangleCorners(rect.width, rect.height))
    : flipY
  const factors = references.map((r) => factor(r, base))
  const scale = factors.reduce((s, f) => s + f, 0) / factors.length
  const spread = (Math.max(...factors) - Math.min(...factors)) / scale
  const o = applyMatrix(base, origin)
  const [c, s] = [Math.cos(rotation), Math.sin(rotation)]
  const scaled: Matrix = [scale, 0, -scale * o.x, 0, scale, -scale * o.y, 0, 0, 1]
  const toTarget = mul3([c, s, 0, -s, c, 0, 0, 0, 1], mul3(scaled, base))
  return { toTarget, toImage: invertMatrix(toTarget), factors, scale, spread }
}

export const toTarget = (c: Calibration, p: Point) => applyMatrix(c.toTarget, p)
export const toImage = (c: Calibration, q: Point) => applyMatrix(c.toImage, q)

/**
 * A target point re-expressed after the calibration, rotation or origin changed, so it stays on
 * the same photo point (the same hole).
 */
export const keepOnPhoto = (q: Point, before: Calibration, after: Calibration) =>
  toTarget(after, toImage(before, q))

/** `p` turned by `angle` (rad, counter-clockwise on screen, y down) about `c`. */
export function turnPoint(p: Point, c: Point, angle: number): Point {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
  const [dx, dy] = [p.x - c.x, p.y - c.y]
  return { x: c.x + cos * dx + sin * dy, y: c.y - sin * dx + cos * dy }
}

/** The box of a `width` x `height` photo turned by `angle` (as `turnPoint`) about its middle. */
export function turnedBox(width: number, height: number, angle: number) {
  const c = { x: width / 2, y: height / 2 }
  const pts = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ].map((p) => turnPoint(p, c, angle))
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const [x, y] = [Math.min(...xs), Math.min(...ys)]
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
