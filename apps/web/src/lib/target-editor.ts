/**
 * Pure helpers of the target photo editor: the sheet's frame, edits that
 * keep shots on their holes and overlay geometry in target coordinates. SI in and
 * out (m, rad); no React, DOM or Next.js.
 */
import {
  type AimOffset,
  dispersionEllipse,
  type Ellipse,
  type GroupStatistics,
  subtendedAngle,
} from '@openreloading/core'
import {
  type CalibrationReference,
  type ShotGroup,
  type TargetSheet,
  toSi,
} from '@openreloading/schema'
import {
  applyMatrix,
  type Calibration,
  calibrate,
  keepOnPhoto,
  type Matrix,
  type Point,
  turnPoint,
} from './target-geometry.ts'
import { groupStatisticsOf } from './target-groups.ts'

/** Image px to target m and back; for a drawn target the view is target mm with y down. */
export type Frame = { toTarget: Matrix; toImage: Matrix; calibration?: Calibration }

const mm = toSi('length', 1)
const drawn: Frame = {
  toTarget: [mm, 0, 0, 0, -mm, 0, 0, 0, 1],
  toImage: [1 / mm, 0, 0, 0, -1 / mm, 0, 0, 0, 1],
}

/**
 * The frame of a sheet: the drawn target without a photo, the calibration with a photo and at
 * least one valid reference, else undefined (shots wait for a reference).
 */
export function frameOf(sheet: TargetSheet): Frame | undefined {
  if (sheet.photo === undefined) return drawn
  if (!sheet.references.length) return undefined
  try {
    const c = calibrate(
      sheet.references,
      sheet.targetRotation,
      sheet.targetOrigin ?? { x: 0, y: 0 },
    )
    return { toTarget: c.toTarget, toImage: c.toImage, calibration: c }
  } catch {
    return undefined
  }
}

export const targetToView = (f: Frame, q: Point) => applyMatrix(f.toImage, q)
export const viewToTarget = (f: Frame, p: Point) => applyMatrix(f.toTarget, p)

/**
 * `next` with every shot, point of aim, ring mark and note re-expressed so it stays on its photo
 * point, after a change of references, rotation or origin (`keepOnPhoto`); unchanged when either
 * side has no calibration.
 */
export function rebase(before: TargetSheet, next: TargetSheet): TargetSheet {
  const a = frameOf(before)?.calibration
  const b = frameOf(next)?.calibration
  if (!a || !b) return next
  return mapSheetPoints(next, (p) => ({ ...p, ...keepOnPhoto(p, a, b) }))
}

/** `sheet` with every shot, point of aim, ring mark and note passed through `move`. */
function mapSheetPoints(sheet: TargetSheet, move: <P extends Point>(p: P) => P): TargetSheet {
  return {
    ...sheet,
    groups: sheet.groups.map((g) => ({
      ...g,
      ...(g.aim && { aim: move(g.aim) }),
      ...(g.face?.marks && { face: { ...g.face, marks: g.face.marks.map(move) } }),
      shots: g.shots.map(move),
    })),
    ...(sheet.notes && { notes: sheet.notes.map(move) }),
  }
}

/** Calibration references with every photo point passed through `t`. */
function turnReferences(
  references: TargetSheet['references'],
  t: (p: Point) => Point,
): CalibrationReference[] {
  return references.map((r): CalibrationReference => {
    if (r.kind === 'line') return { ...r, a: t(r.a), b: t(r.b) }
    if (r.kind === 'ringCentre') return { ...r, centre: t(r.centre), edge: t(r.edge) }
    if (r.kind === 'ringEdge')
      return { ...r, points: [t(r.points[0]), t(r.points[1]), t(r.points[2])] }
    return { ...r, corners: [t(r.corners[0]), t(r.corners[1]), t(r.corners[2]), t(r.corners[3])] }
  })
}

