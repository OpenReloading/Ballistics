/**
 * Competition events of this browser: a new event from its event type, the totals by the type's
 * scoring (core `ringEventTotals`, `practicalEventTotals`), the CSV and JSON export and the check
 * before Save. A self-recorded score is the person's own record, never an official result.
 */
import {
  type EventTotals,
  eventMismatches,
  practicalEventTotals,
  ringEventTotals,
  type StageScore,
} from '@open-reloading/core'
import {
  type CompetitionEvent,
  competitionEvent,
  type EventType,
  type UserRecord,
} from '@open-reloading/schema'
import { type Message, msg } from '../i18n/translate.ts'
import { toCsv } from './csv.ts'
import { localDay } from './dates.ts'
import { userDataText } from './user-data.ts'

/** A stored competition event. */
export type EventRecord = Extract<UserRecord, { kind: 'event' }>

type Results = CompetitionEvent['results']
type PracticalStage = Extract<Results, { method: 'hit-factor' }>['stages'][number]

/** How an event ended, in words the page translates. */
export const stateLabels: Record<CompetitionEvent['state'], Message> = {
  completed: msg('Completed'),
  'did-not-finish': msg('Did not finish'),
  disqualified: msg('Disqualified'),
}

/**
 * The total of `e` without its event type's rules, for the shooting log: the rings of its series,
 * or the sum of the typed stage points when every stage has them; undefined otherwise.
 */
export function ownTotal(e: CompetitionEvent): number | undefined {
  if (e.results.method === 'rings')
    try {
      return ringEventTotals(e.results.series, e.state).total
    } catch {
      return
    }
  const points = e.results.stages.map((s) => s.stagePoints)
  if (e.state === 'disqualified' || !points.length || points.some((p) => p === undefined)) return
  return points.reduce((sum: number, p) => sum + (p ?? 0), 0)
}

/** Empty results of a scoring method. */
const emptyResults = (method: EventType['scoring']['method']): Results =>
  method === 'rings' ? { method, series: [] } : { method, stages: [] }

/** A new event of `type`: today, its lowest level, completed, no results yet. */
export const blankEvent = (type: EventType, now = new Date()): CompetitionEvent => ({
  date: localDay(now),
  eventType: `catalogue:${type.id}`,
  level: type.levels[0] ?? '',
  state: 'completed',
  results: emptyResults(type.scoring.method),
})

/**
 * `e` moved to `type`: its level where the type names it, else the type's lowest; its division
 * only where the type lists it; its results kept where the scoring method stays, else empty.
 */
export function withEventType(e: CompetitionEvent, type: EventType): CompetitionEvent {
  const { division, ...rest } = e
  const divisions = divisionsOf(type)
  return {
    ...rest,
    eventType: `catalogue:${type.id}`,
    level: type.levels.includes(e.level) ? e.level : (type.levels[0] ?? ''),
    ...(division && divisions.includes(division) && { division }),
    results:
      e.results.method === type.scoring.method ? e.results : emptyResults(type.scoring.method),
  }
}

/** The divisions a hit-factor type lists; none for ring scoring. */
export const divisionsOf = (type: EventType) =>
  type.scoring.method === 'hit-factor' ? type.scoring.powerFactors.map((p) => p.division) : []

/** Whether `division` of `type` has a major rating; true without a division. */
export function majorAllowed(type: EventType, division: string | undefined) {
  if (type.scoring.method !== 'hit-factor' || division === undefined) return true
  return type.scoring.powerFactors.find((p) => p.division === division)?.major !== undefined
}

/** A new stage named `name`: no hits, no penalties, power factor minor, a time to type over. */
export const blankStage = (name: string): PracticalStage => ({
  name,
  hits: { A: 0, C: 0, D: 0 },
  misses: 0,
  noShoots: 0,
  procedurals: 0,
  time: 1,
  powerFactor: 'minor',
})

/** The event type `e` names, from `types`; undefined when the catalogue has no such type. */
export const typeOf = (e: CompetitionEvent, types: readonly EventType[]) =>
  types.find((t) => `catalogue:${t.id}` === e.eventType)

/**
 * The totals of `e` by the scoring of its `type`: per series or stage its total or score, and the
 * event total where one exists. undefined where the type is unknown, the results are of another
 * method, or a value is out of range (the form says which).
 */
export function eventTotals(e: CompetitionEvent, type: EventType | undefined) {
  if (!type || type.scoring.method !== e.results.method) return
  try {
    if (e.results.method === 'rings') return ringEventTotals(e.results.series, e.state)
    if (type.scoring.method === 'hit-factor')
      return practicalEventTotals(e.results.stages, type.scoring, e.state)
  } catch {
    return
  }
}

/** A total as the list and the sheets show it: rings with tenths as typed, points as a whole. */
export const scoreText = (n: number | undefined) =>
  n === undefined ? '' : String(Math.round(n * 100) / 100)

/** A hit factor with four decimals, as the score sheets print it. */
export const hitFactorText = (hf: number) => hf.toFixed(4)

/** The total of a stored event for the list, empty where it has none. */
export const totalText = (e: CompetitionEvent, type: EventType | undefined) =>
  scoreText(eventTotals(e, type)?.total)

