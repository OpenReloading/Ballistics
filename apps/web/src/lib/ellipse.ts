/**
 * Conics and ellipses for the target face search: the direct
 * least-squares ellipse fit, a robust fit by random samples, and the conic pencil of two concentric
 * circles seen in perspective. Pure: no React, DOM or Next.js.
 */
import { nth } from './nth.ts'
import {
  apply3,
  det3,
  inv3,
  type Mat3,
  type Matrix,
  mapMatrix,
  mul3,
  type Point,
  toMatrix,
  transpose3,
  type Vector3,
} from './target-geometry.ts'

/** a x^2 + b x y + c y^2 + d x + e y + f = 0. */
type Conic = readonly [number, number, number, number, number, number]
/** Centre, semi-axes `semiMajor` >= `semiMinor` and `angle` of the major axis (rad, image coordinates), image px. */
export type Ellipse = {
  centreX: number
  centreY: number
  semiMajor: number
  semiMinor: number
  angle: number
}

/** The symmetric 3 x 3 matrix of a conic, row-major. */
const conicMatrix = ([a, b, c, d, e, f]: Conic): Mat3 => [
  a,
  b / 2,
  d / 2,
  b / 2,
  c,
  e / 2,
  d / 2,
  e / 2,
  f,
]
const toConic = (q: Mat3): Conic => [q[0], 2 * q[1], q[4], 2 * q[2], 2 * q[5], q[8]]

/** Real roots of x^3 + p x^2 + q x + r (Cardano, trigonometric form for three roots). */
function cubicRoots(p: number, q: number, r: number): number[] {
  const a = q - (p * p) / 3
  const b = (2 * p ** 3) / 27 - (p * q) / 3 + r
  const shift = -p / 3
  const disc = (b / 2) ** 2 + (a / 3) ** 3
  if (disc > 0) {
    const s = Math.sqrt(disc)
    return [Math.cbrt(-b / 2 + s) + Math.cbrt(-b / 2 - s) + shift]
  }
  if (a === 0) return [shift]
  const m = 2 * Math.sqrt(-a / 3)
  const t = Math.acos(Math.max(-1, Math.min(1, (3 * b) / (a * m))))
  return [0, 1, 2].map((k) => m * Math.cos((t - 2 * Math.PI * k) / 3) + shift)
}

/** Unit vector in the null space of the 3 x 3 matrix `m` (the cross product of its most independent rows). */
function nullVector(m: Mat3): Vector3 | undefined {
  const r0: Vector3 = [m[0], m[1], m[2]]
  const r1: Vector3 = [m[3], m[4], m[5]]
  const r2: Vector3 = [m[6], m[7], m[8]]
  let best: Vector3 | undefined
  let bestNorm = 0
  for (const [u, v] of [
    [r0, r1],
    [r0, r2],
    [r1, r2],
  ] as const) {
    const c: Vector3 = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ]
    const n = Math.hypot(c[0], c[1], c[2])
    if (n > bestNorm) [best, bestNorm] = [c, n]
  }
  return best && bestNorm > 0
    ? [best[0] / bestNorm, best[1] / bestNorm, best[2] / bestNorm]
    : undefined
}

/**
 * Direct least-squares ellipse fit (Fitzgibbon 1999) in the numerically stable form of Halir 1998:
 * the points are normalised, the 3 x 3 eigenproblem of the reduced scatter matrix is solved by the
 * roots of its characteristic cubic. Undefined for fewer than 6 points or no ellipse.
 */
export function fitEllipse(pts: readonly Point[]): Conic | undefined {
  if (pts.length < 6) return undefined
  const norm = normalisePoints(pts)
  if (!(norm.s > 0)) return undefined
  const [S1, S2, S3] = scatterMatrices(pts, norm)
  const S3i = inv3(S3)
  if (!S3i) return undefined
  // T = -S3^-1 S2^T
  const T = mapMatrix(mul3(S3i, transpose3(S2)), (v) => -v)
  const M0 = mapMatrix(mul3(S2, T), (v, i) => v + nth(S1, i))
  // C1^-1 M with C1 the constraint 4ac - b^2
  const M: Mat3 = [
    M0[6] / 2,
    M0[7] / 2,
    M0[8] / 2,
    -M0[3],
    -M0[4],
    -M0[5],
    M0[0] / 2,
    M0[1] / 2,
    M0[2] / 2,
  ]
  const tr = M[0] + M[4] + M[8]
  const minors =
    M[0] * M[4] - M[1] * M[3] + (M[0] * M[8] - M[2] * M[6]) + (M[4] * M[8] - M[5] * M[7])
  for (const lambda of cubicRoots(-tr, minors, -det3(M))) {
    const shifted = mapMatrix(M, (v, i) => (i % 4 === 0 ? v - lambda : v))
    const a1 = nullVector(shifted)
    if (!a1 || 4 * a1[0] * a1[2] - a1[1] * a1[1] <= 0) continue
    return denormaliseConic([...a1, ...apply3(T, a1)], norm)
  }
  return undefined
}

