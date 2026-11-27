import { powder as powderSchema } from '@rangefoundry/schema'
import { describe, expect, it } from 'vitest'
import { makerRows } from '../src/maker-rows.ts'
import type { Bundle } from '../src/records.ts'

const terms = 'https://maker.example/terms'
const page = { title: 'Maker page', url: 'https://maker.example/p', terms }
const cited = (id: string, kind: string, ...sources: object[]) => ({
  id,
  provenance: { kind, sources },
})
const bundleOf = (parts: object) => parts as unknown as Bundle
const rows = (parts: object, citations: [string, (string | undefined)[]][] = []) =>
  makerRows(bundleOf(parts), new Map(citations))

const interior = { vivacity: { value: 1 } }
const ogive = { form: 'tangent' }
const thermochemistry = { flameTemperature: { value: 2800 } }
// thermochemistry is a field no maker source may supply
const makerSolved = (id: string) => ({
  ...cited(id, 'computed', { ...page, fields: ['thermochemistry'] }),
  thermochemistry,
})

const solved = (id: string, source: object) => ({
  ...cited(id, 'computed', source),
  thermochemistry: { flameTemperature: { value: 2800 } },
})
const range = (value: number) => ({ value, min: value - 1, max: value + 1 })
const coversFinding = (path: string) =>
  `source "Maker page" (not a listed non-maker source): covers ${path}, which no maker source may supply`

const solver = 'openreloading-constant-volume-equilibrium-solver'
const wording = 'mapping-of-the-maker-wording-tools-src-bullets'
const refused = (id: string, field: string) =>
  `listed source "${id}" names ${field}, which it may not supply`

describe('makerRows of bullets and powders by source id', () => {
  it("counts a source as a maker's unless its id is listed, also an embedded one", () => {
    const powders = [makerSolved('listed'), makerSolved('other'), makerSolved('embedded')]
    const found = rows({ powders }, [
      ['powders/listed.json', ['synthetic-test-data']],
      ['powders/other.json', ['maker-table']],
    ])
    const covers = [
      'source "Maker page" (not a listed non-maker source): covers thermochemistry, which no maker source may supply',
    ]
    expect(found).toEqual({
      powders: [
        { id: 'other', findings: covers },
        { id: 'embedded', findings: covers },
      ],
    })
  })

  it('does not take a public origin as clearing a source', () => {
    const powder = {
      ...cited('p', 'computed', { ...page, origin: 'public', fields: ['thermochemistry'] }),
      thermochemistry,
    }
    expect(rows({ powders: [powder] }, [['powders/p.json', ['open-data']]])).toEqual({
      powders: [
        {
          id: 'p',
          findings: [
            'source "Maker page" (not a listed non-maker source): covers thermochemistry, which no maker source may supply',
          ],
        },
      ],
    })
  })
})

describe('makerRows of the listed sources of bullets and powders', () => {
  it('asks a listed source other than synthetic-test-data to name its fields', () => {
    const found = rows(
      {
        powders: [
          solved('unnamed', { title: 'Solver' }),
          solved('named', { title: 'Solver', fields: ['thermochemistry'] }),
          solved('synthetic', { title: 'Invented' }),
          { ...cited('basic', 'computed', { title: 'Solver' }), name: 'Basic' },
        ],
      },
      [
        ['powders/unnamed.json', [solver]],
        ['powders/named.json', [solver]],
        ['powders/synthetic.json', ['synthetic-test-data']],
        ['powders/basic.json', [solver]],
      ],
    )
    expect(found).toEqual({
      powders: [
        { id: 'unnamed', findings: [`listed source "${solver}" names no fields`] },
        { id: 'basic', findings: [`listed source "${solver}" names no fields`] },
      ],
    })
  })
})

