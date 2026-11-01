import { describe, expect, it } from 'vitest'
import { eventType } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const provenance = { kind: 'published', sources: [{ title: 'Test rule book' }] }
const ruleBook = {
  title: 'Test rule book',
  edition: '2026',
  publisher: 'Test Federation',
  url: 'https://example.org/rules.pdf',
  sha256: 'a'.repeat(64),
}
const zones = (A: number, C: number, D: number) => ({ A, C, D, metal: 5 })

const hitFactor = {
  id: 'test-practical',
  name: 'Test practical',
  federation: 'test-federation',
  ruleBook,
  scoring: {
    method: 'hit-factor',
    points: { major: zones(5, 4, 2), minor: zones(5, 3, 1) },
    penalties: { miss: 10, noShoot: 10, procedural: 10 },
    noShootMaxHits: 2,
    powerFactors: [
      { division: 'Open', minor: 125, major: 160 },
      { division: 'Production', minor: 125 },
    ],
  },
  levels: ['Level I', 'Level II'],
  magazine: [
    { division: 'Production', maxRounds: 15 },
    { division: 'Open', maxLength: { value: 170 } },
  ],
  movingTargets: true,
  provenance,
}

const rings = {
  id: 'test-championship',
  name: 'Test championship',
  federation: 'test-federation',
  ruleBook,
  scoring: { method: 'rings' },
  levels: ['Kreismeisterschaft', 'Landesmeisterschaft'],
  provenance,
}

describe('eventType', () => {
  it('accepts a hit-factor and a ring event type', () => {
    expect(eventType.safeParse(hitFactor).success).toBe(true)
    expect(eventType.safeParse(rings).success).toBe(true)
    const fixed = {
      ...rings,
      scoring: { method: 'rings', discipline: 'test-discipline', seriesShots: 10 },
    }
    expect(eventType.safeParse(fixed).success).toBe(true)
  })

  it('refuses an unknown scoring method and hit-factor fields on ring scoring', () => {
    expectIssueAt(eventType, { ...rings, scoring: { method: 'time-plus' } }, 'scoring.method')
    expect(
      eventType.safeParse({
        ...rings,
        scoring: { method: 'rings', penalties: hitFactor.scoring.penalties },
      }).success,
    ).toBe(false)
  })

  it('needs both power factors in the points table and every zone', () => {
    const { major: _major, ...minorOnly } = hitFactor.scoring.points
    expectIssueAt(
      eventType,
      { ...hitFactor, scoring: { ...hitFactor.scoring, points: minorOnly } },
      'scoring.points.major',
    )
    const noD = { major: { A: 5, C: 4, metal: 5 }, minor: zones(5, 3, 1) }
    expectIssueAt(
      eventType,
      { ...hitFactor, scoring: { ...hitFactor.scoring, points: noD } },
      'scoring.points.major.D',
    )
  })

  it('needs the major floor above the minor floor', () => {
    const inverted = [{ division: 'Open', minor: 160, major: 125 }]
    expectIssueAt(
      eventType,
      { ...hitFactor, scoring: { ...hitFactor.scoring, powerFactors: inverted } },
      'scoring.powerFactors.0.major',
    )
  })

  it('refuses a level listed twice and an empty level list', () => {
    expectIssueAt(eventType, { ...rings, levels: ['A', 'A'] }, 'levels')
    expectIssueAt(eventType, { ...rings, levels: [] }, 'levels')
  })

  it('needs a round count or a length in a magazine limit', () => {
    expectIssueAt(eventType, { ...hitFactor, magazine: [{ division: 'Open' }] }, 'magazine.0')
  })

  it('needs an https rule book URL with a SHA-256', () => {
    expectIssueAt(
      eventType,
      { ...rings, ruleBook: { ...ruleBook, url: 'http://example.org/r.pdf' } },
      'ruleBook.url',
    )
    const { sha256: _sha, ...noSha } = ruleBook
    expectIssueAt(eventType, { ...rings, ruleBook: noSha }, 'ruleBook.sha256')
  })
})
