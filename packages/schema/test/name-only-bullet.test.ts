import { describe, expect, it } from 'vitest'
import { bullet } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const full = {
  id: 'test-bullet-1',
  manufacturer: 'test-manufacturer',
  productNumber: '1',
  name: 'Test bullet',
  diameter: { value: 7.823 },
  mass: { value: 10.886 },
  provenance: { kind: 'published', sources: [{ title: 'Data sheet' }] },
} as const

const { productNumber: _p, diameter: _d, ...named } = full
const nameOnly = { ...named, id: 'test-v-max-40gr-224', nameOnly: true }

describe('name-only bullet', () => {
  it('needs a product number and a diameter without the marker', () => {
    expect(bullet.safeParse(full).success).toBe(true)
    expectIssueAt(bullet, named, 'productNumber')
    expectIssueAt(bullet, named, 'diameter')
    expectIssueAt(bullet, { ...full, diameter: undefined }, 'diameter')
  })

  it('accepts the marker with no product number and no diameter, and with a printed diameter', () => {
    expect(bullet.parse(nameOnly)).toEqual(nameOnly)
    const printed = { ...nameOnly, diameter: { value: 5.689, raw: '.224' } }
    expect(bullet.parse(printed)).toEqual(printed)
  })

  it('refuses a product number on a name-only record and any marker but true', () => {
    expectIssueAt(bullet, { ...nameOnly, productNumber: '1' }, 'productNumber')
    expectIssueAt(bullet, { ...full, nameOnly: false }, 'nameOnly')
  })

  it('keeps the size checks that need a diameter off a record without one', () => {
    const jacket = { raw: 'Jacket', jacket: { thickness: { value: 9 } } }
    expect(bullet.safeParse({ ...nameOnly, construction: jacket }).success).toBe(true)
    expectIssueAt(bullet, { ...full, construction: jacket }, 'construction.jacket.thickness')
    const groove = { start: { value: 9 }, width: { value: 1.2 }, depth: { value: 20 } }
    expect(bullet.safeParse({ ...nameOnly, cannelure: groove }).success).toBe(true)
  })
})
