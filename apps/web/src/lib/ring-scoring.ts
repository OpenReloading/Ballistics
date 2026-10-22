/**
 * Ring scoring of shots on a rule-book target face (`apps/docs/docs/models/ring-scoring.md`) and the fit of a
 * face to ring marks on a sheet. Shots and holes in target m relative to the face centre, as the
 * target sheet stores them; face records in mm. Pure: no React, DOM or Next.js.
 */
import type { TargetFace } from '@openreloading/schema'
import { type Point, solve } from './target-geometry.ts'

export type RingScore = {
  /** Value of the highest ring the hole touches; 0 outside the face. */
  value: number
  /** Tenth-ring value, on faces whose rules define it. */
  decimal?: number
  /** True when the hole is in the inner ten under the face's `innerTen.rule`. */
  innerTen: boolean
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
const radius = (d: { value: number }) => d.value * 5e-4

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
  return fixed ? fixed * 1e-3 : bullet
}

/**
 * Score of a hole of diameter `hole` (m) centred at `shot` (m from the face centre): the highest
 * ring whose outer edge the hole touches, tenths of that ring's width counted inward from the
 * touching position, and the inner ten by the face's rule.
 */
export function scoreShot(face: TargetFace, shot: Point, hole: number): RingScore {
  const d = Math.hypot(shot.x, shot.y)
  const g = hole / 2
  const rings = face.rings
  const i = rings.findLastIndex((r) => d <= radius(r.diameter) + g + touch)
  if (i < 0) return { value: 0, ...(face.decimal && { decimal: 0 }), innerTen: false }
  const value = rings[i].value
  const inner = face.innerTen
  const x =
    i === rings.length - 1 &&
    !!inner &&
    (inner.rule === 'cover'
      ? d + radius(inner.diameter) <= g + touch
      : d <= radius(inner.diameter) + g + touch)
  if (!face.decimal) return { value, innerTen: x }
  // ring width: to the next ring inward, for the innermost ring to the next ring outward
  const [a, b] = i < rings.length - 1 ? [rings[i], rings[i + 1]] : [rings[i - 1], rings[i]]
  const width = radius(a.diameter) - radius(b.diameter)
  const depth = (radius(rings[i].diameter) + g - d) / width
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
    for (let i = 0; i < 4; i++) {
      atb[i] += row[i] * (x * x + y * y)
      for (let j = 0; j < 4; j++) ata[i][j] += row[i] * row[j]
    }
  }
  const [cx, cy, u] = solve(ata, atb)
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
  const rings = new Map<number, Point[]>()
  for (const m of marks) rings.set(m.ring, [...(rings.get(m.ring) ?? []), m])
  const fit = fitRings(
    [...rings].map(([value, points]) => {
      const ring = face.rings.find((r) => r.value === value)
      if (!ring) throw new Error(`The face has no ring ${value}`)
      return { diameter: ring.diameter.value, points }
    }),
  )
  return { centre: fit.centre, scale: fit.scale * 1e3, rms: fit.rmsMisfit }
}

/** A ring of `diameter` mm as a closed polyline of 72 points on the sheet, target m. */
export function ringPath(a: FaceAlignment, diameter: number): Point[] {
  const r = diameter * 5e-4
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
  const [outer, inner] = face.rings.slice(-2).map((r) => radius(r.diameter))
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
  choice: { id: string; event?: string; marks?: readonly FaceMark[]; gauge?: number },
  group: { aim?: Point; shots: readonly (Point & { excluded?: boolean })[] },
  bullet: number | undefined,
):
  | { alignment: FaceAlignment; hole: number; usesOwnTenthRule: boolean; score: GroupScore }
  | { error: string } {
  const event = face.events.find((e) => e.name === choice.event)
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