describe('makerRows of the powder fields a listed source names', () => {
  it('refuses a powder field outside the list of the source', () => {
    const found = rows(
      {
        powders: [
          solved('below', { title: 'Solver', fields: ['thermochemistry.flameTemperature'] }),
          { ...solved('interior', { title: 'Solver', fields: ['interior'] }), interior },
          { ...cited('basic', 'computed', { title: 'Solver', fields: ['name'] }), name: 'Basic' },
          { ...cited('invented', 'fitted', { title: 'Invented', fields: ['interior'] }), interior },
          solved('prefix', { title: 'Solver', fields: ['thermochemistryX'] }),
        ],
      },
      [
        ['powders/below.json', [solver]],
        ['powders/interior.json', [solver]],
        ['powders/basic.json', [solver]],
        ['powders/invented.json', ['synthetic-test-data']],
        ['powders/prefix.json', [solver]],
      ],
    )
    expect(found).toEqual({
      powders: [
        { id: 'interior', findings: [refused(solver, 'interior')] },
        { id: 'basic', findings: [refused(solver, 'name')] },
        { id: 'prefix', findings: [refused(solver, 'thermochemistryX')] },
      ],
    })
  })
})

describe('makerRows of the bullet fields a listed source names', () => {
  it('refuses a bullet field outside the list of the source for bullets', () => {
    const found = rows(
      {
        bullets: [
          cited('mapped', 'computed', { title: 'Map', fields: ['construction.core.hardness'] }),
          { ...cited('ogive', 'computed', { title: 'Map', fields: ['ogive'] }), ogive },
          cited('solved', 'computed', { title: 'Solver', fields: ['thermochemistry'] }),
          cited('invented', 'computed', { title: 'Invented', fields: ['interior'] }),
        ],
      },
      [
        ['bullets/mapped.json', [wording]],
        ['bullets/ogive.json', [wording]],
        ['bullets/solved.json', [solver]],
        ['bullets/invented.json', ['synthetic-test-data']],
      ],
    )
    expect(found).toEqual({
      bullets: [
        { id: 'ogive', findings: [refused(wording, 'ogive')] },
        { id: 'solved', findings: [refused(solver, 'thermochemistry')] },
        { id: 'invented', findings: [refused('synthetic-test-data', 'interior')] },
      ],
    })
  })
})

describe('makerRows of the wording map and a detailed path below a basic field', () => {
  it('refuses the wording map for the jacket thickness, also through construction', () => {
    const thickness = { raw: 'Jacketed', jacket: { thickness: { value: 0.6 } } }
    const found = rows(
      {
        bullets: [
          {
            ...cited('whole', 'computed', { title: 'Map', fields: ['construction'] }),
            construction: thickness,
          },
          {
            ...cited('wall', 'computed', {
              title: 'Map',
              fields: ['construction.jacket.thickness'],
            }),
            construction: thickness,
          },
        ],
      },
      [
        ['bullets/whole.json', [wording]],
        ['bullets/wall.json', [wording]],
      ],
    )
    expect(found).toEqual({
      bullets: [
        { id: 'whole', findings: [refused(wording, 'construction')] },
        { id: 'wall', findings: [refused(wording, 'construction.jacket.thickness')] },
      ],
    })
  })
})

describe('makerRows of an id outside the list', () => {
  it('counts an id that is only a property of every object as a maker source', () => {
    const found = rows({ powders: [makerSolved('p')] }, [['powders/p.json', ['constructor']]])
    expect(found).toEqual({ powders: [{ id: 'p', findings: [coversFinding('thermochemistry')] }] })
  })
})

const fitted = (id: string, fields: string[]) => ({
  ...cited(id, 'fitted', { ...page, fields }),
  interior,
})

