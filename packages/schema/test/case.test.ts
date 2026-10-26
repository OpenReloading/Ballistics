import { describe, expect, it } from 'vitest'
import { cartridgeCase, caseMaterials, catalogueCase } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const provenance = { kind: 'published', sources: [{ title: 'Example catalogue' }] }
const record = {
  id: 'example-308-win-brass',
  origin: 'catalogue',
  name: '308 Win. brass',
  manufacturer: 'catalogue:example-cases',
  cartridge: 'catalogue:308-win',
  productNumber: 'B308',
  headstamp: 'EX 308 WIN',
  material: 'brass',
  primerPocket: { type: 'boxer', size: 'large rifle' },
  flashHole: { value: 2.0 },
  mass: { value: 11.3 },
  waterCapacity: { value: 3.56 },
  annealed: true,
  provenance,
}

describe('Case', () => {
  it('accepts a complete catalogue record and one with only the required fields', () => {
    expect(catalogueCase.safeParse(record).success).toBe(true)
    const { primerPocket, flashHole, mass, waterCapacity, annealed, headstamp, ...least } = record
    expect(catalogueCase.safeParse(least).success).toBe(true)
  })

  it('needs each required field of a catalogue record', () => {
    for (const key of [
      'id',
      'origin',
      'name',
      'manufacturer',
      'cartridge',
      'productNumber',
      'material',
      'provenance',
    ]) {
      const { [key]: _gone, ...rest } = record as Record<string, unknown>
      expectIssueAt(catalogueCase, rest, key)
    }
  })

  it('refuses an unknown material and every listed one is accepted', () => {
    expectIssueAt(cartridgeCase, { ...record, material: 'titanium' }, 'material')
    for (const material of caseMaterials.options)
      expect(cartridgeCase.safeParse({ ...record, material }).success).toBe(true)
  })

  it('knows Boxer and Berdan pockets only', () => {
    expect(cartridgeCase.safeParse({ ...record, primerPocket: { type: 'berdan' } }).success).toBe(
      true,
    )
    expectIssueAt(
      cartridgeCase,
      { ...record, primerPocket: { type: 'crimped' } },
      'primerPocket.type',
    )
  })

  it('refuses non-positive values and a field it does not define', () => {
    expectIssueAt(cartridgeCase, { ...record, flashHole: { value: 0 } }, 'flashHole')
    expectIssueAt(cartridgeCase, { ...record, mass: { value: -1 } }, 'mass')
    expectIssueAt(cartridgeCase, { ...record, waterCapacity: { value: 0 } }, 'waterCapacity')
    expect(cartridgeCase.safeParse({ ...record, colour: 'red' }).success).toBe(false)
  })

  it('names catalogue records only, by reference', () => {
    expectIssueAt(
      cartridgeCase,
      { ...record, cartridge: 'user:3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13' },
      'cartridge',
    )
    expectIssueAt(cartridgeCase, { ...record, manufacturer: 'example-cases' }, 'manufacturer')
  })

  it('is no catalogue record without origin catalogue', () => {
    expectIssueAt(catalogueCase, { ...record, origin: 'user' }, 'origin')
  })

  describe('a group of cases of the user', () => {
    const own = {
      origin: 'user',
      name: 'Match brass, lot 3',
      cartridge: 'user:3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13',
      material: 'brass',
      basedOn: 'catalogue:example-308-win-brass',
      capacity: 'user:7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57',
      numberOfFirings: 3,
      trimLength: { value: 51.1 },
      neckWall: { value: 0.35 },
      casesMeasured: 10,
      spread: { value: 0.04 },
    }

    it('takes the measured fields, with no manufacturer and no provenance', () => {
      expect(cartridgeCase.safeParse(own).success).toBe(true)
      expect(cartridgeCase.safeParse({ ...own, numberOfFirings: 0 }).success).toBe(true)
    })

    it('refuses a firing count that is no whole number, a case count of 0 and non-positive lengths', () => {
      expectIssueAt(cartridgeCase, { ...own, numberOfFirings: 1.5 }, 'numberOfFirings')
      expectIssueAt(cartridgeCase, { ...own, numberOfFirings: -1 }, 'numberOfFirings')
      expectIssueAt(cartridgeCase, { ...own, casesMeasured: 0 }, 'casesMeasured')
      expectIssueAt(cartridgeCase, { ...own, trimLength: { value: 0 } }, 'trimLength')
      expectIssueAt(cartridgeCase, { ...own, neckWall: { value: -0.1 } }, 'neckWall')
      expectIssueAt(cartridgeCase, { ...own, spread: { value: -0.01 } }, 'spread')
    })

    it('bases a group on a catalogue product only', () => {
      expectIssueAt(
        cartridgeCase,
        { ...own, basedOn: 'user:7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57' },
        'basedOn',
      )
    })

    it('is no catalogue record, and a catalogue record names a catalogue capacity only', () => {
      expectIssueAt(catalogueCase, own, 'origin')
      expectIssueAt(catalogueCase, { ...record, capacity: own.capacity }, 'capacity')
    })
  })
})
