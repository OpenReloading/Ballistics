import { describe, expect, it } from 'vitest'
import { powder } from '../src/index.ts'

const base = {
  id: 'test-powder',
  manufacturer: 'test-manufacturer',
  name: 'Powder',
  provenance: { kind: 'published', sources: [{ title: 'Product page', fields: ['name'] }] },
} as const

describe('powder', () => {
  it('accepts a record without the identity fields', () => {
    expect(powder.safeParse(base).success).toBe(true)
  })

  it('accepts aliases, form and base and keeps them', () => {
    const record = {
      ...base,
      aliases: ['Other Powder 1'],
      grainForm: 'ball',
      propellantBase: 'double',
    }
    expect(powder.parse(record)).toMatchObject({
      aliases: ['Other Powder 1'],
      grainForm: 'ball',
      propellantBase: 'double',
    })
  })

  it('rejects an unknown form or base, an empty alias and an empty alias list', () => {
    const paths = (record: object) =>
      powder.safeParse(record).error?.issues.map((i) => i.path.join('.'))
    expect(paths({ ...base, grainForm: 'granular' })).toEqual(['grainForm'])
    expect(paths({ ...base, propellantBase: 'quadruple' })).toEqual(['propellantBase'])
    expect(paths({ ...base, aliases: [''] })).toEqual(['aliases.0'])
    expect(paths({ ...base, aliases: [] })).toEqual(['aliases'])
  })

  it('accepts a country with a source that names it, and rejects the other cases', () => {
    const named = { title: 'Supplier address', fields: ['country'] }
    const sources = (...more: object[]) => ({
      kind: 'published',
      sources: [...base.provenance.sources, ...more],
    })
    expect(powder.parse({ ...base, country: 'FI', provenance: sources(named) }).country).toBe('FI')
    const paths = (record: object) =>
      powder.safeParse(record).error?.issues.map((i) => i.path.join('.'))
    // a source without `fields` supports the whole record in general, but not a country
    expect(
      paths({
        ...base,
        country: 'FI',
        provenance: { kind: 'published', sources: [{ title: 'Sheet' }] },
      }),
    ).toEqual(['country'])
    expect(paths({ ...base, country: 'FI' })).toEqual(['country'])
    for (const country of ['fi', 'FIN', 'Finland', ''])
      expect(paths({ ...base, country, provenance: sources(named) })).toEqual(['country'])
  })
})