describe('makerRows of the maker sources of bullets and powders', () => {
  it('takes a published maker source for the geometry and the composition, not the thermochemistry', () => {
    const bullet = { ...cited('b', 'published', { ...page, fields: ['ogive', 'diameter'] }), ogive }
    const powder = {
      ...cited('p', 'published', { ...page, fields: ['composition', 'thermochemistry'] }),
      composition: [{ substance: 'nitrocellulose' }],
      thermochemistry: { flameTemperature: { value: 2800 } },
    }
    expect(rows({ bullets: [bullet], powders: [powder] })).toEqual({
      powders: [
        {
          id: 'p',
          findings: [
            'source "Maker page" (not a listed non-maker source): covers thermochemistry, which no maker source may supply',
          ],
        },
      ],
    })
  })

  it("takes a maker's safety data sheet for the kernel and the transport classification", () => {
    const fields = ['perforation', 'grainDimensions', 'heatOfExplosion', 'transport']
    const powder = {
      ...cited('p', 'published', { ...page, fields }),
      perforation: 'single',
      grainDimensions: { length: { value: 1.6 } },
      heatOfExplosion: { value: 3_900_000 },
      transport: [{ unNumber: 'UN0161', hazardClass: '1.3C' }],
    }
    expect(rows({ powders: [powder] })).toEqual({})
  })
})

describe('makerRows of a maker source for the country, aliases and bulk density', () => {
  it('takes it for the country, and for the aliases and bulk density of a powder', () => {
    const bullet = { ...cited('b', 'published', { ...page, fields: ['country'] }), country: 'US' }
    const powder = {
      ...cited('p', 'published', { ...page, fields: ['country', 'aliases', 'bulkDensity'] }),
      country: 'FI',
      aliases: ['P 1'],
      bulkDensity: { value: 950 },
    }
    expect(rows({ bullets: [bullet], powders: [powder] })).toEqual({})
  })
})

describe('makerRows of a fitted maker source', () => {
  it('takes it for interior only when it names nothing else', () => {
    const found = rows({
      powders: [fitted('interior', ['interior']), fitted('scope', ['interior', 'scope'])],
    })
    expect(found).toEqual({ powders: [{ id: 'scope', findings: [coversFinding('interior')] }] })
  })
})

describe('makerRows of a maker source that names a field below a detailed path', () => {
  it('refuses it when the path is outside the list', () => {
    const powder = powderSchema.parse({
      id: 'p',
      manufacturer: 'm',
      name: 'P',
      composition: [{ name: 'Nitrocellulose', min: 90, max: 100 }],
      thermochemistry: {
        loadingDensity: { value: 200 },
        flameTemperature: range(2800),
        impetus: range(1000),
        gamma: range(1.24),
        molarMass: range(24),
        covolume: range(1),
      },
      provenance: {
        kind: 'published',
        sources: [
          {
            ...page,
            fields: ['composition', 'thermochemistry.flameTemperature', 'thermochemistry.impetus'],
          },
        ],
      },
    })
    const vivacity = {
      ...cited('v', 'published', { ...page, fields: ['interior.vivacity'] }),
      interior,
    }
    expect(rows({ powders: [powder, vivacity] })).toEqual({
      powders: [
        { id: 'p', findings: [coversFinding('thermochemistry')] },
        { id: 'v', findings: [coversFinding('interior')] },
      ],
    })
  })
})

describe('makerRows of the fields and terms of a maker source', () => {
  it('asks a published maker source for its fields and a terms URL, and refuses a license', () => {
    const bullet = cited(
      'b',
      'published',
      { title: 'Sheet', url: 'https://maker.example/s', terms: 'see the site', fields: ['ogive'] },
      { title: 'Table', url: 'https://maker.example/t', terms, license: 'CC-BY-4.0' },
    )
    expect(rows({ bullets: [{ ...bullet, ogive }] })).toEqual({
      bullets: [
        {
          id: 'b',
          findings: [
            'source "Sheet" (not a listed non-maker source): needs a terms URL',
            'source "Table" (not a listed non-maker source): names no fields',
            'source "Table" (not a listed non-maker source): carries a license',
          ],
        },
      ],
    })
  })

  it('asks a community list of the bullet length for no terms URL, and a maker source still', () => {
    const list = { title: 'Lengths', url: 'https://list.example/l', fields: ['length'] }
    const found = rows({
      bullets: [
        { ...cited('community', 'published', { ...list, origin: 'community' }), length: 30 },
        { ...cited('maker', 'published', { ...list, origin: 'manufacturer' }), length: 30 },
        {
          ...cited('ogive', 'published', { ...list, origin: 'community', fields: ['ogive'] }),
          ogive,
        },
      ],
    })
    expect(found).toEqual({
      bullets: [
        {
          id: 'maker',
          findings: ['source "Lengths" (not a listed non-maker source): needs a terms URL'],
        },
        {
          id: 'ogive',
          findings: ['source "Lengths" (not a listed non-maker source): needs a terms URL'],
        },
      ],
    })
  })
})

