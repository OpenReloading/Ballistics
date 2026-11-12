/** Ring scoring on a rule-book target face and the fit of a face to ring marks on a sheet (`apps/docs/docs/models/ring-scoring.md`); shots and holes in target m from the face center, as the sheet stores them, face records in mm; a refusal is a `RingFitIssue` or a `GroupIssue`. */

import { fromSi, toSi } from '@open-reloading/units'
import { type Diagnostic, nth } from '@rangefoundry/statistics'
import { type Point, solveLinear } from './geometry.ts'
import type { RingFitIssue } from './issue.ts'

/** A length of a face record in its stored unit, mm. */
export interface FaceLength {
  readonly value: number
}

/** A ring of a face, outer to inner: its value, its width and, for an oval or a stadium, its height. */
export interface FaceRing {
  readonly value: number
  readonly diameter: FaceLength
  readonly height?: FaceLength | undefined
  readonly shape?: 'circle' | 'square' | 'stadium' | undefined
}

/** An event shot on a face: the gauge that scores it and how a hole counts. */
export interface FaceEvent {
  readonly id: string
  readonly gauge?: FaceLength | undefined
  readonly scoring?: 'touch' | 'centre' | 'outward' | undefined
}

/** A scoring center of a sheet with several, from the sheet center (x right, y up). */
export interface FaceBull {
  readonly x: FaceLength
  readonly y: FaceLength
  readonly zone?: string | undefined
}

/** What ring scoring reads of a target face record; the `TargetFace` of `@open-reloading/schema` is one. */
export interface ScoringFace {
  readonly rings: readonly FaceRing[]
  readonly innerTen?:
    | {
        readonly diameter: FaceLength
        readonly height?: FaceLength | undefined
        readonly rule?: 'touch' | 'cover' | undefined
      }
    | undefined
  readonly decimal?: boolean | undefined
  readonly events: readonly FaceEvent[]
  readonly bulls?: readonly FaceBull[] | undefined
}

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

/** The scores of a group's shots with their total, tenth-ring total and inner-ten count. */
export type GroupScore = {
  shots: RingScore[]
  total: number
  decimalTotal?: number
  innerTenCount: number
}

/** 1e-9 mm in m: a hole edge on a ring line within this counts as touching it. */
const touch = 1e-12
/** Radius in m of a face diameter in mm. */
const radius = (d: FaceLength): number => toSi('length', d.value / 2)

/** The scored hole diameter in m: 0 where the event counts the hole center, else the event's gauge, else the bullet diameter (m). */
export function scoredHoleDiameter<B extends number | undefined>(
  event: FaceEvent | undefined,
  bullet: B,
  gauge?: number,
): number | B {
  if (event?.scoring === 'centre') return 0
  const fixed = event?.gauge?.value ?? gauge
  return fixed ? toSi('length', fixed) : bullet
}

type Shape = Pick<FaceRing, 'diameter' | 'height' | 'shape'>

/** Distance in m from a point to the filled ellipse of semi-axes `a` and `b`, 0 inside: bisection on the root of the closest-point condition (Eberly 2013, "Distance from a point to an ellipse"). */
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

/** Whether the hole of radius `g` (m), centered at `p` in m from the area's center, touches the area a ring line bounds: a circle by the center distance, an oval by the distance to its ellipse, a square by the distance to its square (rounded at the corners), a stadium by the distance to the segment between its end circles' centers, less their radius. */
function touches(ring: Shape, p: Point, g: number): boolean {
  const w = radius(ring.diameter)
  if (ring.shape === 'square')
    return Math.hypot(Math.max(Math.abs(p.x) - w, 0), Math.max(Math.abs(p.y) - w, 0)) <= g + touch
  if (ring.shape === 'stadium' && ring.height) {
    const reach = Math.max(radius(ring.height) - w, 0)
    return Math.hypot(p.x, p.y - Math.max(-reach, Math.min(reach, p.y))) <= w + g + touch
  }
  if (ring.height) return ellipseGap(w, radius(ring.height), p.x, p.y) <= g + touch
  return Math.hypot(p.x, p.y) <= w + g + touch
}

