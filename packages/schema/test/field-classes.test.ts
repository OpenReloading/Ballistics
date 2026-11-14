import { describe, expect, it } from 'vitest'
import { bullet, powder } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const messages = (schema: typeof bullet | typeof powder, value: unknown) =>
  schema.safeParse(value).error?.issues.map((i) => i.message) ?? []

const basicBullet = {
  id: 'test-bullet-basic',
  manufacturer: 'test-manufacturer',
  productNumber: '30175',
  name: 'Test 175 gr HPBT',
  productLine: 'Test Match',
  caliber: '.308',
  diameter: { value: 7.823 },
  mass: { value: 11.34 },
  length: { value: 31.5 },
  ballisticCoefficients: [{ dragModel: 'G1', value: 0.505 }],
  recommendedTwist: { value: 254 },
  tip: { type: 'hollow-point' },
  base: { type: 'boat-tail' },
}

const basicPowder = {
  id: 'test-powder-basic',
  manufacturer: 'test-manufacturer',
  name: 'Test Powder',
  grainForm: 'extruded',
  propellantBase: 'single',
}

describe('a bullet without provenance', () => {
  it('passes with basic fields only', () => {
    expect(bullet.parse(basicBullet)).toEqual(basicBullet)
  })

  it('passes with our own note, a basic field', () => {
    const record = { ...basicBullet, note: 'Our text' }
    expect(bullet.parse(record)).toEqual(record)
  })

  it('fails with a nose length, and the message names it', () => {
    const record = { ...basicBullet, noseLength: { value: 16 } }
    expectIssueAt(bullet, record, 'noseLength')
    expect(messages(bullet, record)).toEqual(['noseLength is a detailed field: needs provenance'])
  })

  it('passes with the printed construction and its mapped enums, and fails with a jacket thickness', () => {
    const construction = {
      raw: 'Jacketed Hollow Point Boat Tail',
      structure: 'cup-and-core',
      core: { material: 'lead' },
      jacket: { material: 'gilding-metal' },
    }
    expect(bullet.safeParse({ ...basicBullet, construction }).success).toBe(true)
    const thick = { ...construction, jacket: { ...construction.jacket, thickness: { value: 0.6 } } }
    const record = { ...basicBullet, construction: thick }
    expectIssueAt(bullet, record, 'construction.jacket.thickness')
    expect(messages(bullet, record)).toEqual([
      'construction.jacket.thickness is a detailed field: needs provenance',
    ])
  })
})

describe('a powder without provenance', () => {
  it('passes with basic fields only', () => {
    expect(powder.parse(basicPowder)).toEqual(basicPowder)
  })

  it('passes with our own note, a basic field', () => {
    const record = { ...basicPowder, note: 'Our text' }
    expect(powder.parse(record)).toEqual(record)
  })

  it('fails with a composition', () => {
    const composition = [{ name: 'Nitrocellulose', min: 90, max: 100 }]
    expectIssueAt(powder, { ...basicPowder, composition }, 'composition')
  })

  it('fails with a country, with the finding of a country without its source', () => {
    const record = { ...basicPowder, country: 'FI' }
    expectIssueAt(powder, record, 'country')
    expect(messages(powder, record)).toContain('needs a source with fields country')
  })

  it('fails with aliases', () => {
    expectIssueAt(powder, { ...basicPowder, aliases: ['Other Powder 1'] }, 'aliases')
  })
})
