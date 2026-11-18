import { describe, expect, it } from 'vitest'
import { powder } from '../src/index.ts'

const base = {
  id: 'test-powder',
  manufacturer: 'test-manufacturer',
  name: 'Powder',
  provenance: { kind: 'published', sources: [{ title: 'Product page', fields: ['name'] }] },
} as const

const paths = (record: object) =>
  powder.safeParse(record).error?.issues.map((i) => i.path.join('.'))

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
    expect(paths({ ...base, grainForm: 'granular' })).toEqual(['grainForm'])
    expect(paths({ ...base, propellantBase: 'quadruple' })).toEqual(['propellantBase'])
    expect(paths({ ...base, aliases: [''] })).toEqual(['aliases.0'])
    expect(paths({ ...base, aliases: [] })).toEqual(['aliases'])
  })
})

describe('powder burn-rate charts and scope', () => {
  const chart = { chart: { manufacturer: 'test-manufacturer', edition: '2024' }, position: 12 }

  it('keeps one entry per chart, each with its own relative value or none', () => {
    const burnRateCharts = [
      { ...chart, relative: 87.5 },
      { chart: { manufacturer: 'other-manufacturer', edition: '2023-05-01' }, position: 40 },
    ]
    expect(powder.parse({ ...base, burnRateCharts }).burnRateCharts).toEqual(burnRateCharts)
  })

  it('rejects a chart listed twice, a position below 1 or not whole, and an empty edition', () => {
    expect(paths({ ...base, burnRateCharts: [chart, { ...chart, position: 13 }] })).toEqual([
      'burnRateCharts',
    ])
    expect(paths({ ...base, burnRateCharts: [{ ...chart, position: 0 }] })).toEqual([
      'burnRateCharts.0.position',
    ])
    expect(paths({ ...base, burnRateCharts: [{ ...chart, position: 1.5 }] })).toEqual([
      'burnRateCharts.0.position',
    ])
    expect(
      paths({ ...base, burnRateCharts: [{ ...chart, chart: { ...chart.chart, edition: '' } }] }),
    ).toEqual(['burnRateCharts.0.chart.edition'])
  })

  it('accepts a set of the stated uses and rejects a repeated or unknown use', () => {
    expect(powder.parse({ ...base, scope: ['rifle', 'shotgun'] }).scope).toEqual([
      'rifle',
      'shotgun',
    ])
    expect(paths({ ...base, scope: ['rifle', 'rifle'] })).toEqual(['scope'])
    expect(paths({ ...base, scope: ['airgun'] })).toEqual(['scope.0'])
    expect(paths({ ...base, scope: [] })).toEqual(['scope'])
  })
})

describe('powder country and listed cartridges', () => {
  it('accepts a country with a source that names it, and rejects the other cases', () => {
    const named = { title: 'Supplier address', fields: ['country'] }
    const sources = (...more: object[]) => ({
      kind: 'published',
      sources: [...base.provenance.sources, ...more],
    })
    expect(powder.parse({ ...base, country: 'FI', provenance: sources(named) }).country).toBe('FI')
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
    // a source without `fields` does not name the list
    expect(paths({ ...base, listedCartridges: ['308-win'] })).toEqual(['listedCartridges'])
    expect(paths({ ...base, listedCartridges: [], provenance })).toEqual(['listedCartridges'])
    expect(paths({ ...base, listedCartridges: ['308 Win'], provenance })).toEqual([
      'listedCartridges.0',
    ])
  })
})

describe('powder kernel and safety data sheet fields', () => {
  it('accepts a perforation and rejects an unknown one', () => {
    expect(powder.parse({ ...base, perforation: 'single' }).perforation).toBe('single')
    expect(paths({ ...base, perforation: 'seven' })).toEqual(['perforation'])
  })

  it('accepts kernel dimensions in mm and rejects an empty set', () => {
    const grainDimensions = { length: { value: 1.6 }, diameter: { value: 0.9 } }
    expect(powder.parse({ ...base, grainDimensions }).grainDimensions).toEqual(grainDimensions)
    expect(paths({ ...base, grainDimensions: {} })).toEqual(['grainDimensions'])
  })

  it('accepts a heat of explosion with its printed value and rejects a zero', () => {
    const heatOfExplosion = { value: 3_900_000, raw: '3900 J/g' }
    expect(powder.parse({ ...base, heatOfExplosion }).heatOfExplosion).toEqual(heatOfExplosion)
    expect(paths({ ...base, heatOfExplosion: { value: 0 } })).toEqual(['heatOfExplosion.value'])
  })

  it('accepts one entry per UN number and rejects a UN number listed twice', () => {
    const transport = [
      { unNumber: 'UN0161', hazardClass: '1.3C' },
      { unNumber: 'UN0509', hazardClass: '1.4C' },
    ]
    expect(powder.parse({ ...base, transport }).transport).toEqual(transport)
    expect(paths({ ...base, transport: [transport[0], transport[0]] })).toEqual(['transport'])
  })

  it('accepts a US NA number and class 1 or 4.1 without a compatibility group', () => {
    const transport = [
      { unNumber: 'NA3178', hazardClass: '4.1' },
      { unNumber: 'UN0160', hazardClass: '1' },
    ]
    expect(powder.parse({ ...base, transport }).transport).toEqual(transport)
  })

  it('rejects a compatibility group on a class other than 1', () => {
    const transport = [{ unNumber: 'UN3178', hazardClass: '4.1C' }]
    expect(paths({ ...base, transport })).toEqual(['transport.0.hazardClass'])
  })
})
