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
const fittedPowder = (id: string) => ({
  ...cited(id, 'fitted', { ...page, fields: ['interior'] }),
  interior,
})

const solved = (id: string, source: object) => ({
  ...cited(id, 'computed', source),
  thermochemistry: { flameTemperature: { value: 2800 } },
})
const range = (value: number) => ({ value, min: value - 1, max: value + 1 })
const coversFinding = (path: string) =>
  `source "Maker page" (not a listed non-maker source): covers ${path}, which no maker source may supply`

describe('makerRows of bullets and powders by source id', () => {
  it("counts a source as a maker's unless its id is listed, also an embedded one", () => {
    const powders = [fittedPowder('listed'), fittedPowder('other'), fittedPowder('embedded')]
    const found = rows({ powders }, [
      ['powders/listed.json', ['synthetic-test-data']],
      ['powders/other.json', ['maker-table']],
    ])
    const covers = [
      'source "Maker page" (not a listed non-maker source): covers interior, which no maker source may supply',
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
      ...cited('p', 'fitted', { ...page, origin: 'public', fields: ['interior'] }),
      interior,
    }
    expect(rows({ powders: [powder] }, [['powders/p.json', ['open-data']]])).toEqual({
      powders: [
        {
          id: 'p',
          findings: [
            'source "Maker page" (not a listed non-maker source): covers interior, which no maker source may supply',
          ],
        },
      ],
    })
  })
})

describe('makerRows of the listed sources of bullets and powders', () => {
  const solver = 'openreloading-constant-volume-equilibrium-solver'

  it('asks a listed source other than synthetic-test-data to name its fields when the record holds detailed fields', () => {
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
        {
          id: 'unnamed',
          findings: [
            `listed source "${solver}" names no fields, but the record holds detailed fields`,
          ],
        },
      ],
    })
  })
})

describe('makerRows of the maker sources of bullets and powders', () => {
  it('takes a published maker source for the geometry and the composition only', () => {
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
      ...cited('v', 'fitted', { ...page, fields: ['interior.vivacity'] }),
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
