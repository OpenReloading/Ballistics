import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCatalogue } from '../src/catalogue/build.ts'
import { cartridgeItem, contentHash, revisionOf } from '../src/catalogue/derive.ts'
import { loadCatalogue, writeCatalogue } from '../src/catalogue/node.ts'
import { openCatalogue } from '../src/catalogue/open.ts'
import { catalogueFormat, deriveVersion } from '../src/catalogue/types.ts'
import { defined } from './defined.ts'
import { bundle } from './fixtures.ts'

const built = buildCatalogue(bundle)
const catalogue = openCatalogue(built)
const ids = (page: { items: { id: string }[] }) => page.items.map((i) => i.id)

describe('derive', () => {
  it('takes the sheet minima, the highest side-less Pmax and the case head of a cartridge', () => {
    const alpha = defined(defined(bundle.cartridges[0]))
    const beta = defined(defined(bundle.cartridges[1]))
    expect(cartridgeItem(alpha)).toEqual({
      id: 'alpha-rifle',
      name: 'Alpha Rifle',
      aliases: ['Alpha 7,62'],
      table: 'I',
      pmax: 4000,
    })
    expect(cartridgeItem(beta)).toEqual({
      id: 'beta-pistol',
      name: 'Beta Pistol',
      aliases: [],
      table: 'IV',
      boreDiameter: 7.82,
      maxBulletDiameter: 9.02,
      caseLength: 20,
      cartridgeLength: 29.7,
    })
  })

  it('hashes the same text alike and any other text differently', () => {
    expect(contentHash('a')).toMatch(/^[0-9a-f]{14}$/)
    expect(contentHash('a')).toBe(contentHash('a'))
    expect(contentHash('a')).not.toBe(contentHash('b'))
    // all 53 bits vary: the middle bits take many values over many texts
    const middle = new Set(
      Array.from(
        { length: 2000 },
        (_, i) => (BigInt(`0x${contentHash(`text ${i}`)}`) >> 11n) & 1023n,
      ),
    )
    expect(middle.size).toBeGreaterThan(500)
    expect(revisionOf({ id: 'x', name: 'one' })).not.toBe(revisionOf({ id: 'x', name: 'two' }))
  })
})

describe('build', () => {
  it('writes records without kind, origin and revision', () => {
    expect(JSON.stringify(built.records)).not.toMatch(/"(?:origin|revision)"/)
    expect(Object.keys(defined(built.records.cartridge['alpha-rifle']))).not.toContain('kind')
  })

  it('keeps each list in its default order', () => {
    expect(ids(catalogue.cartridges())).toEqual(['alpha-rifle', 'beta-pistol', 'gamma-100-percent'])
    expect(ids(catalogue.manufacturers())).toEqual([
      'example-a',
      'example-b',
      'example-c',
      'example-f',
    ])
  })

  it('names a component without its manufacturer', () => {
    const bad = { ...bundle, bullets: [{ ...defined(bundle.bullets[0]), manufacturer: 'nobody' }] }
    expect(() => buildCatalogue(bad)).toThrow('example-a-1: unknown manufacturer nobody')
  })
})

