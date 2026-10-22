/**
 * Hole proposals in the target editor (`apps/docs/docs/models/hole-detection.md`): kept apart from
 * the sheet, in photo px, until the user accepts them as shots. No React, DOM or Next.js.
 */
import type { ShotGroup } from '@openreloading/schema'
import type { HoleProposal } from './hole-detection.ts'
import { type Frame, targetToView, viewToTarget } from './target-editor.ts'
import type { Point } from './target-geometry.ts'

/** `HoleProposal` with an editor-assigned `id`, in photo px, not yet accepted as a shot. */
export type EditorProposal = HoleProposal & { id: number }

/** Confirmed holes needed before their sizes set the expected hole size. */
export const MIN_HOLES_TO_LEARN_SIZE = 3

type HoleSize = { diameter: number; source: 'typed' | 'learned' | 'bullet' | 'marker' }

/**
 * Expected hole diameter, m (own rule, `apps/docs/docs/models/hole-detection.md`, "Hole size"): the size the user typed;
 * else the median of the measured holes of confirmed shots once there are `MIN_HOLES_TO_LEARN_SIZE` of them; else
 * the bullet diameter; else the marker diameter; else none.
 */
export function expectedHoleSize(o: {
  typedDiameter?: number
  confirmedDiameters: readonly number[]
  bulletDiameter?: number
  markerDiameter?: number
}): HoleSize | undefined {
  if (o.typedDiameter) return { diameter: o.typedDiameter, source: 'typed' }
  if (o.confirmedDiameters.length >= MIN_HOLES_TO_LEARN_SIZE) {
    const h = [...o.confirmedDiameters].sort((a, b) => a - b)
    const m = h.length >> 1
    return { diameter: h.length % 2 ? h[m] : (h[m - 1] + h[m]) / 2, source: 'learned' }
  }
  if (o.bulletDiameter) return { diameter: o.bulletDiameter, source: 'bullet' }
  if (o.markerDiameter) return { diameter: o.markerDiameter, source: 'marker' }
  return undefined
}

/** Corners of the rectangle with opposite corners `a` and `b`, clockwise from top left (y down). */
export function rectangleFromDiagonal(a: Point, b: Point): Point[] {
  const [x0, x1, y0, y1] = [
    Math.min(a.x, b.x),
    Math.max(a.x, b.x),
    Math.min(a.y, b.y),
    Math.max(a.y, b.y),
  ]
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

/**
 * Photo px per m near the middle of `region`: the mean photo length of 1 mm along target x and y
 * there, so a perspective calibration gives the local scale.
 */
export function localPxPerM(frame: Frame, region: readonly Point[]): number {
  const xs = region.map((p) => p.x)
  const ys = region.map((p) => p.y)
  const c = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
  const q = viewToTarget(frame, c)
  const o = targetToView(frame, q)
  const ex = targetToView(frame, { x: q.x + 1e-3, y: q.y })
  const ey = targetToView(frame, { x: q.x, y: q.y + 1e-3 })
  return ((Math.hypot(ex.x - o.x, ex.y - o.y) + Math.hypot(ey.x - o.x, ey.y - o.y)) / 2) * 1000
}

/** `list` without the proposals closer than half a hole (`holePx`) to a shot of `group`. */
export function proposalsClearOfShots(
  list: EditorProposal[],
  group: ShotGroup,
  frame: Frame,
  holePx: number,
): EditorProposal[] {
  const shots = group.shots.map((s) => targetToView(frame, s))
  return list.filter((p) => shots.every((s) => Math.hypot(s.x - p.x, s.y - p.y) >= holePx / 2))
}

/**
 * `group` with `list` added as shots of placement `detected`, up to 1000 shots; a single hole keeps
 * its measured diameter (`pxPerM` near it) for the learned hole size.
 */
export function acceptProposals(
  group: ShotGroup,
  list: EditorProposal[],
  frame: Frame,
  pxPerM: number,
): { group: ShotGroup; added: number } {
  const room = Math.max(0, 1000 - group.shots.length)
  const shots = list.slice(0, room).map((p) => {
    const q = viewToTarget(frame, p)
    return {
      x: q.x,
      y: q.y,
      placement: 'detected' as const,
      ...(p.clusterSize === 1 && { holeDiameter: p.diameter / pxPerM }),
    }
  })
  return { group: { ...group, shots: [...group.shots, ...shots] }, added: shots.length }
}

/** Measured hole diameters of the shots of `group`, m. */
export const confirmedHoleDiameters = (group: ShotGroup): number[] =>
  group.shots.flatMap((s) => (s.holeDiameter === undefined ? [] : [s.holeDiameter]))
