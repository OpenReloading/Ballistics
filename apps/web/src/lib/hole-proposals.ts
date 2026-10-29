/**
 * Hole proposals in the target editor (`apps/docs/docs/models/hole-detection.md`): kept apart from
 * the sheet, in photo px, until the user accepts them as shots. No React, DOM or Next.js.
 */
import { type ShotGroup, toSi } from '@open-reloading/schema'
import type { HoleProposal } from './hole-detection.ts'
import { nth } from './nth.ts'
import { type Frame, targetToView, viewToTarget } from './target-editor.ts'
import type { Point } from './target-geometry.ts'

/** `HoleProposal` with an editor-assigned `id`, in photo px, not yet accepted as a shot. */
export type EditorProposal = HoleProposal & { id: number }

/**
 * Confidence tier (a starting value): a proposal below it is a maybe, shown on the photo but left
 * out of Accept all and the proposal count.
 */
const MAYBE_BELOW = 0.5

/** True for a proposal below the confidence tier. */
export const isMaybe = (p: Pick<HoleProposal, 'confidence'>): boolean => p.confidence < MAYBE_BELOW

/** Confirmed holes needed before their sizes set the expected hole size. */
export const MIN_HOLES_TO_LEARN_SIZE = 3

type HoleSize = { diameter: number; source: 'typed' | 'learned' | 'bullet' | 'marker' }

/** True for a size a bullet or a marker gives: a nominal diameter, not a hole in paper. */
export const isNominal = (size: { source: string } | undefined): boolean =>
  size?.source === 'bullet' || size?.source === 'marker'

/**
 * Expected hole diameter, m (own rule, `apps/docs/docs/models/hole-detection.md`, "Hole size"): the size the user typed;
 * else the median of the measured holes of confirmed shots once there are `MIN_HOLES_TO_LEARN_SIZE` of them; else
 * the bullet diameter; else the marker diameter; else none.
 */
export function expectedHoleSize(o: {
  typedDiameter?: number | undefined
  confirmedDiameters: readonly number[]
  bulletDiameter?: number | undefined
  markerDiameter?: number | undefined
}): HoleSize | undefined {
  if (o.typedDiameter) return { diameter: o.typedDiameter, source: 'typed' }
  if (o.confirmedDiameters.length >= MIN_HOLES_TO_LEARN_SIZE) {
    const h = [...o.confirmedDiameters].sort((a, b) => a - b)
    const m = h.length >> 1
    return {
      diameter: h.length % 2 ? nth(h, m) : (nth(h, m - 1) + nth(h, m)) / 2,
      source: 'learned',
    }
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
  const mm = toSi('length', 1)
  const ex = targetToView(frame, { x: q.x + mm, y: q.y })
  const ey = targetToView(frame, { x: q.x, y: q.y + mm })
  return (Math.hypot(ex.x - o.x, ex.y - o.y) + Math.hypot(ey.x - o.x, ey.y - o.y)) / 2 / mm
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
