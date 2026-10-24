import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCatalogue } from '../src/catalogue/build.ts'
import { cartridgeItem, contentHash, revisionOf } from '../src/catalogue/derive.ts'
import { loadCatalogue, writeCatalogue } from '../src/catalogue/node.ts'
import { openCatalogue } from '../src/catalogue/open.ts'
import { catalogueFormat } from '../src/catalogue/types.ts'
import { bundle } from './fixtures.ts'

const built = buildCatalogue(bundle)
const catalogue = openCatalogue(built)
const ids = (page: { items: { id: string }[] }) => page.items.map((i) => i.id)

describe('derive', () => {
  it('takes the sheet minima, the highest side-less Pmax and the case head of a cartridge', () => {
    const [alpha, beta] = bundle.cartridges
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
      maxBulletDiameter: 9.02,
      caseLength: 20,
      cartridgeLength: 29.7,
    })
  })

  it('hashes the same text alike and any other text differently', () => {
    expect(contentHash('a')).toMatch(/^[0-9a-f]{14}$/)
    expect(contentHash('a')).toBe(contentHash('a'))
    expect(contentHash('a')).not.toBe(contentHash('b'))
    expect(revisionOf({ id: 'x', name: 'one' })).not.toBe(revisionOf({ id: 'x', name: 'two' }))
  })
})

describe('build', () => {
  it('writes records without kind, origin and revision', () => {
    expect(JSON.stringify(built.records)).not.toMatch(/"(?:origin|revision)"/)
    expect(Object.keys(built.records.cartridge['alpha-rifle'])).not.toContain('kind')
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
    const bad = { ...bundle, bullets: [{ ...bundle.bullets[0], manufacturer: 'nobody' }] }
    expect(() => buildCatalogue(bad)).toThrow('example-a-1: unknown manufacturer nobody')
  })
})

describe('open', () => {
  it('rejects an index of another format', () => {
    const index = { ...built.index, format: catalogueFormat + 1 } as unknown as typeof built.index
    expect(() => openCatalogue({ index, records: built.records })).toThrow('format')
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

  it('searches a component by its manufacturer name or alias and the product name', () => {
    expect(ids(catalogue.powders({ q: 'example a fast' }))).toEqual(['example-a-fast'])
    expect(ids(catalogue.powders({ q: 'old a fast' }))).toEqual(['example-a-fast'])
    expect(ids(catalogue.powders({ q: 'fast', manufacturer: 'example-b' }))).toEqual([])
    expect(ids(catalogue.bullets({ q: 'test 168' }))).toEqual(['example-a-1'])
  })

  it('answers the record with kind, origin and a revision that follows its content', () => {
    const record = catalogue.get('bullet', 'example-a-1')
    expect(record).toMatchObject({ id: 'example-a-1', kind: 'bullet', origin: 'catalogue' })
    expect(record?.revision).toBe(revisionOf(bundle.bullets[0]))
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
      organization: 'Test',
      name: 'Test Face',
      caliberClasses: ['air-4-5'],
      categories: ['air-pistol', 'air-rifle'],
    })
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

  it('builds from the data bundle where there are no files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalogue-'))
    try {
      expect(loadCatalogue(dir).cartridges().total).toBeGreaterThan(500)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
