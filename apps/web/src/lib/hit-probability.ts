import type { ScoringZone, TrajectoryPoint } from '@open-reloading/core'
import { type TargetFace, toSi } from '@open-reloading/schema'
import { nth } from './nth.ts'

/**
 * The scoring zones of a face for a hole of diameter `hole` m, outermost first: each ring grown by
 * the hole's radius, as `scoreShot` counts a touched ring. An oval ring keeps its height.
 */
export function faceZones(face: TargetFace, hole: number): ScoringZone[] {
  const g = hole / 2
  return face.rings.map((r) => ({
    halfWidth: toSi('length', r.diameter.value / 2) + g,
    halfHeight: toSi('length', (r.height ?? r.diameter).value / 2) + g,
    value: r.value,
  }))
}

/** What the trajectory says about the point of impact at one table range. */
export interface ImpactSensitivity {
  /** Lateral displacement per 1 m/s of crosswind, m. */
  perCrosswind: number
  /** Change of the height of impact per metre of range, m/m. */
  verticalPerMetre: number
}

/**
 * The sensitivities at `points[i]`: the windage hold per 1 m/s of crosswind (`windHold`, rad, one
 * per point) times the range, and the slope of the height over the neighbouring table points.
 * Undefined with fewer than two points.
 */
export function impactSensitivity(
  points: readonly TrajectoryPoint[],
  windHold: readonly number[],
  i: number,
): ImpactSensitivity | undefined {
  const at = points[i]
  if (points.length < 2 || !at) return undefined
  const a = nth(points, Math.max(0, i - 1))
  const b = nth(points, Math.min(points.length - 1, i + 1))
  return {
    perCrosswind: (windHold[i] ?? 0) * at.range,
    verticalPerMetre: (b.height - a.height) / (b.range - a.range),
  }
}
