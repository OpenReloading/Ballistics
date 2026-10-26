/**
 * Ring scoring of shots on a rule-book target face (`apps/docs/docs/models/ring-scoring.md`) and the fit of a
 * face to ring marks on a sheet. Shots and holes in target m relative to the face centre, as the
 * target sheet stores them; face records in mm. Pure: no React, DOM or Next.js.
 */
import { fromSi, type TargetFace, toSi } from '@open-reloading/schema'
import { nth } from './nth.ts'
import { type Point, solve } from './target-geometry.ts'

export type RingScore = {
  /** Value of the highest ring the hole touches; 0 outside the face. */
  value: number
  /** Tenth-ring value, on faces whose rules define it. */
  decimal?: number
  /** True when the hole is in the inner ten under the face's `innerTen.rule`. */
  innerTen: boolean
  /** Zone label of the bull the shot belongs to, where the face's bull has one. */
  zone?: string | undefined
}

type GroupScore = {
  shots: RingScore[]
  total: number
  decimalTotal?: number
  innerTenCount: number
}

/** 1e-9 mm in m: a hole edge on a ring line within this counts as touching it. */
const touch = 1e-12
/** Radius in m of a face diameter in mm. */
const radius = (d: { value: number }) => toSi('length', d.value / 2)

/**
 * The scored hole diameter in m: 0 where the event counts the hole centre, else the event's gauge,
 * else the bullet diameter (m).
 */
export function scoredHoleDiameter<B extends number | undefined>(
  event: TargetFace['events'][number] | undefined,
  bullet: B,
  gauge?: number,
): number | B {
  if (event?.scoring === 'centre') return 0
  const fixed = event?.gauge?.value ?? gauge
  return fixed ? toSi('length', fixed) : bullet
}

type Shape = Pick<TargetFace['rings'][number], 'diameter' | 'height' | 'shape'>

/**
 * Distance in m from a point to the filled ellipse of semi-axes `a` and `b`, 0 inside: bisection
 * on the root of the closest-point condition (Eberly 2013, "Distance from a point to an ellipse").
 */
function ellipseGap(a: number, b: number, x: number, y: number): number {
  // the longer axis along the first coordinate
  const [e0, e1, y0, y1] =
    a >= b ? [a, b, Math.abs(x), Math.abs(y)] : [b, a, Math.abs(y), Math.abs(x)]
  const [z0, z1] = [y0 / e0, y1 / e1]
  if (z0 * z0 + z1 * z1 <= 1) return 0
  if (y1 === 0) return y0 - e0
  const r0 = (e0 / e1) ** 2
  let [lo, hi] = [z1 - 1, Math.hypot(r0 * z0, z1) - 1]
  let t = lo
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (mid === lo || mid === hi) break
    t = mid
    const g = ((r0 * z0) / (t + r0)) ** 2 + (z1 / (t + 1)) ** 2 - 1
    if (g > 0) lo = t
    else if (g < 0) hi = t
    else break
  }
  return Math.hypot((r0 * y0) / (t + r0) - y0, y1 / (t + 1) - y1)
}

/**
 * The hole of radius `g` (m) touches the area a ring line bounds, with the hole centre `p` in m
 * from the area's centre: a circle by the centre distance, an oval by the distance to its
 * ellipse, a square by the distance to its square (rounded at the corners).
 */
function touches(ring: Shape, p: Point, g: number): boolean {
  const w = radius(ring.diameter)
  if (ring.shape === 'square')
    return Math.hypot(Math.max(Math.abs(p.x) - w, 0), Math.max(Math.abs(p.y) - w, 0)) <= g + touch
  if (ring.height) return ellipseGap(w, radius(ring.height), p.x, p.y) <= g + touch
  return Math.hypot(p.x, p.y) <= w + g + touch
}

/** The bull a shot belongs to: the nearest centre (the first of the record on a tie). */
function nearestBull(face: TargetFace, shot: Point): { centre: Point; zone?: string | undefined } {
  let best = { centre: { x: 0, y: 0 }, zone: undefined as string | undefined }
  let bestD = Number.POSITIVE_INFINITY
  for (const b of face.bulls ?? []) {
    const centre = { x: toSi('length', b.x.value), y: toSi('length', b.y.value) }
    const d = Math.hypot(shot.x - centre.x, shot.y - centre.y)
    if (d < bestD) [best, bestD] = [{ centre, zone: b.zone }, d]
  }
  return best
}

/**
 * Score of a hole of diameter `hole` (m) centred at `shot` (m from the face centre): the bull
 * nearest to the shot, then the highest ring whose outer edge the hole touches, tenths of that
 * ring's width counted inward from the touching position, and the inner ten by the face's rule.
 */
export function scoreShot(face: TargetFace, shot: Point, hole: number): RingScore {
  const { centre, zone } = nearestBull(face, shot)
  const score = scoreOnBull(face, { x: shot.x - centre.x, y: shot.y - centre.y }, hole)
  return zone ? { ...score, zone } : score
}