describe('open', () => {
  it('rejects an index of another format', () => {
    const index = { ...built.index, format: catalogueFormat + 1 } as unknown as typeof built.index
    expect(() => openCatalogue({ index, records: built.records })).toThrow('format')
  })

  it('rejects an index built by another derivation, or without a header', () => {
    const other = { ...built.index, derive: deriveVersion + 1 } as unknown as typeof built.index
    expect(() => openCatalogue({ index: other, records: built.records })).toThrow(
      `index derive version ${deriveVersion + 1} is not ${deriveVersion}: rebuild it`,
    )
    const { format: _, derive: __, ...old } = built.index
    expect(() =>
      openCatalogue({ index: old as unknown as typeof built.index, records: built.records }),
    ).toThrow('index format undefined')
  })

  it('rejects a record file of another format or derivation on the first get', () => {
    for (const change of [{ format: catalogueFormat + 1 }, { derive: deriveVersion + 1 }]) {
      const lazy = openCatalogue({
        index: built.index,
        records: () => ({ ...built.records, ...change }) as typeof built.records,
      })
      expect(lazy.cartridges().total).toBe(3)
      expect(() => lazy.get('cartridge', 'alpha-rifle')).toThrow('record file')
      expect(() => lazy.get('cartridge', 'alpha-rifle')).toThrow('record file')
    }
  })

  it('pages after counting, and filters by table', () => {
    expect(catalogue.cartridges({ limit: 1, offset: 1 })).toMatchObject({
      total: 3,
      items: [{ id: 'beta-pistol' }],
    })
    expect(ids(catalogue.cartridges({ table: 'I' }))).toEqual(['alpha-rifle', 'gamma-100-percent'])
  })

  it('ranks a query without regard to the order of its words and finds the compact form', () => {
    expect(ids(catalogue.cartridges({ q: 'rifle alpha' }))).toEqual(['alpha-rifle'])
    expect(ids(catalogue.cartridges({ q: 'alpha 7.62' }))).toEqual(['alpha-rifle'])
    expect(ids(catalogue.cartridges({ q: 'pistol' }))).toEqual(['beta-pistol'])
    expect(catalogue.cartridges({ q: 'nothing' })).toEqual({ total: 0, items: [] })
  })

  it('ranks a name above a word start above an infix, and keeps the default order between equal ranks', () => {
    const named = (id: string, name: string) => ({ ...defined(bundle.cartridges[2]), id, name })
    const ranked = openCatalogue(
      buildCatalogue({
        ...bundle,
        cartridges: [
          named('swin', 'Swin Rifle'),
          named('win-mag', 'Win Mag'),
          named('win', 'Win'),
          named('alpha-win', 'Alpha Win'),
        ],
      }),
    )
    expect(ids(ranked.cartridges({ q: 'win' }))).toEqual(['win', 'alpha-win', 'win-mag', 'swin'])
    expect(ids(ranked.cartridges())).toEqual(['alpha-win', 'swin', 'win', 'win-mag'])
    expect(ranked.cartridges({ q: 'win', limit: 2, offset: 1 })).toMatchObject({
      total: 4,
      items: [{ id: 'alpha-win' }, { id: 'win-mag' }],
    })
  })

  it('ignores an empty filter', () => {
    expect(catalogue.cartridges({ table: '' }).total).toBe(3)
    expect(catalogue.powders({ manufacturer: '' }).total).toBe(2)
  })

  it('searches a component by its manufacturer name or alias and the product name', () => {
    expect(ids(catalogue.powders({ q: 'example a fast' }))).toEqual(['example-a-fast'])
    expect(ids(catalogue.powders({ q: 'old a fast' }))).toEqual(['example-a-fast'])
    expect(ids(catalogue.powders({ q: 'fast', manufacturer: 'example-b' }))).toEqual([])
    expect(ids(catalogue.bullets({ q: 'test 168' }))).toEqual(['example-a-1'])
  })

  it('answers the record with kind, origin and a revision that follows its content', () => {
    const record = catalogue.get('bullet', 'example-a-1')
    expect(record).toMatchObject({ id: 'example-a-1', kind: 'bullet', origin: 'catalogue' })
    expect(record?.revision).toBe(revisionOf(defined(bundle.bullets[0])))
    expect(catalogue.get('bullet', 'unknown')).toBeUndefined()
    expect(catalogue.get('bullet', 'constructor')).toBeUndefined()
    expect(catalogue.get('cartridge', 'example-a-1')).toBeUndefined()
  })

  it('lists the capacities of a cartridge', () => {
    expect(catalogue.capacities('alpha-rifle').map((c) => c.id)).toEqual(['alpha-rifle-test'])
    expect(catalogue.capacities('beta-pistol')).toEqual([])
    expect(catalogue.capacities('constructor')).toEqual([])
  })

  it('reads the record file on the first get only', () => {
    let reads = 0
    const lazy = openCatalogue({
      index: built.index,
      records: () => {
        reads++
        return built.records
      },
    })
    lazy.cartridges()
    expect(reads).toBe(0)
    lazy.get('cartridge', 'alpha-rifle')
    lazy.get('cartridge', 'beta-pistol')
    expect(reads).toBe(1)
  })

  it('filters the competition lists', () => {
    expect(ids(catalogue.disciplines({ federation: 'test-federation' }))).toEqual([
      'test-discipline',
    ])
    expect(catalogue.disciplines({ federation: 'unknown' }).total).toBe(0)
    expect(ids(catalogue.targetMappings({ face: 'test-face' }))).toEqual([
      'test-discipline-test-face',
    ])
    expect(catalogue.targetFaces().items[0]).toEqual({
      id: 'test-face',
      federation: 'test-federation',
      organization: 'Test',
      name: 'Test Face',
      caliberClasses: ['air-4-5'],
      categories: ['air-pistol', 'air-rifle'],
    })
  })

  it('lists a face without a federation without federation and organization', () => {
    const face = { ...defined(bundle.targetFaces[0]), id: 'club-face', federation: undefined }
    const open = openCatalogue(buildCatalogue({ ...bundle, targetFaces: [face] }))
    expect(open.targetFaces().items).toEqual([
      { id: 'club-face', name: 'Test Face', caliberClasses: [], categories: ['air-rifle'] },
    ])
  })

  it('names a target mapping whose discipline is unknown, one mapping or several', () => {
    const mapping = defined(bundle.targetMappings[0])
    const stray = { ...mapping, id: 'stray', discipline: 'nobody' }
    for (const targetMappings of [[stray], [mapping, stray]])
      expect(() => buildCatalogue({ ...bundle, targetMappings })).toThrow(
        'stray: unknown discipline nobody',
      )
  })
})

describe('files', () => {
  it('opens from the files it wrote like from the records, and gives the same answers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalogue-'))
    try {
      writeCatalogue(bundle, dir)
      const loaded = loadCatalogue(dir)
      expect(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'))).toEqual(built.index)
      expect(loaded.cartridges()).toEqual(catalogue.cartridges())
      expect(loaded.get('bullet', 'example-a-1')).toEqual(catalogue.get('bullet', 'example-a-1'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('refuses files of another format or derivation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalogue-'))
    try {
      writeCatalogue(bundle, dir)
      const path = join(dir, 'index.json')
      const index = JSON.parse(readFileSync(path, 'utf8'))
      writeFileSync(path, JSON.stringify({ ...index, derive: deriveVersion - 1 }))
      expect(() => loadCatalogue(dir)).toThrow('derive version')
      writeFileSync(path, JSON.stringify({ ...index, format: catalogueFormat - 1 }))
      expect(() => loadCatalogue(dir)).toThrow('format')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('builds from the data bundle where there are no files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalogue-'))
    try {
      expect(loadCatalogue(dir).cartridges().total).toBeGreaterThan(500)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