/** Centroid (`mx`, `my`) and mean distance `s` from it of the points: x_n = (x - mx) / s. */
type Normalisation = { mx: number; my: number; s: number }

function normalisePoints(pts: readonly Point[]): Normalisation {
  const n = pts.length
  let [mx, my] = [0, 0]
  for (const p of pts) [mx, my] = [mx + p.x, my + p.y]
  mx /= n
  my /= n
  let s = 0
  for (const p of pts) s += Math.hypot(p.x - mx, p.y - my)
  s /= n
  return { mx, my, s }
}

/** Scatter matrices of the normalised points: quadratic terms S1, mixed S2, linear S3. */
function scatterMatrices(
  pts: readonly Point[],
  { mx, my, s }: Normalisation,
): [Matrix9, Matrix9, Matrix9] {
  const S1 = zeros()
  const S2 = zeros()
  const S3 = zeros()
  for (const p of pts) {
    const x = (p.x - mx) / s
    const y = (p.y - my) / s
    const d1: Vector3 = [x * x, x * y, y * y]
    const d2: Vector3 = [x, y, 1]
    addOuter(S1, d1, d1)
    addOuter(S2, d1, d2)
    addOuter(S3, d2, d2)
  }
  return [S1, S2, S3]
}

type Matrix9 = [number, number, number, number, number, number, number, number, number]
const zeros = (): Matrix9 => [0, 0, 0, 0, 0, 0, 0, 0, 0]

/** `S` plus the outer product of `u` and `v` (row-major). */
function addOuter(S: Matrix9, u: Vector3, v: Vector3) {
  S[0] += u[0] * v[0]
  S[1] += u[0] * v[1]
  S[2] += u[0] * v[2]
  S[3] += u[1] * v[0]
  S[4] += u[1] * v[1]
  S[5] += u[1] * v[2]
  S[6] += u[2] * v[0]
  S[7] += u[2] * v[1]
  S[8] += u[2] * v[2]
}

/** A conic of normalised coordinates back in image coordinates. */
function denormaliseConic([a, b, c, d, e, f]: Conic, { mx, my, s }: Normalisation): Conic {
  const k = 1 / s
  const A = a * k * k
  const B = b * k * k
  const C = c * k * k
  const D = d * k - 2 * a * k * k * mx - b * k * k * my
  const E = e * k - b * k * k * mx - 2 * c * k * k * my
  const F =
    f - d * k * mx - e * k * my + a * (k * mx) ** 2 + b * k * k * mx * my + c * (k * my) ** 2
  return [A, B, C, D, E, F]
}

/** Centre, semi-axes and angle of a conic; undefined unless it is a real ellipse. */
export function ellipseOf(c: Conic): Ellipse | undefined {
  const [a, b, cc, d, e, f] = c
  const det = 4 * a * cc - b * b
  if (!(det > 0)) return undefined
  const cx = (b * e - 2 * cc * d) / det
  const cy = (b * d - 2 * a * e) / det
  const fc = f + (d * cx + e * cy) / 2
  // eigenvalues of [[a, b/2], [b/2, cc]]
  const mid = (a + cc) / 2
  const rad = Math.hypot((a - cc) / 2, b / 2)
  const [m1, m2] = [mid + rad, mid - rad]
  if (!(m1 * m2 > 0) || !(-fc / m1 > 0) || !(-fc / m2 > 0)) return undefined
  // the eigenvector of the larger eigenvalue m1 points at angle phi; the semi-axis along it is r1
  const [r1, r2] = [Math.sqrt(-fc / m1), Math.sqrt(-fc / m2)]
  const phi = 0.5 * Math.atan2(b, a - cc)
  return {
    centreX: cx,
    centreY: cy,
    semiMajor: Math.max(r1, r2),
    semiMinor: Math.min(r1, r2),
    angle: r1 >= r2 ? phi : phi + Math.PI / 2,
  }
}