/** The bull a shot belongs to: the nearest center (the first of the record on a tie). */
function nearestBull(face: ScoringFace, shot: Point): { centre: Point; zone?: string | undefined } {
  let best = { centre: { x: 0, y: 0 }, zone: undefined as string | undefined }
  let bestD = Number.POSITIVE_INFINITY
  for (const b of face.bulls ?? []) {
    const centre = { x: toSi('length', b.x.value), y: toSi('length', b.y.value) }
    const d = Math.hypot(shot.x - centre.x, shot.y - centre.y)
    if (d < bestD) [best, bestD] = [{ centre, zone: b.zone }, d]
  }
  return best
}

/** A hole of diameter `hole` (m) at `shot` (m from the face center): the nearest bull, then the highest ring whose outer edge the hole touches (`outward`: the highest circular ring the whole hole lies inside, short of the line's outer edge), tenths counted inward from the touching position, and the inner ten by the face's rule. */
export function scoreShot(
  face: ScoringFace,
  shot: Point,
  hole: number,
  outward = false,
): RingScore {
  const { centre, zone } = nearestBull(face, shot)
  const score = scoreOnBull(face, { x: shot.x - centre.x, y: shot.y - centre.y }, hole, outward)
  return zone ? { ...score, zone } : score
}

/** `scoreShot` for one bull: `shot` in m from its center. */
function scoreOnBull(face: ScoringFace, shot: Point, hole: number, outward: boolean): RingScore {
  const d = Math.hypot(shot.x, shot.y)
  const g = hole / 2
  const rings = face.rings
  const i = rings.findLastIndex((r) =>
    outward ? d + g < radius(r.diameter) - touch : touches(r, shot, g),
  )
  if (i < 0) return { value: 0, ...(face.decimal && { decimal: 0 }), innerTen: false }
  const ring = nth(rings, i)
  const value = ring.value
  const inner = face.innerTen
  // the inner ten of a stadium face is a stadium
  const stadium = nth(rings, 0).shape === 'stadium' ? ('stadium' as const) : undefined
  const x =
    i === rings.length - 1 &&
    !!inner &&
    (inner.rule === 'cover'
      ? d + radius(inner.diameter) <= g + touch
      : touches({ ...inner, shape: stadium }, shot, g))
  if (!face.decimal) return { value, innerTen: x }
  // ring width: to the next ring inward, for the innermost ring to the next ring outward
  const [a, b] = i < rings.length - 1 ? [ring, nth(rings, i + 1)] : [nth(rings, i - 1), ring]
  const width = radius(a.diameter) - radius(b.diameter)
  const depth = (radius(ring.diameter) + g - d) / width
  const tenth = Math.min(9, Math.max(0, Math.floor(depth * 10 + 1e-9)))
  return { value, decimal: (value * 10 + tenth) / 10, innerTen: x }
}

/** Scores, total, tenth-ring total and inner-ten count of a group's shots. */
export function scoreGroup(
  face: ScoringFace,
  shots: readonly Point[],
  hole: number,
  outward = false,
): GroupScore {
  const scores = shots.map((s) => scoreShot(face, s, hole, outward))
  const total = scores.reduce((sum, s) => sum + s.value, 0)
  const xCount = scores.filter((s) => s.innerTen).length
  if (!face.decimal) return { shots: scores, total, innerTenCount: xCount }
  // a decimal face scores every shot with its decimal
  const tenths = scores.reduce((sum, s) => sum + Math.round(Number(s.decimal) * 10), 0)
  return { shots: scores, total, decimalTotal: tenths / 10, innerTenCount: xCount }
}

/** Points marked on one ring of a face, and the ring's diameter. */
export type RingMarks = { diameter: number; points: readonly Point[] }

/** A face placed by its ring marks: center and scale, and the RMS of the radial misfit, in point units. */
export type RingFit = { centre: Point; scale: number; rmsMisfit: number }

