import type { Discipline, EventType, Federation } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { checkEventTypes } from '../src/event-types.ts'

const provenance = { kind: 'published' as const, sources: [{ title: 'Test rule book' }] }
const book = {
  title: 'Rules',
  edition: '1',
  publisher: 'Test',
  url: 'https://example.org/r.pdf',
  sha256: '0'.repeat(64),
}
const fed = (id: string): Federation => ({
  id,
  name: id,
  abbreviation: id.toUpperCase(),
  country: 'DE',
  ruleBooks: [{ title: book.title, edition: book.edition, url: book.url, sha256: book.sha256 }],
  provenance,
})
const disc = (id: string, federation: string): Discipline => ({
  id,
  federation,
  name: id,
  section: '1',
  page: '1',
  distance: { value: 25000, unit: 'm' },
  provenance,
})
const rings = (discipline?: string): EventType => ({
  id: 'rings',
  name: 'Rings',
  federation: 'national',
  ruleBook: book,
  scoring: { method: 'rings', ...(discipline && { discipline }) },
  levels: ['Local'],
  provenance,
})
const practical: EventType = {
  ...rings(),
  id: 'practical',
  scoring: {
    method: 'hit-factor',
    points: { major: { A: 5, C: 4, D: 2, metal: 5 }, minor: { A: 5, C: 3, D: 1, metal: 5 } },
    penalties: { miss: 10, noShoot: 10, procedural: 10 },
    powerFactors: [{ division: 'Open', minor: 125, major: 160 }],
  },
  magazine: [{ division: 'Open', maxRounds: 10 }],
}
const bundle = {
  federations: [fed('national'), fed('other')],
  disciplines: [disc('own', 'national'), disc('foreign', 'other')],
}

describe('checkEventTypes', () => {
  it('accepts a known federation, its rule book, its discipline and known divisions', () => {
    expect(checkEventTypes({ ...bundle, eventTypes: [rings('own'), practical] })).toEqual([])
  })

  it('finds an unknown federation and a rule book the federation does not list', () => {
    expect(
      checkEventTypes({ ...bundle, eventTypes: [{ ...rings(), federation: 'nobody' }] }),
    ).toEqual(['event-types/rings.json: unknown federation "nobody"'])
    const otherBook = { ...book, sha256: '1'.repeat(64) }
    expect(
      checkEventTypes({ ...bundle, eventTypes: [{ ...rings(), ruleBook: otherBook }] }),
    ).toEqual(['event-types/rings.json: rule book is not one of federation "national"'])
  })

  it('finds an unknown discipline and one of another federation', () => {
    expect(checkEventTypes({ ...bundle, eventTypes: [rings('none')] })).toEqual([
      'event-types/rings.json: unknown discipline "none"',
    ])
    expect(checkEventTypes({ ...bundle, eventTypes: [rings('foreign')] })).toEqual([
      'event-types/rings.json: discipline "foreign" is not one of federation "national"',
    ])
  })
})

describe('checkEventTypes divisions', () => {
  it('finds a major magazine limit of a division without major, and any limit on ring scoring', () => {
    const noMajor: EventType = {
      ...practical,
      scoring: {
        ...(practical.scoring as Extract<EventType['scoring'], { method: 'hit-factor' }>),
        powerFactors: [{ division: 'Open', minor: 125 }],
      },
      magazine: [{ division: 'Open', powerFactor: 'major', maxRounds: 8 }],
    }
    expect(checkEventTypes({ ...bundle, eventTypes: [noMajor] })).toEqual([
      'event-types/practical.json: magazine limits major in division "Open", which has none',
    ])
    const ringsWithMagazine: EventType = {
      ...rings(),
      magazine: [{ division: 'Open', maxRounds: 5 }],
    }
    expect(checkEventTypes({ ...bundle, eventTypes: [ringsWithMagazine] })).toEqual([
      'event-types/rings.json: magazine names division "Open" without a power factor',
    ])
  })

  it('finds a division listed twice and a magazine limit of an unknown division', () => {
    if (practical.scoring.method !== 'hit-factor') throw new Error('hit factor expected')
    const twice: EventType = {
      ...practical,
      scoring: {
        ...practical.scoring,
        powerFactors: [...practical.scoring.powerFactors, { division: 'Open', minor: 125 }],
      },
      magazine: [{ division: 'Production', maxRounds: 15 }],
    }
    expect(checkEventTypes({ ...bundle, eventTypes: [twice] })).toEqual([
      'event-types/practical.json: a division is listed twice in scoring.powerFactors',
      'event-types/practical.json: magazine names division "Production" without a power factor',
    ])
  })
})