/** Coefficients [a, b, c, d, e, f] of a x^2 + b x y + c y^2 + d x + e y + f = 0 for the ellipse, image px. */
export function conicOf({
  centreX: cx,
  centreY: cy,
  semiMajor: a,
  semiMinor: b,
  angle: theta,
}: Ellipse): Conic {
  const [c, s] = [Math.cos(theta), Math.sin(theta)]
  const [ia, ib] = [1 / (a * a), 1 / (b * b)]
  const A = c * c * ia + s * s * ib
  const B = 2 * c * s * (ia - ib)
  const C = s * s * ia + c * c * ib
  const D = -2 * A * cx - B * cy
  const E = -B * cx - 2 * C * cy
  const F = A * cx * cx + B * cx * cy + C * cy * cy - 1
  return [A, B, C, D, E, F]
}

/** Mean radius, the geometric mean of the semi-axes. */
export const meanRadius = (e: Ellipse) => Math.sqrt(e.semiMajor * e.semiMinor)

/** Point of the ellipse at parameter `t` (rad, 0 at the end of the major semi-axis), image px. */
export function ellipsePoint(e: Ellipse, t: number): Point {
  const [c, s] = [Math.cos(e.angle), Math.sin(e.angle)]
  const [x, y] = [e.semiMajor * Math.cos(t), e.semiMinor * Math.sin(t)]
  return { x: e.centreX + c * x - s * y, y: e.centreY + s * x + c * y }
}

/** First-order distance of `p` to the conic (the Sampson distance). */
export function sampson(c: Conic, p: Point): number {
  const [a, b, cc, d, e, f] = c
  const v = a * p.x * p.x + b * p.x * p.y + cc * p.y * p.y + d * p.x + e * p.y + f
  const gx = 2 * a * p.x + b * p.y + d
  const gy = b * p.x + 2 * cc * p.y + e
  const g = Math.hypot(gx, gy)
  return g > 0 ? Math.abs(v) / g : Number.POSITIVE_INFINITY
}

/** Largest angular gap of `pts` around `(cx, cy)`, rad; the arc they cover is 2 pi minus it. */
export function largestGap(pts: readonly Point[], cx: number, cy: number): number {
  const ang = pts.map((p) => Math.atan2(p.y - cy, p.x - cx)).sort((x, y) => x - y)
  const [first] = ang
  const last = ang[ang.length - 1]
  if (first === undefined || last === undefined) return 2 * Math.PI
  let gap = first + 2 * Math.PI - last
  let prev = first
  for (const a of ang.slice(1)) {
    gap = Math.max(gap, a - prev)
    prev = a
  }
  return gap
}

type RobustFit = { conic: Conic; ellipse: Ellipse; inliers: number[]; rms: number }

type RobustOptions = {
  tolerance: number
  minPoints: number
  rounds?: number
  accept?: (e: Ellipse) => boolean
}
type Candidate = { conic: Conic; inliers: number[] }

/** A small deterministic generator (mulberry32), so a fit repeats. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Robust ellipse fit: random samples of 6 points fitted directly, the one with the most points
 * within `tolerance` (Sampson distance, px) refitted on its inliers until the set settles. Undefined when
 * no sample gives an ellipse with `minPoints` inliers.
 */
export function ransacEllipse(
  pts: readonly Point[],
  o: RobustOptions,
  rnd = seededRandom(1),
): RobustFit | undefined {
  if (pts.length < Math.max(6, o.minPoints)) return undefined
  const sampled = bestSample(pts, o, rnd)
  if (!sampled || sampled.inliers.length < o.minPoints) return undefined
  const best = refitOnInliers(pts, o, sampled)
  const ellipse = ellipseOf(best.conic)
  if (!ellipse || (o.accept && !o.accept(ellipse))) return undefined
  const rms = Math.sqrt(
    best.inliers.reduce((s, i) => s + sampson(best.conic, nth(pts, i)) ** 2, 0) /
      best.inliers.length,
  )
  return { ...best, ellipse, rms }
}

/** Indices of the points within `tolerance` (Sampson distance, px) of the conic. */
function inliersOf(pts: readonly Point[], c: Conic, tolerance: number): number[] {
  const out: number[] = []
  for (const [i, p] of pts.entries()) if (sampson(c, p) <= tolerance) out.push(i)
  return out
}