/** `scoreShot` for one bull: `shot` in m from its centre. */
function scoreOnBull(face: TargetFace, shot: Point, hole: number): RingScore {
  const d = Math.hypot(shot.x, shot.y)
  const g = hole / 2
  const rings = face.rings
  const i = rings.findLastIndex((r) => touches(r, shot, g))
  if (i < 0) return { value: 0, ...(face.decimal && { decimal: 0 }), innerTen: false }
  const ring = nth(rings, i)
  const value = ring.value
  const inner = face.innerTen
  const x =
    i === rings.length - 1 &&
    !!inner &&
    (inner.rule === 'cover' ? d + radius(inner.diameter) <= g + touch : touches(inner, shot, g))
  if (!face.decimal) return { value, innerTen: x }
  // ring width: to the next ring inward, for the innermost ring to the next ring outward
  const [a, b] = i < rings.length - 1 ? [ring, nth(rings, i + 1)] : [nth(rings, i - 1), ring]
  const width = radius(a.diameter) - radius(b.diameter)
  const depth = (radius(ring.diameter) + g - d) / width
  const tenth = Math.min(9, Math.max(0, Math.floor(depth * 10 + 1e-9)))
  return { value, decimal: (value * 10 + tenth) / 10, innerTen: x }
}

/** Scores, total, tenth-ring total and inner-ten count of a group's shots. */
export function scoreGroup(face: TargetFace, shots: readonly Point[], hole: number): GroupScore {
  const scores = shots.map((s) => scoreShot(face, s, hole))
  const total = scores.reduce((sum, s) => sum + s.value, 0)
  const xCount = scores.filter((s) => s.innerTen).length
  if (!face.decimal) return { shots: scores, total, innerTenCount: xCount }
  const tenths = scores.reduce((sum, s) => sum + Math.round((s.decimal ?? 0) * 10), 0)
  return { shots: scores, total, decimalTotal: tenths / 10, innerTenCount: xCount }
}

type RingMarks = { diameter: number; points: readonly Point[] }

/**
 * Centre and scale (point units per diameter unit) of a face from points marked on two or more of
 * its rings: |p - centre| = scale x diameter / 2 solved by linear least squares in the centre, the
 * squared scale and |centre|^2 taken as a free unknown (an algebraic circle fit, Kasa 1976, with
 * one radius per ring). `rms` is the root mean square of the radial misfit in point units.
 * shortcut: algebraic fit, no perspective, rotation or ring-line thickness; upgrade to a geometric
 * fit through the photo homography when the editor uses faces as calibration references.
 */
export function fitRings(marks: readonly RingMarks[]): {
  centre: Point
  scale: number
  rmsMisfit: number
} {
  const all = marks.flatMap((m) => m.points.map((p) => ({ p, r: m.diameter / 2 })))
  if (new Set(marks.filter((m) => m.points.length).map((m) => m.diameter)).size < 2)
    throw new Error('Marks on at least two rings are needed')
  if (all.length < 4) throw new Error('At least four points are needed')
  const norm = normaliseMarks(all)
  if (!(norm.sp > 0) || !(norm.sr > 0)) throw new Error('Points are degenerate')
  const { centre, scale } = solveCircleFit(all, norm)
  const misfit = all.reduce(
    (s, { p, r }) => s + (Math.hypot(p.x - centre.x, p.y - centre.y) - scale * r) ** 2,
    0,
  )
  return { centre, scale, rmsMisfit: Math.sqrt(misfit / all.length) }
}

type MarkedPoint = { p: Point; r: number }
/** Centroid (`mx`, `my`) and mean distance `sp` from it of the points, mean radius `sr`. */
type MarkNormalisation = { mx: number; my: number; sp: number; sr: number }

/** Normalisation of the marks: points around their centroid at mean distance 1, radii at mean 1. */
function normaliseMarks(all: readonly MarkedPoint[]): MarkNormalisation {
  const mx = all.reduce((s, { p }) => s + p.x, 0) / all.length
  const my = all.reduce((s, { p }) => s + p.y, 0) / all.length
  const sp = all.reduce((s, { p }) => s + Math.hypot(p.x - mx, p.y - my), 0) / all.length
  const sr = all.reduce((s, { r }) => s + r, 0) / all.length
  return { mx, my, sp, sr }
}

/** Centre and scale by the normal equations of the algebraic circle fit on the normalised marks. */
function solveCircleFit(
  all: readonly MarkedPoint[],
  { mx, my, sp, sr }: MarkNormalisation,
): { centre: Point; scale: number } {
  const ata = Array.from({ length: 4 }, () => [0, 0, 0, 0])
  const atb = [0, 0, 0, 0]
  for (const { p, r } of all) {
    const x = (p.x - mx) / sp
    const y = (p.y - my) / sp
    const row = [2 * x, 2 * y, (r / sr) ** 2, -1]
    for (const [i, ri] of row.entries()) {
      atb[i] = nth(atb, i) + ri * (x * x + y * y)
      const line = nth(ata, i)
      for (const [j, rj] of row.entries()) line[j] = nth(line, j) + ri * rj
    }
  }
  const solution = solve(ata, atb)
  const [cx, cy, u] = [nth(solution, 0), nth(solution, 1), nth(solution, 2)]
  if (!(u > 0)) throw new Error('Points are degenerate')
  return { centre: { x: mx + cx * sp, y: my + cy * sp }, scale: (Math.sqrt(u) * sp) / sr }
}