/** Center and scale (point units per diameter unit) from marks on two or more rings: |p - center| = scale x diameter / 2 by linear least squares in the center, the squared scale and a free |center|^2 (algebraic circle fit, Kasa 1976, one radius per ring); `rms` is the radial misfit in point units. shortcut: algebraic fit, no perspective, rotation or ring-line thickness; upgrade to a geometric fit through the photo homography when the editor uses faces as calibration references. */
export function fitRings(marks: readonly RingMarks[]): RingFit | { issue: RingFitIssue } {
  const all = marks.flatMap((m) => m.points.map((p) => ({ p, r: m.diameter / 2 })))
  if (new Set(marks.filter((m) => m.points.length).map((m) => m.diameter)).size < 2)
    return { issue: { code: 'two-rings', params: {} } }
  if (all.length < 4) return { issue: { code: 'four-points', params: {} } }
  const norm = normaliseMarks(all)
  const fit = norm.sp > 0 && norm.sr > 0 ? solveCircleFit(all, norm) : undefined
  if (!fit) return { issue: { code: 'degenerate-points', params: {} } }
  const { centre, scale } = fit
  const misfit = all.reduce(
    (s, { p, r }) => s + (Math.hypot(p.x - centre.x, p.y - centre.y) - scale * r) ** 2,
    0,
  )
  return { centre, scale, rmsMisfit: Math.sqrt(misfit / all.length) }
}

type MarkedPoint = { p: Point; r: number }
/** Centroid (`mx`, `my`) and mean distance `sp` from it of the points, mean radius `sr`. */
type MarkNormalisation = { mx: number; my: number; sp: number; sr: number }

/** Normalization of the marks: points around their centroid at mean distance 1, radii at mean 1. */
function normaliseMarks(all: readonly MarkedPoint[]): MarkNormalisation {
  const mx = all.reduce((s, { p }) => s + p.x, 0) / all.length
  const my = all.reduce((s, { p }) => s + p.y, 0) / all.length
  const sp = all.reduce((s, { p }) => s + Math.hypot(p.x - mx, p.y - my), 0) / all.length
  const sr = all.reduce((s, { r }) => s + r, 0) / all.length
  return { mx, my, sp, sr }
}

/** By the normal equations of the algebraic circle fit on the normalized marks; undefined when they have no solution or no positive squared scale. */
function solveCircleFit(
  all: readonly MarkedPoint[],
  { mx, my, sp, sr }: MarkNormalisation,
): { centre: Point; scale: number } | undefined {
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
  const solution = solveLinear(ata, atb)
  if (!solution) return undefined
  const [cx, cy, u] = [nth(solution, 0), nth(solution, 1), nth(solution, 2)]
  if (!(u > 0)) return undefined
  return { centre: { x: mx + cx * sp, y: my + cy * sp }, scale: (Math.sqrt(u) * sp) / sr }
}

/** Where a face lies on the sheet: its center in target m and target m per face m (1 when true). */
export type FaceAlignment = { centre: Point; scale: number; rms?: number }
/** A point marked on ring `ring` (its value) of a face, in target m. */
export type FaceMark = { ring: number; x: number; y: number }

/** A sheet point (target m) in face m from the face center. */
export const onFace = (a: FaceAlignment, p: Point): Point => ({
  x: (p.x - a.centre.x) / a.scale,
  y: (p.y - a.centre.y) / a.scale,
})
/** A face point (face m from its center) on the sheet, target m. */
export const onSheet = (a: FaceAlignment, q: Point): Point => ({
  x: a.centre.x + q.x * a.scale,
  y: a.centre.y + q.y * a.scale,
})