/** The direct fit of 6 random points with the most inliers over `rounds` samples. */
function bestSample(
  pts: readonly Point[],
  o: RobustOptions,
  rnd: () => number,
): Candidate | undefined {
  const n = pts.length
  let best: Candidate | undefined
  for (let k = 0; k < (o.rounds ?? 80); k++) {
    const sample = Array.from({ length: 6 }, () => nth(pts, Math.floor(rnd() * n)))
    const conic = fitEllipse(sample)
    const el = conic && ellipseOf(conic)
    if (!conic || !el || (o.accept && !o.accept(el))) continue
    const inliers = inliersOf(pts, conic, o.tolerance)
    if (!best || inliers.length > best.inliers.length) best = { conic, inliers }
  }
  return best
}

/** `start` refitted on its inliers until the set stops growing (at most 4 times). */
function refitOnInliers(pts: readonly Point[], o: RobustOptions, start: Candidate): Candidate {
  let best = start
  for (let k = 0; k < 4; k++) {
    const conic = fitEllipse(best.inliers.map((i) => nth(pts, i)))
    const el = conic && ellipseOf(conic)
    if (!conic || !el || (o.accept && !o.accept(el))) break
    const inliers = inliersOf(pts, conic, o.tolerance)
    if (inliers.length < best.inliers.length) break
    const same = inliers.length === best.inliers.length
    best = { conic, inliers }
    if (same) break
  }
  return best
}

/** One Jacobi rotation of the rows and columns `p` and `q` of `a`, accumulated in the vectors `v`. */
function jacobiRotate(a: number[], v: number[], p: number, q: number) {
  const apq = nth(a, 3 * p + q)
  if (apq === 0) return
  const theta = (nth(a, 3 * q + q) - nth(a, 3 * p + p)) / (2 * apq)
  const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
  const c = 1 / Math.sqrt(t * t + 1)
  const s = t * c
  for (let k = 0; k < 3; k++) {
    const [akp, akq] = [nth(a, 3 * k + p), nth(a, 3 * k + q)]
    a[3 * k + p] = c * akp - s * akq
    a[3 * k + q] = s * akp + c * akq
  }
  for (let k = 0; k < 3; k++) {
    const [apk, aqk] = [nth(a, 3 * p + k), nth(a, 3 * q + k)]
    a[3 * p + k] = c * apk - s * aqk
    a[3 * q + k] = s * apk + c * aqk
  }
  for (let k = 0; k < 3; k++) {
    const [vkp, vkq] = [nth(v, 3 * k + p), nth(v, 3 * k + q)]
    v[3 * k + p] = c * vkp - s * vkq
    v[3 * k + q] = s * vkp + c * vkq
  }
}

type Eigenpair = { value: number; vector: Vector3 }

/** Eigen-decomposition of a symmetric 3 x 3 matrix by Jacobi rotations: the three values with their vectors. */
function jacobi3(m: Mat3): [Eigenpair, Eigenpair, Eigenpair] {
  const a: Matrix9 = [...m]
  const v: Matrix9 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  for (let sweep = 0; sweep < 30; sweep++) {
    const off = Math.abs(a[1]) + Math.abs(a[2]) + Math.abs(a[5])
    if (off < 1e-15 * (Math.abs(a[0]) + Math.abs(a[4]) + Math.abs(a[8]) + 1e-300)) break
    jacobiRotate(a, v, 0, 1)
    jacobiRotate(a, v, 0, 2)
    jacobiRotate(a, v, 1, 2)
  }
  return [
    { value: a[0], vector: [v[0], v[3], v[6]] },
    { value: a[4], vector: [v[1], v[4], v[7]] },
    { value: a[8], vector: [v[2], v[5], v[8]] },
  ]
}

/**
 * The plane of two concentric circles seen in perspective, from their image conics (the conic
 * pencil: the generalised eigenvalues of the pair are `r1^2 / r2^2` once and 1 twice, and the
 * eigenvector of the single one is the image of the common centre, Gurdjos 2006, and the affine
 * rectification by the vanishing line of the same pencil, Gurdjos 2002).
 * Returns the 3 x 3 matrix that maps an image point (homogeneous) onto the plane where the first
 * circle is the unit circle about the origin (up to a rotation and a reflection), and the image
 * of the centre. Undefined when the pair is degenerate or the radii are too alike.
 */
