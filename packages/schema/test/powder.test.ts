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

  it('accepts listed cartridges with a source that names them, and rejects the other cases', () => {
    const listed = {
      title: 'Example Powder Co., product page',
      origin: 'manufacturer',
      url: 'https://example.com/powders/powder',
      retrieved: '2026-10-30',
      fields: ['listedCartridges'],
    }
    const provenance = { kind: 'published', sources: [...base.provenance.sources, listed] }
    expect(
      powder.parse({ ...base, listedCartridges: ['308-win'], provenance }).listedCartridges,
    ).toEqual(['308-win'])
    expect(powder.parse(base).listedCartridges).toBeUndefined()
    const paths = (record: object) =>
      powder.safeParse(record).error?.issues.map((i) => i.path.join('.'))
    // a source without `fields` does not name the list
    expect(paths({ ...base, listedCartridges: ['308-win'] })).toEqual(['listedCartridges'])
    expect(paths({ ...base, listedCartridges: [], provenance })).toEqual(['listedCartridges'])
    expect(paths({ ...base, listedCartridges: ['308 Win'], provenance })).toEqual([
      'listedCartridges.0',
    ])
  })
})
