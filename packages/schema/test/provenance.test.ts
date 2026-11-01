import { describe, expect, it } from 'vitest'
import { bullet, publishedLoads } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

// A maker's written grant as `apps/docs/docs/data/maker-permissions.md` records it (#901).
const grant = {
  title: 'Example Maker bullet specifications',
  publisher: 'Example Maker',
  url: 'https://example.org/bullets',
  retrieved: '2026-10-30',
  origin: 'manufacturer',
  license: 'LicenseRef-Example-Maker',
  terms:
    'Written permission of 2026-10-30 by the head of product management: diameter, mass and length of the listed bullets, published under CC BY 4.0; withdrawal removes the values from the next release.',
  fields: ['diameter', 'mass', 'length'],
} as const

const record = (source: object) => ({
  id: 'example-maker-bullet-1',
  manufacturer: 'example-maker',
  productNumber: '1',
  name: 'Example bullet',
  diameter: { value: 7.823 },
  mass: { value: 10.886 },
  length: { value: 31.2 },
  provenance: { kind: 'published', sources: [source] },
})

describe('a maker grant in a record provenance', () => {
  it('validates as one manufacturer source with LicenseRef, the grant as a terms note and its fields', () => {
    expect(bullet.safeParse(record(grant)).success).toBe(true)
    const { fields: _fields, ...whole } = grant
    expect(bullet.safeParse(record(whole)).success).toBe(true)
  })

  it('refuses a LicenseRef id that is not one token', () => {
    expectIssueAt(
      bullet,
      record({ ...grant, license: 'LicenseRef-Example Maker' }),
      'provenance.sources.0.license',
    )
  })

  it('checks the no-project-licence rule of maker data only in published loads', () => {
    // the schema of a component record does not check it; a published load table does
    expect(bullet.safeParse(record({ ...grant, license: 'CC-BY-4.0' })).success).toBe(true)
    const table = (source: object) => ({
      id: 'example-maker',
      maker: 'example-maker',
      producedBy: 'maker',
      cartridgeName: '.308 Win.',
      cartridge: 'catalogue:308-winchester',
      loads: [
        {
          id: 'example-a',
          bullet: { printed: 'x', mass: { value: 10, raw: '10 g' } },
          powder: { printed: 'y' },
          charges: [{ kind: 'recommended', charge: { value: 1, raw: '1 g' } }],
          page: '1',
        },
      ],
      provenance: { kind: 'published', sources: [source] },
    })
    const { fields: _fields, ...whole } = grant
    expect(publishedLoads.safeParse(table(whole)).success).toBe(true)
    expectIssueAt(
      publishedLoads,
      table({ ...whole, license: 'CC-BY-4.0' }),
      'provenance.sources.0.license',
    )
  })
})
