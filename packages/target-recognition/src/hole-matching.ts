import type { Point } from '@rangefoundry/shot-groups'
import { percentile } from '@rangefoundry/statistics'

/** Marks against reference holes: `matched` pairs, `false` marks without a hole, `missed` holes without a mark. */
export type HoleMatch = { matched: number; false: number; missed: number }

/** Pairs marks with reference holes one to one, nearest pairs first, when they lie within half of `diameter` (px). */
export function matchHoles(
  marks: readonly Point[],
  holes: readonly Point[],
  diameter: number,
): HoleMatch {
  const pairs = holes
    .flatMap((h, i) => marks.map((m, j) => ({ i, j, d: Math.hypot(m.x - h.x, m.y - h.y) })))
    .filter((q) => q.d <= diameter / 2)
    .toSorted((a, b) => a.d - b.d)
  const [paired, used] = [new Set<number>(), new Set<number>()]
  for (const q of pairs) {
    if (paired.has(q.i) || used.has(q.j)) continue
    paired.add(q.i)
    used.add(q.j)
  }
  return {
    matched: paired.size,
    false: marks.length - paired.size,
    missed: holes.length - paired.size,
  }
}

/** The adds, moves and deletes that turn the marks into the holes; a false mark paired with a missed hole is one move. */
export const corrections = (m: HoleMatch): number => Math.max(m.false, m.missed)

/** Corrections over the usable photos of a set; `p90` only from 20 photos on. */
export type CorrectionStats = { photos: number; median: number; p90?: number; max: number }

/** Median, 90th percentile and maximum of the corrections per usable photo. */
export function correctionStats(perPhoto: readonly number[]): CorrectionStats {
  const sorted = perPhoto.toSorted((a, b) => a - b)
  return {
    photos: sorted.length,
    median: percentile(sorted, 0.5),
    ...(sorted.length >= 20 && { p90: percentile(sorted, 0.9) }),
    max: percentile(sorted, 1),
  }
}
