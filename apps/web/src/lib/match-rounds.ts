/** The rounds a match of one discipline takes, from the shot counts and sighters of its stages. */
import type { DisciplineRules, TargetMapping } from '@open-reloading/schema'

/** What a discipline's records give per event: shots and sighters summed over its stages. */
export interface MatchCourse {
  /** Shots for score; absent where a stage states no shot count. */
  shots?: number | undefined
  /** Sighters of the stages that state a number. */
  sighters: number
  /** Where a stage states no number of sighters: `unlimited` (any number) before `not-stated`. */
  openSighters?: 'unlimited' | 'not-stated' | undefined
}

/**
 * Shots and sighters per event. Mappings of one `stage` (or several without one, the whole
 * discipline) are alternative faces and count once; a stage's own sighters replace the
 * discipline's.
 */
export function matchCourse(
  mappings: readonly Pick<TargetMapping, 'stage' | 'shotCount' | 'sighters'>[],
  rules: Pick<DisciplineRules, 'sighters'> | undefined,
): MatchCourse {
  const byStage = new Map<string | undefined, (typeof mappings)[number][]>()
  for (const m of mappings) byStage.set(m.stage, [...(byStage.get(m.stage) ?? []), m])
  const stages = [...byStage.values()]
  let shots: number | undefined = 0
  let sighters = 0
  let unlimited = false
  let notStated = false
  for (const faces of stages) {
    const count = faces.find((m) => m.shotCount !== undefined)?.shotCount
    shots = count === undefined || shots === undefined ? undefined : shots + count
    const given = faces.find((m) => m.sighters !== undefined)?.sighters ?? rules?.sighters
    if (given === 'unlimited') unlimited = true
    else if (given === undefined) notStated = true
    else sighters += given
  }
  return {
    shots: stages.length > 0 ? shots : undefined,
    sighters,
    openSighters: unlimited ? 'unlimited' : notStated ? 'not-stated' : undefined,
  }
}

/** The fields of the panel, each `undefined` while empty. */
interface MatchInput {
  shots: number | undefined
  sighters: number | undefined
  events: number | undefined
  /** Percent added on shots plus sighters. */
  reserve: number | undefined
  onHand: number | undefined
}

/** Rounds needed and, with rounds on hand typed, on hand minus needed (negative: short). */
export interface MatchRounds {
  needed: number
  difference?: number | undefined
}

/**
 * ceil((shots + sighters) x events x (1 + reserve / 100)), and the difference with the rounds on
 * hand. No result while a field it needs is empty, negative or events is 0.
 */
export function matchRounds(input: MatchInput): MatchRounds | undefined {
  const { shots, sighters, events, reserve, onHand } = input
  if (shots === undefined || sighters === undefined || events === undefined) return undefined
  if (reserve === undefined || shots < 0 || sighters < 0 || reserve < 0 || events <= 0)
    return undefined
  if (shots + sighters === 0) return undefined
  // toPrecision drops the float noise that would round 66.00000000000001 up to 67
  const needed = Math.ceil(
    Number((((shots + sighters) * events * (100 + reserve)) / 100).toPrecision(12)),
  )
  return onHand === undefined || onHand < 0 ? { needed } : { needed, difference: onHand - needed }
}
