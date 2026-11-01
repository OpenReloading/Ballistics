import { join } from 'node:path'
import {
  type Discipline,
  type EventType,
  eventType,
  type Federation,
  federation,
  sourceRecord,
} from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { checkCoverage } from '../src/coverage.ts'
import { checkEventTypes } from '../src/event-types.ts'
import { readKind } from '../src/read-kind.ts'
import { sourceIndex } from '../src/sources.ts'
import { defined } from './defined.ts'

const records = join(import.meta.dirname, '..', 'records')

/** The event type and federation records of the repository, their rule books resolved. */
function readCatalogue() {
  const errors: string[] = []
  const sources = sourceIndex(readKind([records], 'sources', sourceRecord, { errors }))
  const eventTypes = readKind([records], 'event-types', eventType, { errors, sources })
  const federations = readKind([records], 'federations', federation, { errors, sources })
  return { errors, eventTypes, federations }
}

describe('event type records', () => {
  const { errors, eventTypes, federations } = readCatalogue()
  const byId = (id: string) => defined(eventTypes.find((t) => t.id === id))
  const hitFactor = (id: string) => {
    const { scoring } = byId(id)
    if (scoring.method !== 'hit-factor') throw new Error(`${id} is not scored by hit factor`)
    return scoring
  }

  it('reads the three records with every field cited', () => {
    expect(errors).toEqual([])
    expect(eventTypes.map((t) => t.id).sort()).toEqual([
      'dsb-meisterschaft',
      'ipsc-handgun',
      'uspsa-handgun',
    ])
    for (const t of eventTypes) expect(checkCoverage(t), t.id).toEqual([])
    expect(checkEventTypes({ eventTypes, federations, disciplines: [] })).toEqual([])
  })

  it('resolves the rule book to its edition', () => {
    expect(byId('ipsc-handgun').ruleBook).toMatchObject({
      edition: expect.stringContaining('January 2026'),
      publisher: 'International Practical Shooting Confederation',
    })
    expect(byId('uspsa-handgun').ruleBook.edition).toContain('2026-09')
    expect(byId('dsb-meisterschaft').ruleBook.edition).toBe('Stand 01.01.2027')
  })

  // IPSC Handgun Rules, January 2026 Edition, Appendix B2 and C2/C3; USPSA 2026-09, Appendix B1 to B3.
  it.each(['ipsc-handgun', 'uspsa-handgun'])(
    '%s scores A, C, D and metal per power factor',
    (id) => {
      const { points, penalties } = hitFactor(id)
      expect(points.major).toEqual({ A: 5, C: 4, D: 2, metal: 5 })
      expect(points.minor).toEqual({ A: 5, C: 3, D: 1, metal: 5 })
      expect(penalties).toEqual({ miss: 10, noShoot: 10, procedural: 10 })
    },
  )

  it('holds the power factor floors of the divisions', () => {
    const ipsc = hitFactor('ipsc-handgun').powerFactors
    expect(ipsc.find((p) => p.division === 'Open')).toEqual({
      division: 'Open',
      minor: 125,
      major: 160,
    })
    expect(ipsc.find((p) => p.division === 'Production')?.major).toBeUndefined()
    const uspsa = hitFactor('uspsa-handgun').powerFactors
    expect(uspsa.find((p) => p.division === 'Limited')).toMatchObject({ minor: 125, major: 165 })
  })

  it('lists the levels lowest first, as the rule books name them', () => {
    expect(byId('ipsc-handgun').levels).toEqual([
      'Level I',
      'Level II',
      'Level III',
      'Level IV',
      'Level V',
    ])
    expect(byId('uspsa-handgun').levels).toEqual(['Level I', 'Level II', 'Level III', 'Nationals'])
    const dsb = byId('dsb-meisterschaft').levels
    expect(dsb.indexOf('Landesmeisterschaft')).toBeLessThan(dsb.indexOf('Deutsche Meisterschaft'))
    expect(dsb.at(0)).toBe('Kreis-/Gaumeisterschaft')
    expect(dsb.at(-1)).toBe('Deutsche Meisterschaft')
  })

  it('scores the German championship by rings', () => {
    expect(byId('dsb-meisterschaft').scoring.method).toBe('rings')
  })
})

describe('checkEventTypes', () => {
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