export function concentricPlane(
  c1: Conic,
  c2: Conic,
): { toPlane: Mat3; centre: Point; ratio: number } | undefined {
  const [n1, n2] = [normaliseConic(conicMatrix(c1)), normaliseConic(conicMatrix(c2))]
  if (!n1 || !n2) return undefined
  const i2 = inv3(n2)
  if (!i2) return undefined
  const N = mul3(i2, n1)
  const { single, double } = pencilEigenvalues(N)
  if (!(single > 0) || !(double > 0) || Math.abs(Math.log(single / double)) < 0.1) return undefined
  const v = nullVector(mapMatrix(N, (x, i) => (i % 4 === 0 ? x - single : x)))
  if (!v || Math.abs(v[2]) < 1e-12) return undefined
  // the centre lies inside the first circle: its polar form is negative there
  const polar = (q: Mat3, p: Vector3) =>
    p[0] * (q[0] * p[0] + q[1] * p[1] + q[2] * p[2]) +
    p[1] * (q[3] * p[0] + q[4] * p[1] + q[5] * p[2]) +
    p[2] * (q[6] * p[0] + q[7] * p[1] + q[8] * p[2])
  if (!(polar(n1, v) < 0)) return undefined
  const toPlane = planeMap(n1, v)
  if (!toPlane) return undefined
  return {
    toPlane,
    centre: { x: v[0] / v[2], y: v[1] / v[2] },
    ratio: Math.sqrt(single / double),
  }
}

/** The conic matrix `q` scaled to the determinant -1, so its signature is (+, +, -); undefined when singular. */
function normaliseConic(q: Mat3): Mat3 | undefined {
  const d = det3(q)
  if (!(d !== 0)) return undefined
  const k = Math.cbrt(Math.abs(d))
  const sgn = d < 0 ? 1 : -1
  return mapMatrix(q, (v) => (sgn * v) / k)
}

/** The single eigenvalue of the pencil matrix `N` (the root farthest from the other two) and the double one. */
function pencilEigenvalues(N: Mat3): { single: number; double: number } {
  const tr = N[0] + N[4] + N[8]
  const minors =
    N[0] * N[4] - N[1] * N[3] + (N[0] * N[8] - N[2] * N[6]) + (N[4] * N[8] - N[5] * N[7])
  const roots = cubicRoots(-tr, minors, -det3(N))
  const single =
    roots.length === 1
      ? nth(roots, 0)
      : nth(
          roots
            .map((r, i) => ({
              r,
              gap: Math.min(...roots.filter((_, j) => j !== i).map((o) => Math.abs(o - r))),
            }))
            .sort((a, b) => b.gap - a.gap),
          0,
        ).r
  return { single, double: (tr - single) / 2 }
}

/**
 * The map of image points (homogeneous) onto the plane where the normalised conic `n1` is the unit
 * circle and the point `v` inside it is the origin; undefined when `n1` is no real ellipse.
 */
function planeMap(n1: Mat3, v: Readonly<Vector3>): Mat3 | undefined {
  // n1 = E^T diag(l) E: M0 = diag(sqrt|l|) E satisfies M0^T diag(1, 1, -1) M0 = n1
  const sorted = jacobi3(n1).sort((a, b) => b.value - a.value)
  const [e0, e1, e2] = sorted
  if (!(e0.value > 0 && e1.value > 0 && e2.value < 0)) return undefined
  const M0 = toMatrix(
    sorted.flatMap(({ value, vector }) => vector.map((x) => Math.sqrt(Math.abs(value)) * x)),
  )
  let u = apply3(M0, v)
  if (u[2] < 0) u = [-u[0], -u[1], -u[2]]
  // normalise on the hyperboloid u_z^2 - u_x^2 - u_y^2 = 1
  const w = Math.sqrt(u[2] * u[2] - u[0] * u[0] - u[1] * u[1])
  if (!(w > 0)) return undefined
  const [ux, uy, uz] = [u[0] / w, u[1] / w, u[2] / w]
  const sh = Math.hypot(ux, uy)
  let boost: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  if (sh > 1e-12) {
    const [nx, ny] = [ux / sh, uy / sh]
    // the inverse boost in the plane of (nx, ny) and z
    const ch = uz
    boost = [
      1 + (ch - 1) * nx * nx,
      (ch - 1) * nx * ny,
      -sh * nx,
      (ch - 1) * nx * ny,
      1 + (ch - 1) * ny * ny,
      -sh * ny,
      -sh * nx,
      -sh * ny,
      ch,
    ]
  }
  return mul3(boost, M0)
}

/** The conic as a matrix in the plane after the map `m` (image to plane): `m^-T Q m^-1`. */
export function mapConic(c: Conic, m: Matrix): Conic | undefined {
  const mi = inv3(m)
  if (!mi) return undefined
  return toConic(mul3(transpose3(mi), mul3(conicMatrix(c), mi)))
}
