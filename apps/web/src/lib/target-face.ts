/**
 * Target face recognition on a photo: the black
 * area by a threshold sweep and an ellipse fit, the ring lines by Hessian ridges and a robust
 * ellipse fit per ring, the ring radii matched against the rule-book faces, and the face plane,
 * centre and scale from two or more concentric ellipses (the conic pencil). Pure: no React, DOM or
 * Next.js, so it runs in the Web Worker.
 */
import type { TargetFace } from '@openreloading/schema'
import {
  concentricPlane,
  conicOf,
  type Ellipse,
  ellipsePoint,
  largestGap,
  meanRadius,
  ransacEllipse,
  seededRandom,
} from './ellipse.ts'
import {
  blackAreas,
  type Grid,
  grayGrid,
  gridToImage,
  imageToGrid,
  refineEdge,
  ridges,
} from './face-image.ts'
import type { FaceLabel } from './hole-detection.ts'
import type { RgbaImage } from './image.ts'
import { applyMatrix, inv3, type Matrix, mul3, type Point } from './target-geometry.ts'

/** A ring line found on the photo. */
export type Ring = {
  /** Ellipse in image px. */
  ellipse: Ellipse
  /** Share of the ellipse the ridge points cover, 0..1. */
  arc: number
  points: number
}

/** The coarse grid of the black area search is about this many px on the longer side. */
const COARSE = 500
/** The crop around the black area for the ring lines is about this many px on its side. */
const FINE = 1400
/** The black area is at most about this many grid px across on the crop for the ring lines. */
const BLACK_PX = 500
/** Rings of a face reach at most this many black radii from the centre (2.61 on the air pistol face). */
const REACH = 2.8
/** A ring matches a face ring within this share of its radius (3 %; the true matches on the local photos are within 1.7 %). */
const TOLERANCE = 0.03
/** Faces within this score of the best (half a ring) are ratio twins: a ring the photo misses or a false one can make another face fit as well. */
const TIE = 0.5
/** A known scale and the scale a face needs for the black area found differ by at most this share. */
const SCALE_TOLERANCE = 0.2
/** A face needs the black edge and at least this many matched rings. */
const MIN_RINGS = 3
/** The search stops at a fit this good (score), else it tries every black area candidate. */
const SURE = 3
/** A fit is applied without a question with this many rings matched and this score. */
const SURE_RINGS = 4
const SURE_SCORE = 2.5
/** Numerals stand on the two axes within this many mm of them (the digits of the local 25 m faces are 4 to 9 mm tall), between the ring lines. */
const NUMERAL_WIDTH = 6
/** The rings rectify to circles within this share of the black radius (rms). */
const MAX_RMS = 0.015

function toImageEllipse(grid: Grid, e: Ellipse): Ellipse {
  const c = gridToImage(grid, { x: e.centreX, y: e.centreY })
  return {
    centreX: c.x,
    centreY: c.y,
    semiMajor: e.semiMajor * grid.blockSize,
    semiMinor: e.semiMinor * grid.blockSize,
    angle: e.angle,
  }
}
function toGridEllipse(grid: Grid, e: Ellipse): Ellipse {
  const c = imageToGrid(grid, { x: e.centreX, y: e.centreY })
  return {
    centreX: c.x,
    centreY: c.y,
    semiMajor: e.semiMajor / grid.blockSize,
    semiMinor: e.semiMinor / grid.blockSize,
    angle: e.angle,
  }
}

/**
 * Ring lines around a black area: Hessian ridges in a crop of the photo around it, grouped by
 * their normalised radius (the fragments of one ring lie at one radius), one robust ellipse per
 * group. Returns the black edge refined on the finer grid too.
 */
