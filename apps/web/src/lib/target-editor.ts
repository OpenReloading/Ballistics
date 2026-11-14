/** SI in and out (m, rad); no React, DOM or Next.js. */
import {
  type CalibrationReference,
  type ShotGroup,
  type TargetSheet,
  toSi,
} from '@rangefoundry/schema'
import {
  type AimOffset,
  dispersionEllipse,
  type GroupEllipse,
  type GroupStatistics,
  subtendedAngle,
} from '@rangefoundry/shot-groups'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { nth } from './nth.ts'
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

/** Shots wait for a valid reference on a photo. */
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

/** Every mark stays on its photo point (`keepOnPhoto`); unchanged without a calibration on either side. */
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

/** `angle` in rad, counter-clockwise on screen; target axes stay on the screen and every mark stays on its hole. */
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

/** Group colors in order of creation: the light chart series colors (`--series-*`). */
export const groupColours = ['#2a78d6', '#eb6834', '#19a371', '#c18300', '#e46494', '#7c4dcc']

export function newGroup(
  sheet: TargetSheet,
  id: string,
  distance: number,
  t: Translator['t'],
): ShotGroup {
  const n = sheet.groups.length + 1
  return {
    id,
    name: t('Group {n}', { n }),
    colour: nth(groupColours, (n - 1) % groupColours.length),
    distance,
    shots: [],
  }
}

/** `step` m in the screen direction (`dx`, `dy`, view y down) whatever the axes' rotation; the view length near `q` keeps it about `step` on a perspective photo. */
export function screenNudge(f: Frame, q: Point, dx: number, dy: number, step: number): Point {
  const p = targetToView(f, q)
  const e = targetToView(f, { x: q.x + step, y: q.y })
  const len = Math.hypot(e.x - p.x, e.y - p.y)
  return viewToTarget(f, { x: p.x + dx * len, y: p.y + dy * len })
}

/** `charges` in kg; as an angle (rad) so groups at different distances average fairly; `length` (m) only at one distance. */
export function ladderExtremeSpreads(groups: ShotGroup[], charges: number[]) {
  const sized = groups.flatMap((g) => {
    const es = g.ladderStep === undefined ? undefined : groupStatisticsOf(g).extremeSpread
    return es === undefined ? [] : [{ step: g.ladderStep, es, distance: g.distance }]
  })
  const [first] = sized
  const one = sized.every((x) => x.distance === first?.distance)
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
  for (const [i, a] of shots.entries())
    for (const [j, b] of shots.entries()) {
      if (j <= i || a.excluded || b.excluded) continue
      const d = Math.hypot(a.x - b.x, a.y - b.y)
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

/** Ellipse coverages drawn, labeled by their coverage (`apps/docs/docs/models/groups.md`, "Dispersion and prediction ellipses"). */
export const coverages = [0.5, 0.95] as const

/** Ellipse `e` about the group center as `n` points in target m; undefined without either. */
export function ellipsePoints(
  s: GroupStatistics,
  e: GroupEllipse | undefined,
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

/** Ends of the principal axis through the center, as long as the 95 % dispersion ellipse. */
export function axisEnds(s: GroupStatistics): [Point, Point] | undefined {
  const e = dispersionEllipse(s, nth(coverages, coverages.length - 1))
  if (!e || !s.centre || s.principalAxisAngle === undefined) return undefined
  const [dx, dy] = [e.semiMajor * Math.cos(e.angle), e.semiMajor * Math.sin(e.angle)]
  const c = s.centre
  return [
    { x: c.x - dx, y: c.y - dy },
    { x: c.x + dx, y: c.y + dy },
  ]
}

/** Offset as atan(offset / distance) over the click value (`apps/docs/docs/models/groups.md`, "Angles and pooling"); low right needs up left. */
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
export const compassNames: Record<AimOffset['compass'], Message> = {
  N: msg('high'),
  NE: msg('high right'),
  E: msg('right'),
  SE: msg('low right'),
  S: msg('low'),
  SW: msg('low left'),
  W: msg('left'),
  NW: msg('high left'),
  centre: msg('on the point of aim'),
}

/** The known sizes the scale references take, m. */
export type KnownSize = {
  length?: number | undefined
  width?: number | undefined
  height?: number | undefined
}

/** The scale reference of `kind` through the clicked `points` and the known size; none while one is missing. */
export function referenceOf(
  kind: CalibrationReference['kind'],
  known: KnownSize,
  points: Point[],
): CalibrationReference | undefined {
  if (kind === 'rectangle') return rectangleOf(known, points)
  const len = known.length
  const [p0, p1, p2] = points
  if (!len || !p0 || !p1) return
  if (kind === 'line') return { kind: 'line', a: p0, b: p1, length: len }
  if (kind === 'ringCentre') return { kind: 'ringCentre', centre: p0, edge: p1, diameter: len }
  if (kind === 'ringEdge' && p2) return { kind: 'ringEdge', points: [p0, p1, p2], diameter: len }
}

function rectangleOf(known: KnownSize, points: Point[]): CalibrationReference | undefined {
  const [p0, p1, p2, p3] = points
  if (!known.width || !known.height || !p0 || !p1 || !p2 || !p3) return
  return { kind: 'rectangle', corners: [p0, p1, p2, p3], width: known.width, height: known.height }
}
