import { type ImpactStep, ladderImpactResiduals } from '@open-reloading/core'
import { type SessionRecord, type ShotGroup, toSi } from '@open-reloading/schema'
import { sessionRef } from './measurements.ts'

/** Level of the test across charges. */
const level = 0.99

/** Groups a charge needs to enter the note. */
export const minGroups = 3
/** Shots with a velocity a group needs to enter the note. */
export const minShots = 5

/** One charge of the note: the residual centre, its standard error and the shots behind it, m. */
interface ImpactPoint {
  charge: number
  centre: number
  standardError: number
  groups: number
  shots: number
}

/** Why there is no note: too little linked data, groups at different distances, or no drop slope. */
type ImpactMissing = 'data' | 'distance' | 'slope'

export type LadderImpact =
  | { status: 'none' }
  | { status: ImpactMissing }
  | { status: 'ready'; points: ImpactPoint[]; varies: boolean; level: number }

/** Velocity of a linked shot, m/s; none when the session is not at hand or the shot is excluded. */
function velocityOf(
  chrono: NonNullable<ShotGroup['shots'][number]['chrono']>,
  sessions: readonly SessionRecord[],
) {
  const session = sessions.find((s) => sessionRef(s.id) === chrono.session)
  const shot = session?.data.strings[chrono.string]?.shots[chrono.shot]
  return shot && !shot.excluded ? toSi('velocity', shot.velocity.value) : undefined
}

/**
 * Heights above the point of aim and velocities of the shots of a group that the note can use:
 * included shots with a linked velocity. Empty without a point of aim or below `minShots` shots.
 */
function usableShots(group: ShotGroup, sessions: readonly SessionRecord[]) {
  const aim = group.aim
  const shots = aim
    ? group.shots.flatMap((s) => {
        const velocity = s.chrono && !s.excluded ? velocityOf(s.chrono, sessions) : undefined
        return velocity === undefined ? [] : [{ height: s.y - aim.y, velocity }]
      })
    : []
  return shots.length >= minShots ? shots : []
}

/**
 * The note for a ladder: the groups of every ladder step (`groups`, all sheets of the load) with
 * `minGroups` groups of `minShots` shots that have a velocity and an aim point, at three or more
 * charges and one distance. `slopeAt` gives the drop slope at that distance, m per m/s.
 * `none` when no group has a velocity linked, so nothing shows before the link is made.
 */
export function ladderImpact(
  groups: readonly ShotGroup[],
  charges: readonly number[],
  sessions: readonly SessionRecord[],
  slopeAt: (distance: number) => number | undefined,
): LadderImpact {
  const ladder = groups.filter((g) => g.ladderStep !== undefined && g.ladderStep < charges.length)
  if (!ladder.some((g) => g.shots.some((s) => s.chrono))) return { status: 'none' }
  const steps = charges.flatMap((charge, step) => {
    const usable = ladder
      .filter((g) => g.ladderStep === step)
      .map((g) => usableShots(g, sessions))
      .filter((s) => s.length > 0)
    if (usable.length < minGroups) return []
    const shots = usable.flat()
    return [
      {
        charge,
        groups: usable.length,
        heights: shots.map((s) => s.height),
        velocities: shots.map((s) => s.velocity),
      },
    ]
  })
  if (steps.length < 3) return { status: 'data' }
  const [first] = ladder
  if (!first || ladder.some((g) => Math.abs(g.distance - first.distance) > 1e-9 * first.distance))
    return { status: 'distance' }
  const slope = slopeAt(first.distance)
  if (slope === undefined) return { status: 'slope' }
  const impact = ladderImpactResiduals(
    steps.map(
      (s): ImpactStep => ({ charge: s.charge, heights: s.heights, velocities: s.velocities }),
    ),
    slope,
    level,
  )
  return {
    status: 'ready',
    varies: impact.varies,
    level,
    points: impact.steps.map((s) => ({
      charge: s.charge,
      centre: s.mean,
      standardError: s.standardDeviation / Math.sqrt(s.count),
      groups: steps.find((x) => x.charge === s.charge)?.groups ?? 0,
      shots: s.count,
    })),
  }
}