/** Where a face lies on the sheet: its centre in target m and target m per face m (1 when true). */
type FaceAlignment = { centre: Point; scale: number; rms?: number }
/** A point marked on ring `ring` (its value) of a face, in target m. */
export type FaceMark = { ring: number; x: number; y: number }

/** A sheet point (target m) in face m from the face centre. */
export const onFace = (a: FaceAlignment, p: Point): Point => ({
  x: (p.x - a.centre.x) / a.scale,
  y: (p.y - a.centre.y) / a.scale,
})
/** A face point (face m from its centre) on the sheet, target m. */
export const onSheet = (a: FaceAlignment, q: Point): Point => ({
  x: a.centre.x + q.x * a.scale,
  y: a.centre.y + q.y * a.scale,
})

/**
 * The face fitted to marks on its rings (`fitRings` on target m with diameters in mm, so its scale
 * is target m per face mm, times 1e3 here), else centred on `aim` (or the origin) at the
 * calibrated scale.
 */
export function faceAlignment(
  face: TargetFace,
  marks: readonly FaceMark[] | undefined,
  aim: Point | undefined,
): FaceAlignment {
  if (!marks?.length) return { centre: aim ?? { x: 0, y: 0 }, scale: 1 }
  if (face.bulls) throw new Error('Ring marks fit a face with one bull')
  if (face.rings.some((r) => r.height || r.shape === 'square'))
    throw new Error('Ring marks fit circular rings')
  const rings = new Map<number, Point[]>()
  for (const m of marks) rings.set(m.ring, [...(rings.get(m.ring) ?? []), m])
  const fit = fitRings(
    [...rings].map(([value, points]) => {
      const ring = face.rings.find((r) => r.value === value)
      if (!ring) throw new Error(`The face has no ring ${value}`)
      return { diameter: ring.diameter.value, points }
    }),
  )
  return { centre: fit.centre, scale: fromSi('length', fit.scale), rms: fit.rmsMisfit }
}

/** A ring of `diameter` mm as a closed polyline of 72 points on the sheet, target m. */
export function ringPath(a: FaceAlignment, diameter: number): Point[] {
  const r = toSi('length', diameter / 2)
  return Array.from({ length: 72 }, (_, i) => {
    const t = (i / 72) * 2 * Math.PI
    return onSheet(a, { x: r * Math.cos(t), y: r * Math.sin(t) })
  })
}

/**
 * The 10 zone (innermost ring touched) is wider than one ring width, so its tenths are the
 * project's own rule, not the rule book's (`apps/docs/docs/models/ring-scoring.md`, "Tenth-ring value").
 */
export function usesOwnTenthRule(face: TargetFace, hole: number): boolean {
  // a face of one ring has no inner ring: both sides are NaN and the answer false
  const [outer = Number.NaN, inner = Number.NaN] = face.rings
    .slice(-2)
    .map((r) => radius(r.diameter))
  return inner + hole / 2 > outer - inner + touch
}

/**
 * A group scored on its face: the hole from the event's gauge, else the gauge of the discipline's
 * mapping (`choice.gauge`, mm), else `bullet` (m); every shot's
 * score; total, tenths and inner tens over the included shots only. An error text when the hole
 * size is unknown or the marks do not fit.
 */
export function scoreGroupOnFace(
  face: TargetFace,
  choice: {
    id: string
    event?: string | undefined
    marks?: readonly FaceMark[] | undefined
    gauge?: number | undefined
  },
  group: {
    aim?: Point | undefined
    shots: readonly (Point & { excluded?: boolean | undefined })[]
  },
  bullet: number | undefined,
):
  | { alignment: FaceAlignment; hole: number; usesOwnTenthRule: boolean; score: GroupScore }
  | { error: string } {
  const event = face.events.find((e) => e.id === choice.event)
  const hole = scoredHoleDiameter(event, bullet, choice.gauge)
  if (hole === undefined || (!hole && event?.scoring !== 'centre'))
    return { error: 'No hole size: set Marker, or choose a discipline or event with a gauge.' }
  let alignment: FaceAlignment
  try {
    alignment = faceAlignment(face, choice.marks, group.aim)
  } catch (e) {
    return { error: `The ring marks do not fit: ${(e as Error).message}. Mark them again.` }
  }
  const shots = group.shots.map((s) => scoreShot(face, onFace(alignment, s), hole))
  const counted = scoreGroup(
    face,
    group.shots.filter((s) => !s.excluded).map((s) => onFace(alignment, s)),
    hole,
  )
  return {
    alignment,
    hole,
    usesOwnTenthRule: usesOwnTenthRule(face, hole),
    score: { ...counted, shots },
  }
}
