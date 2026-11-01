/**
 * Scoring of a person's own competition results: the stage points and hit factor of a practical
 * stage and the ring totals of series, with the points and penalties of the event type record
 * (`packages/data/records/event-types/`), never hard-coded. Model:
 * `apps/docs/docs/models/competition-scoring.md`. A self-recorded score is never an official result.
 */

import { InputError } from '../errors.ts'

/** Points of one hit per zone for one power factor. */
export interface ZonePoints {
  A: number
  C: number
  D: number
  metal: number
}

/** The hit-factor rules of an event type: points per power factor and zone, penalty values. */
export interface HitFactorRules {
  points: { major: ZonePoints; minor: ZonePoints }
  penalties: { miss: number; noShoot: number; procedural: number }
}

/** A practical stage as the person recorded it. */
export interface PracticalStage {
  /** Scoring hits per zone; `metal`: scoring metal targets hit. */
  hits: { A: number; C: number; D: number; metal?: number | undefined }
  misses: number
  noShoots: number
  procedurals: number
  /** Stage time, s. */
  time: number
  powerFactor: 'major' | 'minor'
  /** Stage points of the official result, where the person typed them. */
  stagePoints?: number | undefined
}

/** The score of one practical stage. */
export interface StageScore {
  /** Points of the hits less the penalties, at least 0. */
  points: number
  /** Points over time, 1/s. */
  hitFactor: number
  /** The typed stage points of the official result; undefined when not typed. */
  stagePoints?: number | undefined
}

const count = (n: number) => {
  if (!Number.isInteger(n) || n < 0)
    throw new InputError('a hit, miss or penalty count must be a whole number of 0 or more')
  return n
}

/**
 * The points of a stage: each hit at its zone's value for the stage's power factor, less each
 * miss, penalized no-shoot hit and procedural penalty at its value, and never below zero.
 */
export function stageRawPoints(stage: PracticalStage, rules: HitFactorRules): number {
  const z = rules.points[stage.powerFactor]
  const { hits } = stage
  const scored =
    count(hits.A) * z.A +
    count(hits.C) * z.C +
    count(hits.D) * z.D +
    count(hits.metal ?? 0) * z.metal
  const penalties =
    count(stage.misses) * rules.penalties.miss +
    count(stage.noShoots) * rules.penalties.noShoot +
    count(stage.procedurals) * rules.penalties.procedural
  return Math.max(0, scored - penalties)
}

/** Points over time: the hit factor, 1/s. The time must be positive. */
export function hitFactor(points: number, time: number): number {
  if (!(time > 0) || !Number.isFinite(time)) throw new InputError('the stage time must be positive')
  return points / time
}

/** The points and hit factor of a stage, with the typed stage points of the official result. */
export function stagePoints(stage: PracticalStage, rules: HitFactorRules): StageScore {
  const typed = stage.stagePoints
  if (typed !== undefined && (!(typed >= 0) || !Number.isFinite(typed)))
    throw new InputError('stage points must be 0 or more')
  const points = stageRawPoints(stage, rules)
  return {
    points,
    hitFactor: hitFactor(points, stage.time),
    ...(stage.stagePoints !== undefined && { stagePoints: stage.stagePoints }),
  }
}

/** A ring series: the ring value of each shot, or only the series total. */
export interface RingSeries {
  shots?: readonly number[] | undefined
  total?: number | undefined
}

/** The total of a series: the sum of its shots where they are recorded, else its typed total. */
export function ringTotal(series: RingSeries): number {
  if (series.shots?.length) {
    for (const s of series.shots)
      if (!(s >= 0) || !Number.isFinite(s)) throw new InputError('a ring value must be 0 or more')
    // sum in tenths, so 10.4 + 10.2 is 20.6 and not 20.599999
    return series.shots.reduce((sum, s) => sum + Math.round(s * 10), 0) / 10
  }
  if (series.total === undefined) throw new InputError('a series needs its shots or its total')
  if (!(series.total >= 0) || !Number.isFinite(series.total))
    throw new InputError('a ring value must be 0 or more')
  return series.total
}

/** How an event ended: completed, did not finish, or disqualified. */
export type ResultState = 'completed' | 'did-not-finish' | 'disqualified'

/** The totals of an event; `total` is undefined for a disqualified event or untyped stage points. */
export interface EventTotals {
  total?: number | undefined
  /** Per series its total (ring events) or per stage its score (practical events). */
  parts: readonly number[] | readonly StageScore[]
}

/**
 * The totals of a ring event: each series and their sum. A disqualified event, or one without
 * series, has no total.
 */
export function ringEventTotals(series: readonly RingSeries[], state: ResultState): EventTotals {
  const parts = series.map(ringTotal)
  if (state === 'disqualified' || parts.length === 0) return { parts }
  return { total: parts.reduce((sum, p) => sum + Math.round(p * 10), 0) / 10, parts }
}

/**
 * The totals of a practical event: the score of each stage, and the sum of the typed stage points
 * when every stage has them (stage points need the best hit factor of all competitors, so only the
 * official result gives them). A disqualified event has no total.
 */
export function practicalEventTotals(
  stages: readonly PracticalStage[],
  rules: HitFactorRules,
  state: ResultState,
): EventTotals {
  const parts = stages.map((s) => stagePoints(s, rules))
  const typed = parts.every((p) => p.stagePoints !== undefined)
  if (state === 'disqualified' || !typed || parts.length === 0) return { parts }
  return { total: parts.reduce((sum, p) => sum + (p.stagePoints ?? 0), 0), parts }
}

/** What an event type offers an event: its levels, scoring method and, for hit factor, its divisions. */
export interface EventTypeOffer {
  levels: readonly string[]
  scoring:
    | { method: 'rings' }
    | {
        method: 'hit-factor'
        powerFactors: readonly { division: string; major?: number | undefined }[]
      }
}

/** What an event records that its type has to know. */
export interface EventClaims {
  level: string
  division?: string | undefined
  results:
    | { method: 'rings' }
    | { method: 'hit-factor'; stages: readonly Pick<PracticalStage, 'powerFactor'>[] }
}

/** A way an event does not fit its type. */
export type EventMismatch =
  | { problem: 'level'; level: string }
  | { problem: 'method'; method: string }
  | { problem: 'division'; division: string }
  | { problem: 'major'; division: string; stage: number }

/**
 * Where an event does not fit its event type: a level the type does not name, results of another
 * scoring method, a division the type does not name, or a stage scored major in a division without
 * a major rating. Empty when it fits. The scoring above trusts these; a caller checks first.
 */
export function eventMismatches(event: EventClaims, type: EventTypeOffer): EventMismatch[] {
  const found: EventMismatch[] = []
  if (!type.levels.includes(event.level)) found.push({ problem: 'level', level: event.level })
  if (event.results.method !== type.scoring.method)
    return [...found, { problem: 'method', method: event.results.method }]
  if (type.scoring.method !== 'hit-factor' || event.results.method !== 'hit-factor') return found
  if (event.division === undefined) return found
  const floor = type.scoring.powerFactors.find((p) => p.division === event.division)
  if (!floor) return [...found, { problem: 'division', division: event.division }]
  event.results.stages.forEach((s, stage) => {
    if (s.powerFactor === 'major' && floor.major === undefined && event.division)
      found.push({ problem: 'major', division: event.division, stage })
  })
  return found
}
