import { join } from 'node:path'
import { checkCoverage, sourceIndex } from '@open-reloading/catalog'
import { eventType, federation, sourceRecord } from '@rangefoundry/schema'
import { describe, expect, it } from 'vitest'
// not part of the package's exports: readRecords runs it on the whole bundle
import { checkEventTypes } from '../../../packages/catalog/src/event-types.ts'
import { defined } from '../../../packages/catalog/test/defined.ts'
import { readKind } from '../../src/catalog/read-kind.ts'

const records = join(import.meta.dirname, '..', '..', '..', 'packages', 'catalog', 'records')

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