describe('makerRows of a maker document cited by title', () => {
  it('takes a document without a URL that names its title and publisher', () => {
    const book = { title: 'Reloading guide', publisher: 'Maker', terms, fields: ['ogive'] }
    const bullets = [
      { ...cited('book', 'published', book), ogive },
      { ...cited('no-fields', 'published', { ...book, fields: undefined }), ogive },
    ]
    expect(rows({ bullets })).toEqual({
      bullets: [
        {
          id: 'no-fields',
          findings: ['source "Reloading guide" (not a listed non-maker source): names no fields'],
        },
      ],
    })
  })
})

describe('makerRows of data received directly from a maker', () => {
  it('refuses it as not yet supported', () => {
    const bullet = {
      ...cited('b', 'measured', { title: 'Letter', terms, fields: ['ogive'] }),
      ogive,
    }
    expect(rows({ bullets: [bullet] })).toEqual({
      bullets: [
        {
          id: 'b',
          findings: [
            'source "Letter" is not a listed non-maker source and has no URL: it counts as data received directly from a maker, which is not yet supported',
          ],
        },
      ],
    })
  })
})

describe('makerRows of the listed sources of loads', () => {
  it('refuses a load or published-load file citing a listed source that supplies no load field', () => {
    const found = rows({ loads: [cited('l1', 'computed', page), cited('l2', 'computed', page)] }, [
      ['loads/l1.json', [solver]],
      ['loads/l2.json', [wording]],
      ['loads/308-win/file.json', ['synthetic-test-data', solver]],
    ])
    expect(found).toEqual({
      loads: [
        { id: 'l1', findings: [`cites listed source "${solver}", which supplies no load field`] },
        { id: 'l2', findings: [`cites listed source "${wording}", which supplies no load field`] },
      ],
      publishedLoads: [
        {
          id: '308-win/file',
          findings: [`cites listed source "${solver}", which supplies no load field`],
        },
      ],
    })
  })
})

describe('makerRows of loads and other kinds', () => {
  it('refuses a load or published-load file citing any source outside the list', () => {
    const found = rows({ loads: [cited('l1', 'published', page), cited('l2', 'measured', page)] }, [
      ['loads/l1.json', ['book']],
      ['loads/l2.json', ['synthetic-test-data']],
      ['loads/308-win/file.json', [undefined, 'synthetic-test-data']],
    ])
    expect(found).toEqual({
      loads: [{ id: 'l1', findings: ['cites source "book", which counts as a maker\'s'] }],
      publishedLoads: [
        { id: '308-win/file', findings: ["cites an embedded source, which counts as a maker's"] },
      ],
    })
  })

  it('refuses a record of another kind citing a manufacturer or a fitted source without an origin', () => {
    const maker = { title: 'Maker page', origin: 'manufacturer' }
    const book = { title: 'Rule book' }
    const found = rows({
      primers: [cited('p1', 'published', book, maker), cited('p2', 'fitted', book)],
      cartridges: [cited('c1', 'published', book)],
    })
    const finding = ['cites a manufacturer-origin source or a fitted source without an origin']
    expect(found).toEqual({
      primers: [
        { id: 'p1', findings: finding },
        { id: 'p2', findings: finding },
      ],
    })
  })

  it('keeps manufacturer records as identity records', () => {
    const maker = { title: 'Maker page', origin: 'manufacturer' }
    expect(rows({ manufacturers: [cited('m1', 'published', maker)] })).toEqual({})
  })
})