/** `fitRings` on target m with diameters in mm, so its scale is target m per face mm, times 1e3 here; else centered on `aim` (or the origin) at the calibrated scale. */
export function faceAlignment(
  face: ScoringFace,
  marks: readonly FaceMark[] | undefined,
  aim: Point | undefined,
): FaceAlignment | { issue: RingFitIssue } {
  if (!marks?.length) return { centre: aim ?? { x: 0, y: 0 }, scale: 1 }
  if (face.bulls) return { issue: { code: 'one-bull', params: {} } }
  if (face.rings.some((r) => r.height || r.shape === 'square'))
    return { issue: { code: 'circular-rings', params: {} } }
  const byRing = marksByRing(face, marks)
  if ('issue' in byRing) return byRing
  const fit = fitRings(byRing)
  if ('issue' in fit) return fit
  return { centre: fit.centre, scale: fromSi('length', fit.scale), rms: fit.rmsMisfit }
}

/** The marks per ring with the ring's diameter (mm); an issue for a ring value the face does not have. */
function marksByRing(
  face: ScoringFace,
  marks: readonly FaceMark[],
): RingMarks[] | { issue: RingFitIssue } {
  const rings = new Map<number, Point[]>()
  for (const m of marks) rings.set(m.ring, [...(rings.get(m.ring) ?? []), m])
  const byRing: RingMarks[] = []
  for (const [value, points] of rings) {
    const ring = face.rings.find((r) => r.value === value)
    if (!ring) return { issue: { code: 'no-ring', params: { value } } }
    byRing.push({ diameter: ring.diameter.value, points })
  }
  return byRing
}

/** A ring of `diameter` mm as a closed polyline of 72 points on the sheet, target m. */
export function ringPath(a: FaceAlignment, diameter: number): Point[] {
  const r = toSi('length', diameter / 2)
  return Array.from({ length: 72 }, (_, i) => {
    const t = (i / 72) * 2 * Math.PI
    return onSheet(a, { x: r * Math.cos(t), y: r * Math.sin(t) })
  })
}

/** The 10 zone (innermost ring touched) is wider than one ring width, so its tenths are the project's own rule, not the rule book's (`apps/docs/docs/models/ring-scoring.md`, "Tenth-ring value"). */
export function usesOwnTenthRule(face: ScoringFace, hole: number): boolean {
  // a face of one ring has no inner ring: both sides are NaN and the answer false
  const [outer = Number.NaN, inner = Number.NaN] = face.rings
    .slice(-2)
    .map((r) => radius(r.diameter))
  return inner + hole / 2 > outer - inner + touch
}

/** Why a group cannot be scored on its face: no hole size, or ring marks that do not fit. */
export type GroupIssue = Diagnostic<'hole-size'> | Diagnostic<'ring-marks', { fit: RingFitIssue }>

/** A group scored on its face: where the face lies, the scored hole and the scores. */
export type FaceGroupScore = {
  alignment: FaceAlignment
  hole: number
  usesOwnTenthRule: boolean
  score: GroupScore
}

/** The hole from the event's gauge, else the gauge of the discipline's mapping (`choice.gauge`, mm), else `bullet` (m); each shot's score, and total, tenths and inner tens over the included shots only; an issue when the hole size is unknown or the marks do not fit. */
export function scoreGroupOnFace(
  face: ScoringFace,
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
): FaceGroupScore | { issue: GroupIssue } {
  const event = face.events.find((e) => e.id === choice.event)
  const hole = scoredHoleDiameter(event, bullet, choice.gauge)
  if (hole === undefined || (!hole && event?.scoring !== 'centre'))
    return { issue: { code: 'hole-size', params: {} } }
  const alignment = faceAlignment(face, choice.marks, group.aim)
  if ('issue' in alignment)
    return { issue: { code: 'ring-marks', params: { fit: alignment.issue } } }
  const outward = event?.scoring === 'outward'
  const shots = group.shots.map((s) => scoreShot(face, onFace(alignment, s), hole, outward))
  const counted = scoreGroup(
    face,
    group.shots.filter((s) => !s.excluded).map((s) => onFace(alignment, s)),
    hole,
    outward,
  )
  return {
    alignment,
    hole,
    // outward gauging scores whole rings only
    usesOwnTenthRule: !outward && usesOwnTenthRule(face, hole),
    score: { ...counted, shots },
  }
}
