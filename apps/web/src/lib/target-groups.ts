import type { ShotGroup } from '@rangefoundry/schema'
import { type GroupInput, type GroupStatistics, groupStatistics } from '@rangefoundry/shot-groups'

/** A saved group (SI, as stored) as statistics input. */
export function groupStatisticsInput(group: ShotGroup): GroupInput {
  return {
    shots: group.shots.map((s) => ({ x: s.x, y: s.y, excluded: s.excluded ?? false })),
    distance: group.distance,
    ...(group.aim ? { aim: { x: group.aim.x, y: group.aim.y } } : {}),
  }
}

const statsCache = new WeakMap<ShotGroup, GroupStatistics>()

/** An edit makes a new group object, so a render that changes no group computes nothing. */
export function groupStatisticsOf(g: ShotGroup): GroupStatistics {
  const cached = statsCache.get(g)
  if (cached) return cached
  const s = groupStatistics(groupStatisticsInput(g))
  statsCache.set(g, s)
  return s
}