function ringLines(image: RgbaImage, black: Ellipse): { black: Ellipse; rings: Ring[] } {
  const half = REACH * meanRadius(black)
  // the crop is cut at the photo's edge; its longer side sets the block size
  const box = {
    x0: Math.max(0, black.centreX - half),
    y0: Math.max(0, black.centreY - half),
    x1: Math.min(image.width, black.centreX + half),
    y1: Math.min(image.height, black.centreY + half),
  }
  // a black area of more than `BLACK_PX` px across is averaged down: a zoomed photo's thick lines stay lines
  const s1 = Math.max(
    1,
    Math.ceil(Math.max(box.x1 - box.x0, box.y1 - box.y0) / FINE),
    Math.round((2 * meanRadius(black)) / BLACK_PX),
  )
  const fine = grayGrid(image, s1, box)
  const blackFine = refineBlackEdge(fine, black)
  const conic = conicOf(blackFine)
  const rb = meanRadius(blackFine)
  // the normalised radius of a point: 1 on the black edge
  const uOf = (x: number, y: number) =>
    Math.sqrt(
      Math.max(
        0,
        conic[0] * x * x +
          conic[1] * x * y +
          conic[2] * y * y +
          conic[3] * x +
          conic[4] * y +
          conic[5] +
          1,
      ),
    )
  const { components } = ridges(
    fine,
    ringBandMask(fine, uOf),
    [1.2, 2],
    Math.max(12, Math.round(0.08 * rb)),
  )
  const first = fitRingGroups(fine, groupFragments(components, uOf), rb)
  // under a steep perspective the outer rings are not concentric with the black edge's ellipse,
  // so their radii by it spread into each other: group again by the radius on the face's plane.
  // A sheet seen nearly square on keeps the first grouping: one ring's pencil is noisier there
  const tilted = blackFine.semiMinor / blackFine.semiMajor < 0.9
  const plane = tilted
    ? ringPlane(
        blackFine,
        first.map((r) => toGridEllipse(fine, r.ellipse)),
      )
    : undefined
  const rings = plane
    ? fitRingGroups(
        fine,
        groupFragments(components, (x, y) => {
          const p = applyMatrix(plane, { x, y })
          return Math.hypot(p.x, p.y)
        }),
        rb,
      )
    : first
  return { black: toImageEllipse(fine, blackFine), rings }
}

/**
 * The map onto the face's plane where the black edge is the unit circle, from the conic pencil of
 * the black edge and the ring that gives the longest lever (its ratio agreeing with the mean radii's
 * within 6 %). Undefined without such a ring.
 */
function ringPlane(black: Ellipse, rings: readonly Ellipse[]): Matrix | undefined {
  let best: Matrix | undefined
  let bestKey = 0
  for (const e of rings) {
    const mean = meanRadius(e) / meanRadius(black)
    const plane = concentricPlane(conicOf(black), conicOf(e))
    if (!plane || Math.abs(plane.ratio * mean - 1) > 0.06) continue
    const key = Math.abs(Math.log(mean))
    if (key > bestKey) [best, bestKey] = [plane.toPlane, key]
  }
  return best
}

type RadiusOf = (x: number, y: number) => number

/** The black edge refined on the crop's grid, else the one found on the coarse grid; grid px. */
function refineBlackEdge(fine: Grid, black: Ellipse): Ellipse {
  const start = toGridEllipse(fine, black)
  const edge = refineEdge(fine, start, 0.06)
  return edge ? edge.ellipse : start
}

/** The band of normalised radii 0.12 to `REACH` that holds the rings, not the middle of the bull. */
function ringBandMask(fine: Grid, uOf: RadiusOf): Uint8Array {
  const mask = new Uint8Array(fine.width * fine.height)
  for (let y = 0; y < fine.height; y++)
    for (let x = 0; x < fine.width; x++) {
      const u = uOf(x, y)
      if (u >= 0.12 && u <= REACH) mask[y * fine.width + x] = 1
    }
  return mask
}

/**
 * The ridge components that keep one normalised radius (spread within 6 % of it), grouped by
 * radius: the next fragment within 0.04 of the last joins its group. The points of each group.
 */
