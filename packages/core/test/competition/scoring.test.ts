import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  type HitFactorRules,
  hitFactor,
  type PracticalStage,
  practicalEventTotals,
  ringEventTotals,
  ringTotal,
  stagePoints,
  stageRawPoints,
} from '../../src/index.ts'

/** The scoring of an event type record of the data package, as the event user record names it. */
const rulesOf = (id: string): HitFactorRules =>
  JSON.parse(
    readFileSync(new URL(`../../../data/records/event-types/${id}.json`, import.meta.url), 'utf8'),
  ).scoring

const ipsc = rulesOf('ipsc-handgun')
const uspsa = rulesOf('uspsa-handgun')

const stage = (p: Partial<PracticalStage>): PracticalStage => ({
  hits: { A: 0, C: 0, D: 0 },
  misses: 0,
  noShoots: 0,
  procedurals: 0,
  time: 10,
  powerFactor: 'major',
  ...p,
})

// A worked event of three stages built from the scoring definitions of each rule book: one stage
// clean, one with a procedural penalty, one with a no-shoot hit and metal targets.
const event: PracticalStage[] = [
  stage({ hits: { A: 8, C: 2, D: 0 }, time: 5 }),
  stage({ hits: { A: 12, C: 3, D: 1 }, procedurals: 1, time: 10 }),
  stage({ hits: { A: 6, C: 4, D: 2, metal: 4 }, noShoots: 1, time: 8, powerFactor: 'minor' }),
]

describe('IPSC Handgun Rules, January 2026 Edition', () => {
  it('9.2.1.1 and Appendix B2: the hit factor is the points of the hits over the time', () => {
    // 8 A and 2 C with major: 8 x 5 + 2 x 4 = 48 points in 5 s
    expect(stagePoints(event[0] as PracticalStage, ipsc)).toEqual({ points: 48, hitFactor: 9.6 })
  })

  it('10.1.2: a procedural penalty takes 10 points off', () => {
    // 12 x 5 + 3 x 4 + 1 x 2 = 74, less 10 = 64 points in 10 s
    expect(stagePoints(event[1] as PracticalStage, ipsc)).toEqual({ points: 64, hitFactor: 6.4 })
  })

  it('9.4.2 and Appendices B2, C2, C3: a no-shoot hit takes 10 points off; minor scores C 3, D 1, metal 5', () => {
    // 6 x 5 + 4 x 3 + 2 x 1 + 4 x 5 = 64, less 10 = 54 points in 8 s
    expect(stagePoints(event[2] as PracticalStage, ipsc)).toEqual({ points: 54, hitFactor: 6.75 })
  })

  it('9.4.4: a miss takes 10 points off', () => {
    const missed = stage({ hits: { A: 2, C: 0, D: 0 }, misses: 1, time: 4 })
    expect(stagePoints(missed, ipsc)).toEqual({ points: 0, hitFactor: 0 })
    expect(stageRawPoints(stage({ hits: { A: 3, C: 0, D: 0 }, misses: 1 }), ipsc)).toBe(5)
  })

  it('9.5.5: the score of a stage is never below zero', () => {
    expect(stageRawPoints(stage({ hits: { A: 1, C: 0, D: 0 }, misses: 4 }), ipsc)).toBe(0)
  })

  it('9.2.3: the match total is the sum of the stage points; without typed stage points there is none', () => {
    expect(practicalEventTotals(event, ipsc, 'completed').total).toBeUndefined()
    const typed = event.map((s, i) => ({ ...s, stagePoints: [80, 95.1234, 60][i] }))
    expect(practicalEventTotals(typed, ipsc, 'completed').total).toBeCloseTo(235.1234, 4)
    expect(practicalEventTotals(typed, ipsc, 'disqualified').total).toBeUndefined()
    expect(practicalEventTotals(typed, ipsc, 'did-not-finish').total).toBeCloseTo(235.1234, 4)
  })
})

describe('USPSA Competition Rules, Edition 2026-09', () => {
  it('9.2.3.1 and Appendix B1: the hit factor is the points of the hits over the time', () => {
    expect(stagePoints(event[0] as PracticalStage, uspsa)).toEqual({ points: 48, hitFactor: 9.6 })
  })

  it('10.1.2: a procedural penalty is twice the best hit, 10 points', () => {
    expect(stagePoints(event[1] as PracticalStage, uspsa)).toEqual({ points: 64, hitFactor: 6.4 })
  })

  it('9.4.2 and Appendices B1 to B3: a no-shoot hit is twice the best hit; minor scores C 3, D 1, metal 5', () => {
    expect(stagePoints(event[2] as PracticalStage, uspsa)).toEqual({ points: 54, hitFactor: 6.75 })
  })

  it('9.5.6: the score of a course of fire is never below zero', () => {
    expect(stageRawPoints(stage({ misses: 1 }), uspsa)).toBe(0)
  })
})

describe('Sportordnung des DSB, Stand 01.01.2027', () => {
  it('0.11.3: a series totals its rings; a typed total stands for a series without shots', () => {
    expect(ringTotal({ shots: [10, 9, 10, 8, 9, 10, 10, 9, 9, 10] })).toBe(94)
    expect(ringTotal({ total: 96 })).toBe(96)
    expect(ringTotal({ shots: [10.4, 10.2, 9.9] })).toBe(30.5)
  })

  it('0.11.3: the event total is the sum of the series; a disqualified event has none', () => {
    const series = [{ shots: [10, 9, 10, 8, 9, 10, 10, 9, 9, 10] }, { total: 96 }]
    expect(ringEventTotals(series, 'completed')).toEqual({ total: 190, parts: [94, 96] })
    expect(ringEventTotals(series, 'disqualified')).toEqual({ parts: [94, 96] })
  })
})

describe('input checks', () => {
  it('refuses a time that is not positive, a negative count and a series without values', () => {
    expect(() => hitFactor(10, 0)).toThrow('time')
    expect(() => stageRawPoints(stage({ misses: -1 }), ipsc)).toThrow('count')
    expect(() => stageRawPoints(stage({ hits: { A: 1.5, C: 0, D: 0 } }), ipsc)).toThrow('count')
    expect(() => ringTotal({})).toThrow('shots or its total')
    expect(() => ringTotal({ shots: [-1] })).toThrow('ring value')
  })
})
