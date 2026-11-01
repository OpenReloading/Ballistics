import type { CompetitionEvent, EventType } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  blankEvent,
  blankStage,
  type EventRecord,
  eventProblem,
  eventRows,
  eventsJson,
  eventTotals,
  parseShots,
  totalText,
  withEventType,
} from '../src/lib/competition-events.ts'
import { parseUserDataFile } from '../src/lib/user-data.ts'

const ruleBook = {
  title: 'Rules',
  edition: '2026',
  publisher: 'Test',
  url: 'https://example.org/rules.pdf',
  sha256: 'a'.repeat(64),
}
const provenance = { kind: 'published', sources: [{ title: 'Rules' }] } as EventType['provenance']
const ipsc: EventType = {
  id: 'ipsc-handgun',
  name: 'IPSC Handgun',
  federation: 'ipsc',
  ruleBook,
  scoring: {
    method: 'hit-factor',
    points: {
      major: { A: 5, C: 4, D: 2, metal: 5 },
      minor: { A: 5, C: 3, D: 1, metal: 5 },
    },
    penalties: { miss: 10, noShoot: 10, procedural: 10 },
    powerFactors: [
      { division: 'Standard', minor: 125, major: 170 },
      { division: 'Production', minor: 125 },
    ],
  },
  levels: ['Level I', 'Level II'],
  provenance,
}
const dsb: EventType = {
  id: 'dsb-meisterschaft',
  name: 'DSB-Meisterschaft',
  federation: 'dsb',
  ruleBook,
  scoring: { method: 'rings' },
  levels: ['Kreismeisterschaft', 'Landesmeisterschaft'],
  provenance,
}
const types = [ipsc, dsb]
const day = new Date(2026, 5, 14)

const stage = (name: string, A: number, C: number, time: number, stagePoints?: number) => ({
  ...blankStage(name),
  hits: { A, C, D: 0 },
  time,
  ...(stagePoints !== undefined && { stagePoints }),
})

const ringEvent: CompetitionEvent = {
  ...blankEvent(dsb, day),
  level: 'Landesmeisterschaft',
  results: { method: 'rings', series: [{ shots: [10, 9, 10.5] }, { total: 95 }] },
}
const ipscEvent: CompetitionEvent = {
  ...blankEvent(ipsc, day),
  division: 'Standard',
  results: {
    method: 'hit-factor',
    stages: [stage('Stage 1', 10, 2, 12.5, 100), stage('Stage 2', 8, 0, 10, 80.5)],
  },
}
const record = (id: string, name: string, data: CompetitionEvent): EventRecord => ({
  kind: 'event',
  id,
  name,
  saved: '2026-06-14T10:00:00.000Z',
  data,
})

describe('a new event', () => {
  it('starts today at the lowest level with the results of its scoring method', () => {
    expect(blankEvent(dsb, day)).toEqual({
      date: '2026-06-14',
      eventType: 'catalogue:dsb-meisterschaft',
      level: 'Kreismeisterschaft',
      state: 'completed',
      results: { method: 'rings', series: [] },
    })
    expect(blankEvent(ipsc, day).results).toEqual({ method: 'hit-factor', stages: [] })
  })

  it('takes the level, division and results along only where the new type fits them', () => {
    const moved = withEventType(ipscEvent, dsb)
    expect(moved).toMatchObject({
      eventType: 'catalogue:dsb-meisterschaft',
      level: 'Kreismeisterschaft',
    })
    expect(moved.division).toBeUndefined()
    expect(moved.results).toEqual({ method: 'rings', series: [] })
    expect(withEventType(ipscEvent, ipsc)).toEqual(ipscEvent)
  })
})

describe('totals', () => {
  it('sums the ring series, from the shots or the typed total', () => {
    expect(eventTotals(ringEvent, dsb)).toEqual({ total: 124.5, parts: [29.5, 95] })
    expect(totalText(ringEvent, dsb)).toBe('124.5')
  })

  it('scores each stage and sums the typed stage points', () => {
    const totals = eventTotals(ipscEvent, ipsc)
    // Stage 1: 10 A (5) + 2 C (3, minor) = 56 points in 12.5 s
    expect(totals?.parts[0]).toEqual({ points: 56, hitFactor: 4.48, stagePoints: 100 })
    expect(totals?.total).toBe(180.5)
  })

  it('has no total for a disqualified event, an unknown type or results of another method', () => {
    expect(eventTotals({ ...ringEvent, state: 'disqualified' }, dsb)?.total).toBeUndefined()
    expect(eventTotals(ringEvent, undefined)).toBeUndefined()
    expect(eventTotals(ringEvent, ipsc)).toBeUndefined()
  })
})

describe('the check before Save', () => {
  it('passes a complete event', () => {
    expect(eventProblem(ringEvent, dsb)).toBeUndefined()
    expect(eventProblem(ipscEvent, ipsc)).toBeUndefined()
  })

  it('names a series without shots or total, a level or division the type lacks and a major stage without a major rating', () => {
    const empty = { ...ringEvent, results: { method: 'rings' as const, series: [{}] } }
    expect(eventProblem(empty, dsb)).toBe('Give each series its shots or its total.')
    expect(eventProblem({ ...ringEvent, level: 'Weltmeisterschaft' }, dsb)).toMatch(/level/)
    const major = {
      ...ipscEvent,
      division: 'Production',
      results: {
        method: 'hit-factor' as const,
        stages: [{ ...stage('S', 1, 0, 2), powerFactor: 'major' as const }],
      },
    }
    expect(eventProblem(major, ipsc)).toMatch(/major/)
  })
})

describe('export', () => {
  const events = [record('00000000-0000-4000-8000-000000000001', 'LM 2026', ringEvent)]
  const names = { type: () => 'DSB-Meisterschaft', firearm: () => '', load: () => '' }

  it('writes one CSV row per series or stage, the event total on each', () => {
    const rows = eventRows(
      [...events, record('00000000-0000-4000-8000-000000000002', 'Match', ipscEvent)],
      types,
      names,
    )
    const header = rows[0] ?? []
    expect(rows).toHaveLength(5)
    expect(rows.every((r) => r.length === header.length)).toBe(true)
    const at = (row: number, column: string) => rows[row]?.[header.indexOf(column)]
    expect([at(1, 'Part'), at(1, 'Shots'), at(1, 'Points'), at(1, 'Event total')]).toEqual([
      'Series 1',
      '10 9 10.5',
      '29.5',
      '124.5',
    ])
    expect([at(3, 'Part'), at(3, 'A'), at(3, 'Hit factor'), at(3, 'Stage points')]).toEqual([
      'Stage 1',
      10,
      '4.4800',
      100,
    ])
  })

  it('gives an event without results one row', () => {
    const bare = record('00000000-0000-4000-8000-000000000003', 'Bare', blankEvent(dsb, day))
    expect(eventRows([bare], types, names)).toHaveLength(2)
  })

  it('writes JSON that Import reads back as the same event', () => {
    const parsed = parseUserDataFile(eventsJson(events))
    expect(parsed.ok && parsed.records).toEqual(events)
  })
})

it('reads ring values typed with spaces, semicolons or a decimal comma', () => {
  expect(parseShots('10 9,5;10.2')).toEqual([10, 9.5, 10.2])
  expect(parseShots('  ')).toEqual([])
  expect(parseShots('10 x')).toBeUndefined()
})