/** The events of `records`, by date and then save time, the latest first. */
export const eventRecords = (records: readonly UserRecord[]) =>
  records
    .filter((r): r is EventRecord => r.kind === 'event')
    .sort((a, b) => b.data.date.localeCompare(a.data.date) || b.saved.localeCompare(a.saved))

/** The record name of an event: as typed, else its type and day. */
export const eventName = (typed: string, e: CompetitionEvent, type: EventType | undefined) =>
  (typed.trim() || [type?.name ?? e.eventType.slice(10), e.date].join(' ')).slice(0, 200)

/** `e` without empty optional texts, as it is stored. */
export function cleanEvent(e: CompetitionEvent): CompetitionEvent {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(e)) if (v !== undefined && v !== '') out[k] = v
  return out as unknown as CompetitionEvent
}

/**
 * Why `e` cannot be saved, in words the page translates; undefined when it can. `type` is the
 * event type it names; without it (catalogue unreachable) only the record's own checks run.
 */
export function eventProblem(
  e: CompetitionEvent,
  type: EventType | undefined,
): Message | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return msg('Enter the date.')
  if (
    e.results.method === 'rings' &&
    e.results.series.some((s) => !s.shots?.length && s.total === undefined)
  )
    return msg('Give each series its shots or its total.')
  if (type) {
    const found = eventMismatches(e, type)
    if (found.some((m) => m.problem === 'major'))
      return msg('A stage is scored major in a division without a major rating.')
    if (found.length) return msg('Check the level and division: the event type does not list them.')
  }
  return competitionEvent.safeParse(cleanEvent(e)).success
    ? undefined
    : msg('Check the event: a value is out of its range.')
}

/** The names the CSV and the sheets show for an event's references. */
export interface EventNames {
  type: (e: CompetitionEvent) => string
  firearm: (ref: string | undefined) => string
  load: (ref: string | undefined) => string
}

/** The CSV columns, in order; documented in the competition events guide. */
const eventCsvHeader = [
  'Event',
  'Date',
  'Place',
  'Event type',
  'Level',
  'Division',
  'Firearm',
  'Load',
  'State',
  'Event total',
  'Part',
  'Shots',
  'A',
  'C',
  'D',
  'Metal',
  'Misses',
  'No-shoots',
  'Procedurals',
  'Time (s)',
  'Power factor',
  'Points',
  'Hit factor',
  'Stage points',
] as const

/** The cells of one series or stage, from `Part` on. */
function partCells(e: CompetitionEvent, i: number, totals: EventTotals | undefined) {
  const part = totals?.parts[i]
  if (e.results.method === 'rings') {
    const s = e.results.series[i]
    const total = typeof part === 'number' ? part : s?.total
    const blank = Array<string>(9).fill('')
    return [`Series ${i + 1}`, s?.shots?.join(' ') ?? '', ...blank, scoreText(total), '', '']
  }
  const s = e.results.stages[i]
  if (!s) return []
  const score = part as StageScore | undefined
  return [
    s.name,
    '',
    s.hits.A,
    s.hits.C,
    s.hits.D,
    s.hits.metal ?? '',
    s.misses,
    s.noShoots,
    s.procedurals,
    s.time,
    s.powerFactor,
    score ? scoreText(score.points) : '',
    score ? hitFactorText(score.hitFactor) : '',
    s.stagePoints ?? '',
  ]
}

/** Header and one row per series or stage of each event; an event without results has one row. */
export function eventRows(
  events: readonly EventRecord[],
  types: readonly EventType[],
  names: EventNames,
) {
  const rows: (string | number)[][] = [[...eventCsvHeader]]
  for (const r of events) {
    const e = r.data
    const totals = eventTotals(e, typeOf(e, types))
    const head = [
      r.name,
      e.date,
      e.place ?? '',
      names.type(e),
      e.level,
      e.division ?? '',
      names.firearm(e.firearm),
      names.load(e.load),
      e.state,
      scoreText(totals?.total),
    ]
    const n = e.results.method === 'rings' ? e.results.series.length : e.results.stages.length
    if (n === 0) rows.push([...head, ...Array<string>(14).fill('')])
    for (let i = 0; i < n; i++) rows.push([...head, ...partCells(e, i, totals)])
  }
  return rows
}

/** CSV text of the events, with a byte order mark so spreadsheets read UTF-8. */
export const eventsCsv = (
  events: readonly EventRecord[],
  types: readonly EventType[],
  names: EventNames,
) => `﻿${toCsv(eventRows(events, types, names))}\n`

/** A user data file of the events, which Import JSON and the File menu read back. */
export const eventsJson = (events: readonly EventRecord[]) => userDataText([...events])

/** The file name of an export: `openreloading-events-<day>.<ext>`. */
export const eventsFileName = (ext: 'csv' | 'json', now = new Date()) =>
  `openreloading-events-${localDay(now)}.${ext}`

/** The ring values typed in one field ("10 9 10.5" or "10;9"), undefined while one is no number. */
export function parseShots(text: string): number[] | undefined {
  const parts = text.split(/[\s;]+/).filter(Boolean)
  const values = parts.map((p) => Number(p.replace(',', '.')))
  return values.every(Number.isFinite) ? values : undefined
}