function groupFragments(components: Point[][], uOf: RadiusOf): Point[][] {
  const frags = components
    .map((pts) => {
      const us = pts.map((p) => uOf(p.x, p.y))
      const mean = us.reduce((s, v) => s + v, 0) / us.length
      const sd = Math.sqrt(us.reduce((s, v) => s + (v - mean) ** 2, 0) / us.length)
      return { pts, mean, sd }
    })
    .filter((f) => f.sd <= 0.06 * f.mean)
    .sort((x, y) => x.mean - y.mean)
  const groups: Array<typeof frags> = []
  for (const f of frags) {
    const last = groups[groups.length - 1]
    if (last && f.mean - last[last.length - 1].mean <= 0.04) last.push(f)
    else groups.push([f])
  }
  return groups.map((group) => group.flatMap((f) => f.pts))
}

/** One robust ellipse per group of ridge points (`rb` the black radius, grid px), as rings in image px. */
function fitRingGroups(fine: Grid, groups: Point[][], rb: number): Ring[] {
  const rnd = seededRandom(7)
  const rings: Ring[] = []
  for (const pts of groups) {
    if (pts.length < Math.max(30, 0.5 * rb)) continue
    const fit = ransacEllipse(
      pts,
      {
        tolerance: 1,
        minPoints: Math.max(30, Math.round(0.4 * pts.length)),
        rounds: 80,
        accept: (e) =>
          e.semiMinor / e.semiMajor > 0.3 && meanRadius(e) < 4 * rb && meanRadius(e) > 0.1 * rb,
      },
      rnd,
    )
    if (!fit) continue
    const inl = fit.inliers.map((i) => pts[i])
    const arc = 1 - largestGap(inl, fit.ellipse.centreX, fit.ellipse.centreY) / (2 * Math.PI)
    if (arc >= 0.3 && fit.rms < 0.8)
      rings.push({ ellipse: toImageEllipse(fine, fit.ellipse), arc, points: inl.length })
  }
  return rings
}

/** The rings that can belong to the face of `black`: concentric, alike in shape, each radius once. */
function concentric(black: Ellipse, rings: readonly Ring[]): Ring[] {
  const rho = meanRadius(black)
  const aspect = black.semiMinor / black.semiMajor
  const out: Ring[] = []
  for (const r of [...rings].sort((x, y) => y.points - x.points)) {
    const radius = meanRadius(r.ellipse)
    if (Math.abs(radius / rho - 1) < 0.025) continue
    if (
      Math.hypot(r.ellipse.centreX - black.centreX, r.ellipse.centreY - black.centreY) >
      0.18 * rho
    )
      continue
    if (Math.abs(r.ellipse.semiMinor / r.ellipse.semiMajor - aspect) > 0.15) continue
    if (out.some((o) => Math.abs(meanRadius(o.ellipse) / radius - 1) < 0.025)) continue
    out.push(r)
  }
  return out.sort((x, y) => meanRadius(x.ellipse) - meanRadius(y.ellipse))
}

/** A ring of a face record, radius in mm. */
type FaceRing = { radius: number; label: string }

/** The circles a face prints besides its black edge: the scoring rings and the inner ten. */
function faceRings(face: TargetFace): FaceRing[] {
  const list: FaceRing[] = face.rings.map((r) => ({
    radius: r.diameter.value / 2,
    label: String(r.value),
  }))
  const inner = face.innerTen?.diameter.value
  if (inner !== undefined && !list.some((r) => Math.abs(r.radius - inner / 2) < 1e-6))
    list.push({ radius: inner / 2, label: 'X' })
  return list
    .filter((r) => Math.abs(r.radius - face.blackDiameter.value / 2) > 1e-6)
    .sort((a, b) => b.radius - a.radius)
}

type FaceMatch = {
  face: TargetFace
  /** Higher is better; ties are faces whose rings the photo cannot tell apart. */
  score: number
  /** The rings found that match, with the ring they match. */
  matched: Array<{ ring: Ring; label: string; radius: number; error: number }>
}