/**
 * `sheet` with its photo turned to `angle` (rad, counter-clockwise on screen) about the middle of
 * a `size` photo: references, origin and detection regions turn with the photo, the target axes
 * stay on the screen, and every shot, point of aim, ring mark and note stays on its hole.
 */
export function turnSheet(
  sheet: TargetSheet,
  size: { width: number; height: number },
  angle: number,
): TargetSheet {
  // in (-pi, pi]
  const a = angle - 2 * Math.PI * Math.ceil((angle - Math.PI) / (2 * Math.PI))
  const delta = a - (sheet.photoRotation ?? 0)
  const c = { x: size.width / 2, y: size.height / 2 }
  const t = (p: Point) => turnPoint(p, c, delta)
  const references = turnReferences(sheet.references, t)
  const { photoRotation: _, ...rest } = sheet
  const next: TargetSheet = {
    ...rest,
    ...(Math.abs(a) > 1e-12 && { photoRotation: a }),
    references,
    // the target origin stays on its photo point (absent: photo point 0, 0)
    targetOrigin: t(sheet.targetOrigin ?? { x: 0, y: 0 }),
    groups: sheet.groups.map((g) =>
      g.detection?.region
        ? { ...g, detection: { ...g.detection, region: g.detection.region.map(t) } }
        : g,
    ),
  }
  const before = frameOf(sheet)
  const after = frameOf(next)
  if (!before || !after) return next
  return mapSheetPoints(next, (q) => ({
    ...q,
    ...viewToTarget(after, t(targetToView(before, q))),
  }))
}

/** `sheet` with group `id` replaced by `f` of it. */
export const withGroup = (
  sheet: TargetSheet,
  id: string,
  f: (g: ShotGroup) => ShotGroup,
): TargetSheet => ({ ...sheet, groups: sheet.groups.map((g) => (g.id === id ? f(g) : g)) })

/** `sheet` without its groups' detection regions: they are points on the photo it had. */
export const withoutRegions = <S extends Pick<TargetSheet, 'groups'>>(sheet: S): S => ({
  ...sheet,
  groups: sheet.groups.map((g) => {
    if (!g.detection?.region) return g
    const { region: _, ...detection } = g.detection
    return { ...g, detection }
  }),
})

/** Group colours in order of creation: the light chart series colours (`--series-*`). */
export const groupColours = ['#eb6834', '#2a78d6', '#19a371', '#c18300', '#e46494', '#008300']

export function newGroup(sheet: TargetSheet, id: string, distance: number): ShotGroup {
  const n = sheet.groups.length + 1
  return {
    id,
    name: `Group ${n}`,
    colour: groupColours[(n - 1) % groupColours.length],
    distance,
    shots: [],
  }
}

/**
 * `q` moved by `step` m in the screen direction (`dx`, `dy`), view y down: a key nudge follows the
 * screen whatever the rotation of the target axes. The view length of `step` along target x near
 * `q` sets the distance, so a perspective photo moves about `step`.
 */
export function screenNudge(f: Frame, q: Point, dx: number, dy: number, step: number): Point {
  const p = targetToView(f, q)
  const e = targetToView(f, { x: q.x + step, y: q.y })
  const len = Math.hypot(e.x - p.x, e.y - p.y)
  return viewToTarget(f, { x: p.x + dx * len, y: p.y + dy * len })
}

/**
 * Mean extreme spread of the groups at each ladder step of `charges` (kg) as an angle (rad), so
 * groups at different distances average fairly; `length` (m) only when every group is at one
 * distance. Steps without a group of two or more shots are left out.
 */
export function ladderExtremeSpreads(groups: ShotGroup[], charges: number[]) {
  const sized = groups.flatMap((g) => {
    const es = g.ladderStep === undefined ? undefined : groupStatisticsOf(g).extremeSpread
    return es === undefined ? [] : [{ step: g.ladderStep, es, distance: g.distance }]
  })
  const one = sized.every((x) => x.distance === sized[0].distance)
  return charges.flatMap((charge, step) => {
    const at = sized.filter((x) => x.step === step)
    const mean = (f: (x: (typeof at)[number]) => number) =>
      at.reduce((a, x) => a + f(x), 0) / at.length
    if (!at.length) return []
    return [
      {
        step,
        charge,
        groups: at.length,
        angle: mean((x) => subtendedAngle(x.es, x.distance)),
        length: one ? mean((x) => x.es) : undefined,
      },
    ]
  })
}

