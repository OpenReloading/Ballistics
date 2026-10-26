import { describe, expect, it } from 'vitest'
import { caseCapacity, catalogueCaseCapacity, loadWaterCapacity, userRecord } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const provenance = { kind: 'published', sources: [{ title: 'Example manual' }] }
const catalogue = {
  id: 'example-308-win',
  origin: 'catalogue',
  cartridge: 'catalogue:308-win',
  waterCapacity: { value: 3.6 },
  caseManufacturer: 'catalogue:example-a',
  caseCondition: 'fired',
  provenance,
}
const user = {
  origin: 'user',
  cartridge: 'user:3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13',
  waterCapacity: { value: 3.52 },
}

describe('CaseCapacity', () => {
  it('is one schema for a catalogue record and a user record', () => {
    expect(caseCapacity.safeParse(catalogue).success).toBe(true)
    expect(caseCapacity.safeParse(user).success).toBe(true)
    expect(catalogueCaseCapacity.safeParse(catalogue).success).toBe(true)
    expect(catalogueCaseCapacity.safeParse(user).success).toBe(false)
  })

  it('needs an id and provenance in a catalogue record, which names catalogue records only', () => {
    const { id: _id, provenance: _p, ...bare } = catalogue
    expectIssueAt(caseCapacity, bare, 'id')
    expectIssueAt(caseCapacity, bare, 'provenance')
    expectIssueAt(caseCapacity, { ...catalogue, cartridge: user.cartridge }, 'cartridge')
    expectIssueAt(
      caseCapacity,
      { ...catalogue, caseManufacturer: `user:${crypto.randomUUID()}` },
      'caseManufacturer',
    )
  })

  it('refuses a plain cartridge id, a record of the earlier format', () => {
    expectIssueAt(caseCapacity, { ...catalogue, cartridge: '308-win' }, 'cartridge')
    const { origin: _o, ...old } = catalogue
    expectIssueAt(caseCapacity, old, 'origin')
  })

  it('is a user record of kind caseCapacity, the water in g', () => {
    const record = {
      kind: 'caseCapacity',
      id: crypto.randomUUID(),
      name: 'Measured, fired once',
      saved: '2026-10-13T10:00:00.000Z',
      data: user,
    }
    expect(userRecord.safeParse(record).success).toBe(true)
  })
})

describe('loadWaterCapacity', () => {
  const measured = { waterCapacity: { value: 3.52 } }
  const stated = { waterCapacity: { value: 3.6 } }

  it('uses the capacity record of a load that also names a case record', () => {
    expect(loadWaterCapacity({ capacity: measured, case: stated })).toEqual({
      grams: 3.52,
      source: 'capacity',
    })
  })

  it('falls back to the stated capacity of the case record', () => {
    expect(loadWaterCapacity({ case: stated })).toEqual({ grams: 3.6, source: 'case' })
    expect(loadWaterCapacity({ capacity: undefined, case: stated })?.source).toBe('case')
  })

  it('is unknown without a capacity record and without a stated capacity', () => {
    expect(loadWaterCapacity({})).toBeUndefined()
    expect(loadWaterCapacity({ case: {} })).toBeUndefined()
  })
})