/**
 * The faces ranked by how well the rings found around the black area fit their ring radii: the
 * black edge is the face's black diameter, so the scale is fixed, each ring found takes the
 * nearest ring of the face within 4 % of its radius, and rings expected between 0.15 and 2.9 black
 * radii that are not found count against a face a little. With the photo's `frame` (px), only a
 * ring with half its line in the photo is expected. A face with `photoSearch: false` is skipped.
 * With a known `scale` (image px per mm along the black area's long axis) a face whose black area
 * would have another size is skipped too.
 */
export function matchFaces(
  black: Ellipse,
  rings: readonly Ring[],
  faces: readonly TargetFace[],
  frame?: { width: number; height: number },
  scale?: number,
): FaceMatch[] {
  const rho = meanRadius(black)
  const found = concentric(black, rings)
  const out: FaceMatch[] = []
  for (const face of faces) {
    if (face.photoSearch === false) continue
    const s = rho / (face.blackDiameter.value / 2)
    if (
      scale &&
      Math.abs(black.semiMajor / (face.blackDiameter.value / 2) / scale - 1) > SCALE_TOLERANCE
    )
      continue
    const list = faceRings(face)
    const matched = matchGreedily(pairCandidates(found, list, s), list)
    const expected = list.filter(
      (r) =>
        s * r.radius >= 0.15 * rho &&
        s * r.radius <= 2.9 * rho &&
        (!frame || shareInFrame(black, (s * r.radius) / rho, frame) >= 0.5),
    )
    const missing = expected.filter((r) => !matched.some((m) => m.radius === r.radius)).length
    out.push({ face, score: scoreMatch(matched, missing, found.length), matched })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** Share of 24 points of the ellipse `e` grown `k` times about its centre that lie in the frame. */
function shareInFrame(e: Ellipse, k: number, frame: { width: number; height: number }): number {
  const grown = { ...e, semiMajor: k * e.semiMajor, semiMinor: k * e.semiMinor }
  let inside = 0
  for (let i = 0; i < 24; i++) {
    const p = ellipsePoint(grown, (2 * Math.PI * i) / 24)
    if (p.x >= 0 && p.y >= 0 && p.x < frame.width && p.y < frame.height) inside++
  }
  return inside / 24
}

type Pair = { ring: Ring; j: number; i: number; error: number }

/** Every pair of a ring found (`j`) and a face ring (`i`, scaled by `s` px per mm) within `TOLERANCE`, closest first. */
function pairCandidates(found: readonly Ring[], list: readonly FaceRing[], s: number): Pair[] {
  return found
    .flatMap((ring, j) =>
      list.map((fr, i) => ({
        ring,
        j,
        i,
        error: Math.abs((s * fr.radius) / meanRadius(ring.ellipse) - 1),
      })),
    )
    .filter((p) => p.error <= TOLERANCE)
    .sort((a, b) => a.error - b.error)
}

/** The pairs taken closest first, each ring found and each face ring once. */
function matchGreedily(pairs: readonly Pair[], list: readonly FaceRing[]): FaceMatch['matched'] {
  const [usedFace, usedFound] = [new Set<number>(), new Set<number>()]
  const matched: FaceMatch['matched'] = []
  for (const p of pairs) {
    if (usedFace.has(p.i) || usedFound.has(p.j)) continue
    usedFace.add(p.i)
    usedFound.add(p.j)
    matched.push({
      ring: p.ring,
      label: list[p.i].label,
      radius: list[p.i].radius,
      error: p.error,
    })
  }
  return matched
}

/**
 * The score of a match: each ring by its arc and its error, less 0.3 for each of the `missing`
 * rings expected and not matched and 0.1 for each of the `found` rings not matched.
 */
function scoreMatch(matched: FaceMatch['matched'], missing: number, found: number): number {
  let score = 0
  for (const m of matched) score += (0.6 + 0.4 * m.ring.arc) * (1 - m.error / (2 * TOLERANCE))
  return score - 0.3 * missing - 0.1 * (found - matched.length)
}

/** The target face on a photo: photo px to face mm (x right, y up from its centre), its radii in mm. */
export type FaceGeometry = {
  toFace: Matrix
  outer: number
  black: number
  /** Radii of the scoring rings, mm (the numerals stand between them). */
  rings?: readonly number[]
}

/** The face plane on the photo. */
export type FacePlane = {
  /** Face centre, image px. */
  centre: Point
  /** Image px to face mm (x right, y up from the centre), the perspective included. */
  toFace: Matrix
  /** Image px per mm of the face at its centre. */
  pxPerMm: number
  /** Root mean square of the ellipses' radial misfit on the face plane, mm. */
  rms: number
  /** Radius of the outer ring (or of the black edge when no face is known), mm. */
  outer: number
  /** The corners of the square about the outer ring as image px, top left first (y up). */
  corners: [Point, Point, Point, Point]
  /** The outer ring and the black edge as closed polylines of image px. */
  outline: Point[]
  blackOutline: Point[]
  /** Ellipses that gave the plane. */
  ellipses: number
  /** One ellipse gave the plane: the centre is the ellipse's, biased under tilt. */
  approximate: boolean
}

export type FaceFit = FacePlane & { face: TargetFace }

type Member = { ellipse: Ellipse; radius: number; arc: number }

/** A plane map (image px to unit circle) turned and mirrored so the face has x right and y up, scaled to mm. */
function oriented(toPlane: number[], radius: number, centre: Point): number[] {
  const at = (p: Point) => applyMatrix(toPlane, p)
  const [c, ex, ey] = [
    at(centre),
    at({ x: centre.x + 1, y: centre.y }),
    at({ x: centre.x, y: centre.y + 1 }),
  ]
  const [jx, jy] = [
    { x: ex.x - c.x, y: ex.y - c.y },
    { x: ey.x - c.x, y: ey.y - c.y },
  ]
  // image y points down and the face's y up: a view that is not mirrored has a negative determinant
  const flip = jx.x * jy.y - jx.y * jy.x > 0 ? -1 : 1
  const phi = Math.atan2(jx.y * flip, jx.x)
  const [cs, sn] = [Math.cos(-phi), Math.sin(-phi)]
  const out = mul3(
    [radius, 0, 0, 0, radius, 0, 0, 0, 1],
    mul3([cs, -sn, 0, sn, cs, 0, 0, 0, 1], mul3([1, 0, 0, 0, flip, 0, 0, 0, 1], toPlane)),
  )
  const w = out[6] * centre.x + out[7] * centre.y + out[8]
  return out.map((v) => v / w)
}

/** The plane of `members` from a map to the unit circle of the first; undefined when it is singular. */
function planeOf(
  toPlane: number[],
  centre: Point,
  members: Member[],
  outer: number,
  black: number,
  approximate: boolean,
): FacePlane | undefined {
  const toFace = oriented(toPlane, members[0].radius, centre)
  const inv = inv3(toFace)
  if (!inv) return undefined
  const toImg = (p: Point) => applyMatrix(inv, p)
  const centreImg = toImg({ x: 0, y: 0 })
  const [east, north] = [toImg({ x: 1, y: 0 }), toImg({ x: 0, y: 1 })]
  return {
    centre: centreImg,
    toFace,
    pxPerMm: Math.sqrt(
      Math.abs(
        (east.x - centreImg.x) * (north.y - centreImg.y) -
          (east.y - centreImg.y) * (north.x - centreImg.x),
      ),
    ),
    rms: planeMisfit(members, toFace),
    outer,
    ...planePolylines(inv, outer, black),
    ellipses: members.length,
    approximate,
  }
}

/** Root mean square of the radial misfit of 48 points of each ellipse on the face plane, mm. */
function planeMisfit(members: readonly Member[], toFace: Matrix): number {
  let [sum, count] = [0, 0]
  for (const m of members)
    for (let k = 0; k < 48; k++) {
      const q = applyMatrix(toFace, ellipsePoint(m.ellipse, (2 * Math.PI * k) / 48))
      sum += (Math.hypot(q.x, q.y) - m.radius) ** 2
      count++
    }
  return Math.sqrt(sum / count)
}

/** The square about the outer ring and the circles of radius `outer` and `black` (mm) on the photo through `toImage`. */
function planePolylines(
  toImage: Matrix,
  outer: number,
  black: number,
): Pick<FacePlane, 'corners' | 'outline' | 'blackOutline'> {
  const toImg = (p: Point) => applyMatrix(toImage, p)
  const circle = (r: number, n = 72) =>
    Array.from({ length: n }, (_, k) =>
      toImg({ x: r * Math.cos((2 * Math.PI * k) / n), y: r * Math.sin((2 * Math.PI * k) / n) }),
    )
  return {
    corners: [
      toImg({ x: -outer, y: outer }),
      toImg({ x: outer, y: outer }),
      toImg({ x: outer, y: -outer }),
      toImg({ x: -outer, y: -outer }),
    ],
    outline: circle(outer),
    blackOutline: circle(black),
  }
}

/**
 * The face plane from concentric ellipses of known radii (mm): the pair farthest apart in radius
 * (radii at least 1.3 apart, the arcs weighing in) gives the conic pencil, whose own radius ratio
 * must be the known one within 6 %; the others are checked on the plane. `outer` and `black` are
 * the radii of the outline drawn. Undefined without a usable pair.
 */
function planeFromEllipses(members: Member[], outer: number, black: number): FacePlane | undefined {
  let best: { a: Member; plane: NonNullable<ReturnType<typeof concentricPlane>> } | undefined
  let bestKey = 0
  for (const a of members)
    for (const b of members) {
      if (a.radius < b.radius * 1.3) continue
      const plane = concentricPlane(conicOf(a.ellipse), conicOf(b.ellipse))
      if (!plane || Math.abs(plane.ratio / (a.radius / b.radius) - 1) > 0.06) continue
      const key = Math.log(a.radius / b.radius) * Math.min(a.arc, b.arc)
      if (key > bestKey) [best, bestKey] = [{ a, plane }, key]
    }
  if (!best) return undefined
  // the pair's larger ellipse leads: its radius scales the plane
  const ordered = [best.a, ...members.filter((m) => m !== best?.a)]
  return planeOf(best.plane.toPlane, best.plane.centre, ordered, outer, black, false)
}

/**
 * The plane of one ellipse taken as a circle of radius `radius` mm about its centre: the perspective
 * is not known, so the centre is biased under tilt (3.7 to 15.7 mm measured on tilted photos).
 */
function planeFromOne(
  e: Ellipse,
  radius: number,
  outer: number,
  black: number,
): FacePlane | undefined {
  const [c, s] = [Math.cos(e.angle), Math.sin(e.angle)]
  const toPlane = [
    c / e.semiMajor,
    s / e.semiMajor,
    -(e.centreX * c + e.centreY * s) / e.semiMajor,
    -s / e.semiMinor,
    c / e.semiMinor,
    (e.centreX * s - e.centreY * c) / e.semiMinor,
    0,
    0,
    1,
  ]
  return planeOf(
    toPlane,
    { x: e.centreX, y: e.centreY },
    [{ ellipse: e, radius, arc: 1 }],
    outer,
    black,
    true,
  )
}

/**
 * A face fitted to the black edge and the rings matched. Undefined when the ellipses do not
 * rectify to circles of the face's radii (rms above 1.5 % of the black radius).
 */
function fitFace(black: Ellipse, match: FaceMatch): FaceFit | undefined {
  const face = match.face
  const blackRadius = face.blackDiameter.value / 2
  const outer = face.rings[0].diameter.value / 2
  let members: Member[] = [
    { ellipse: black, radius: blackRadius, arc: 1 },
    ...match.matched.map((m) => ({ ellipse: m.ring.ellipse, radius: m.radius, arc: m.ring.arc })),
  ]
  for (;;) {
    const plane = planeFromEllipses(members, outer, blackRadius)
    if (plane && plane.rms <= MAX_RMS * blackRadius) return { ...plane, face }
    // the ring that rectifies worst is a false match (a numeral, a fit through a crossing): without it
    if (!plane || members.length <= MIN_RINGS + 1) return undefined
    const worst = members
      .map((m, i) => ({ i, misfit: i ? misfitOf(m, plane.toFace) : -1 }))
      .reduce((a, b) => (b.misfit > a.misfit ? b : a)).i
    members = members.filter((_, i) => i !== worst)
  }
}

/** Root mean square of how far the ellipse's points on the face plane are from the circle of its radius, mm. */
function misfitOf(m: Member, toFace: Matrix): number {
  let sum = 0
  for (let k = 0; k < 48; k++) {
    const p = ellipsePoint(m.ellipse, (2 * Math.PI * k) / 48)
    const q = applyMatrix(toFace, p)
    sum += (Math.hypot(q.x, q.y) - m.radius) ** 2
  }
  return Math.sqrt(sum / 48)
}

export type FaceSearch = {
  /** The black area found, image px. */
  black?: Ellipse
  /** The black edge and the ring lines found, image px: what the user sees when no face fits. */
  ellipses: Ellipse[]
  /** The rings found (without the black edge), for a fit of a face the user picks. */
  rings: Ring[]
  /** The faces by score, best first. */
  ranked: Array<{ id: string; name: string; score: number; matched: number }>
  /** The fits of the best face and of the faces that fit as well (ratio twins), best first. */
  fits: FaceFit[]
  /**
   * One face with at least four rings matched and a score of 2.5: the editor applies it without a
   * question. Fewer rings are a coincidence of ratios often enough (rings at equal spacing) that the
   * user confirms the face.
   */
  sure: boolean
}

/**
 * Finds the target face in a photo. `image` may be any size: the search runs on a grid of about
 * 700 px and a crop of about 1400 px. `fits` is empty when no face is proposed (no black area, or
 * fewer than two rings match): `ellipses` and `ranked` are then what the editor shows. More than
 * one fit means ratio twins: the user's event or distance tells them apart. A known `scale` (image px per mm) drops the faces of another size first.
 */
export function findFace(
  image: RgbaImage,
  faces: readonly TargetFace[],
  scale?: number,
): FaceSearch {
  const s0 = Math.max(1, Math.ceil(Math.max(image.width, image.height) / COARSE))
  const coarse = grayGrid(image, s0)
  let result: FaceSearch = { ellipses: [], rings: [], ranked: [], fits: [], sure: false }
  let bestScore = Number.NEGATIVE_INFINITY
  for (const cand of blackAreas(coarse)) {
    const { black, rings } = ringLines(image, toImageEllipse(coarse, cand.ellipse))
    const ranked = matchFaces(black, rings, faces, image, scale)
    const search: FaceSearch = {
      black,
      ellipses: [black, ...concentric(black, rings).map((r) => r.ellipse)],
      rings,
      ranked: ranked.map((m) => ({
        id: m.face.id,
        name: m.face.name,
        score: m.score,
        matched: m.matched.length,
      })),
      fits: [],
      sure: false,
    }
    if (!result.black) result = search
    const top = ranked[0]
    if (!top || top.matched.length < MIN_RINGS) {
      // a ringed target that no face matches: another black area (its bull) is no better
      if (search.ellipses.length > MIN_RINGS) break
      continue
    }
    const fits = ranked
      .filter((m) => m.score >= top.score - TIE && m.matched.length >= MIN_RINGS)
      .map((m) => fitFace(black, m))
      .filter((f): f is FaceFit => !!f)
    if (!fits.length || top.score <= bestScore) continue
    const sure = fits.length === 1 && top.matched.length >= SURE_RINGS && top.score >= SURE_SCORE
    ;[result, bestScore] = [{ ...search, fits, sure }, top.score]
    if (top.score >= SURE) break
  }
  return result
}

/**
 * The fit of a face the user picked from the ranking, from the search's black edge and rings: with
 * two rings matched the pencil gives the plane, else the black edge alone (approximate).
 */
export function fitPicked(search: FaceSearch, face: TargetFace): FaceFit | undefined {
  if (!search.black) return undefined
  const match = matchFaces(search.black, search.rings, [face])[0]
  const full = match.matched.length >= MIN_RINGS ? fitFace(search.black, match) : undefined
  if (full) return full
  const blackRadius = face.blackDiameter.value / 2
  const plane = planeFromOne(
    search.black,
    blackRadius,
    face.rings[0].diameter.value / 2,
    blackRadius,
  )
  return plane && { ...plane, face }
}

/** The plane of the black edge alone when the user types its diameter (mm). */
export function fitDiameter(search: FaceSearch, diameter: number): FacePlane | undefined {
  if (!search.black || !(diameter > 0)) return undefined
  return planeFromOne(search.black, diameter / 2, diameter / 2, diameter / 2)
}

/** The same search on the photo: `k` work px per photo px, the work crop starting at (x0, y0) of the photo. */
export function onPhoto(search: FaceSearch, k: number, x0: number, y0: number): FaceSearch {
  const p = (q: Point): Point => ({ x: q.x / k + x0, y: q.y / k + y0 })
  const e = (el: Ellipse): Ellipse => {
    const c = p({ x: el.centreX, y: el.centreY })
    return {
      centreX: c.x,
      centreY: c.y,
      semiMajor: el.semiMajor / k,
      semiMinor: el.semiMinor / k,
      angle: el.angle,
    }
  }
  // photo to work: x' = k (x - x0)
  const toWork = [k, 0, -k * x0, 0, k, -k * y0, 0, 0, 1]
  return {
    ...(search.black && { black: e(search.black) }),
    ellipses: search.ellipses.map(e),
    rings: search.rings.map((r) => ({ ...r, ellipse: e(r.ellipse) })),
    ranked: search.ranked,
    sure: search.sure,
    fits: search.fits.map((f) => ({
      ...f,
      centre: p(f.centre),
      toFace: mul3(f.toFace, toWork),
      pxPerMm: f.pxPerMm / k,
      corners: f.corners.map(p) as FaceFit['corners'],
      outline: f.outline.map(p),
      blackOutline: f.blackOutline.map(p),
    })),
  }
}

/**
 * The face as the hole detection sees it, on the px `toFace` maps from: the outer ring grown by
 * `hole` mm (a hole touching the outer ring still scores) as the region, and the black area as
 * the background of its own kind.
 */
export function faceLabel(g: FaceGeometry, hole: number): FaceLabel {
  const inv = inv3(g.toFace) ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]
  const R = g.outer + hole / 2
  const outline = Array.from({ length: 72 }, (_, k) =>
    applyMatrix(inv, {
      x: R * Math.cos((2 * Math.PI * k) / 72),
      y: R * Math.sin((2 * Math.PI * k) / 72),
    }),
  )
  const radii = [...(g.rings ?? [])].sort((a, b) => a - b)
  const mm = (p: Point) => applyMatrix(g.toFace, p)
  return {
    outline,
    black: (p) => {
      const q = mm(p)
      return Math.hypot(q.x, q.y) <= g.black
    },
    ...(radii.length > 1 && {
      numeral: (p, roll = 0) => {
        const f = mm(p)
        const [c, s] = [Math.cos(roll), Math.sin(roll)]
        const q = { x: c * f.x + s * f.y, y: c * f.y - s * f.x }
        const r = Math.hypot(q.x, q.y)
        const i = radii.findIndex((v) => v > r) - 1
        if (i < 0) return false
        const gap = radii[i + 1] - radii[i]
        return (
          Math.min(Math.abs(q.x), Math.abs(q.y)) <= Math.min(NUMERAL_WIDTH, 0.3 * gap) &&
          Math.min(r - radii[i], radii[i + 1] - r) >= 0.2 * gap
        )
      },
      polar: (p) => {
        const q = mm(p)
        return { radius: Math.hypot(q.x, q.y), angle: Math.atan2(q.y, q.x) }
      },
    }),
  }
}