/** Indices (into `shots`) of the two included shots farthest apart; undefined below 2. */
export function extremePairIndices(shots: ShotGroup['shots']): [number, number] | undefined {
  let best: [number, number] | undefined
  let max = -1
  for (let i = 0; i < shots.length; i++)
    for (let j = i + 1; j < shots.length; j++) {
      if (shots[i].excluded || shots[j].excluded) continue
      const d = Math.hypot(shots[i].x - shots[j].x, shots[i].y - shots[j].y)
      if (d > max) [max, best] = [d, [i, j]]
    }
  return best
}

/** Corners of the width and height box of the included shots, target m. */
export function shotExtentCorners(shots: ShotGroup['shots']): Point[] | undefined {
  const inc = shots.filter((s) => !s.excluded)
  if (inc.length < 2) return undefined
  const xs = inc.map((s) => s.x)
  const ys = inc.map((s) => s.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

/** Ellipse coverages drawn, labelled by their coverage (`apps/docs/docs/models/groups.md`, "Dispersion and prediction ellipses"). */
export const coverages = [0.5, 0.95] as const

/** Ellipse `e` about the group centre as `n` points in target m; undefined without either. */
export function ellipsePoints(
  s: GroupStatistics,
  e: Ellipse | undefined,
  n = 72,
): Point[] | undefined {
  if (!e || !s.centre) return undefined
  const c = s.centre
  const [cos, sin] = [Math.cos(e.angle), Math.sin(e.angle)]
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n
    const [u, v] = [e.semiMajor * Math.cos(t), e.semiMinor * Math.sin(t)]
    return { x: c.x + u * cos - v * sin, y: c.y + u * sin + v * cos }
  })
}

/** Ends of the principal axis through the centre, as long as the 95 % dispersion ellipse. */
export function axisEnds(s: GroupStatistics): [Point, Point] | undefined {
  const e = dispersionEllipse(s, coverages[coverages.length - 1])
  if (!e || !s.centre || s.principalAxisAngle === undefined) return undefined
  const [dx, dy] = [e.semiMajor * Math.cos(e.angle), e.semiMajor * Math.sin(e.angle)]
  const c = s.centre
  return [
    { x: c.x - dx, y: c.y - dy },
    { x: c.x + dx, y: c.y + dy },
  ]
}

/**
 * Clicks of an optic that move the group centre onto the point of aim: the offset per axis as the
 * angle atan(offset / distance) (`apps/docs/docs/models/groups.md`, "Angles and pooling") over the click value, rounded,
 * with the dial direction (a group low and right needs up and left).
 */
export function clicksToAim(offset: AimOffset, distance: number, click: number) {
  const count = (d: number) => Math.round(Math.atan(Math.abs(d) / distance) / click)
  return {
    horizontal: { clicks: count(offset.dx), direction: offset.dx > 0 ? 'left' : 'right' },
    vertical: { clicks: count(offset.dy), direction: offset.dy > 0 ? 'down' : 'up' },
  } as const
}

/** The aim offset per axis as angles, rad: atan(offset / distance). */
export const offsetAngles = (o: AimOffset, distance: number) => ({
  x: Math.atan(o.dx / distance),
  y: Math.atan(o.dy / distance),
})

/** Compass words of `AimOffset.compass` for screen readers and hover text. */
export const compassNames: Record<AimOffset['compass'], string> = {
  N: 'high',
  NE: 'high right',
  E: 'right',
  SE: 'low right',
  S: 'low',
  SW: 'low left',
  W: 'left',
  NW: 'high left',
  centre: 'on the point of aim',
}
