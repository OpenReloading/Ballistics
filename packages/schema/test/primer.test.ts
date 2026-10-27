import { describe, expect, it } from 'vitest'
import { primer, primerSizes } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const record = {
  id: 'example-large-rifle',
  manufacturer: 'example-primers',
  name: 'Large Rifle',
  productNumber: 'P-LR',
  size: 'large-rifle',
  magnum: false,
  cup: { material: 'brass', thickness: { value: 0.5 } },
  compound: 'lead-free',
  intendedUse: 'General rifle loads.',
  performance: [{ property: 'Drop height', value: '25 mm' }],
  provenance: { kind: 'published', sources: [{ title: 'Example data sheet' }] },
}

describe('Primer', () => {
  it('accepts a complete record and one with only the required fields', () => {
    expect(primer.safeParse(record).success).toBe(true)
    expect(
      primer.safeParse({
        id: record.id,
        manufacturer: record.manufacturer,
        name: record.name,
        size: record.size,
        provenance: record.provenance,
      }).success,
    ).toBe(true)
  })

  it('needs an id, maker, name, size and provenance', () => {
    for (const key of ['id', 'manufacturer', 'name', 'size', 'provenance']) {
      const { [key]: _gone, ...rest } = record as Record<string, unknown>
      expectIssueAt(primer, rest, key)
    }
  })

  it('refuses an unknown size, compound, cup metal and field, and accepts every listed size', () => {
    expectIssueAt(primer, { ...record, size: 'medium' }, 'size')
    expectIssueAt(primer, { ...record, compound: 'mercury' }, 'compound')
    expectIssueAt(primer, { ...record, cup: { material: 'gold' } }, 'cup.material')
    expectIssueAt(primer, { ...record, cup: { thickness: { value: 0 } } }, 'cup.thickness.value')
    expectIssueAt(primer, { ...record, performance: [] }, 'performance')
    expect(primer.safeParse({ ...record, burnRate: 1 }).success).toBe(false)
    for (const size of primerSizes.options)
      expect(primer.safeParse({ ...record, size }).success).toBe(true)
  })
})
