import { describe, expect, it } from 'vitest'
import { revisionOf } from '../src/catalogue/derive.ts'
import { API_PREFIX } from '../src/version.ts'
import { defined } from './defined.ts'
import { bundle } from './fixtures.ts'
import { testCatalogue, withApi } from './setup.ts'

const { get } = withApi()
const ids = (page: { items: { id: string }[] }) => page.items.map((i) => i.id)

describe('the catalogue of cases', () => {
  const catalogue = testCatalogue(bundle)

  it('lists cases by manufacturer name and name, ids as plain record ids', () => {
    expect(catalogue.cases().items).toEqual([
      {
        id: 'alpha-brass',
        manufacturer: 'example-a',
        cartridge: 'alpha-rifle',
        name: 'Alpha Brass',
        productNumber: 'AB-1',
        material: 'brass',
        mass: 11.4,
        waterCapacity: 3.55,
      },
      {
        id: 'beta-brass',
        manufacturer: 'example-a',
        cartridge: 'beta-pistol',
        name: 'Beta Brass',
        productNumber: 'BB-1',
        material: 'brass',
      },
      {
        id: 'alpha-steel',
        manufacturer: 'example-b',
        cartridge: 'alpha-rifle',
        name: 'Alpha Steel',
        productNumber: 'AS-2',
        material: 'lacquered-steel',
      },
    ])
  })

  it('filters by cartridge and manufacturer, and searches name, maker, alias and product number', () => {
    expect(ids(catalogue.cases({ cartridge: 'alpha-rifle' }))).toEqual([
      'alpha-brass',
      'alpha-steel',
    ])
    expect(ids(catalogue.cases({ manufacturer: 'example-b' }))).toEqual(['alpha-steel'])
    expect(catalogue.cases({ cartridge: 'no-such' }).total).toBe(0)
    expect(ids(catalogue.cases({ q: 'alpha steel' }))).toEqual(['alpha-steel'])
    expect(ids(catalogue.cases({ q: 'old a ab-1' }))).toEqual(['alpha-brass'])
    expect(catalogue.cases({ limit: 1, offset: 1 }).items.map((c) => c.id)).toEqual(['beta-brass'])
  })

  it('answers a record with its kind, origin and revision', () => {
    const record = catalogue.get('case', 'alpha-brass')
    expect(record?.kind).toBe('case')
    expect(record?.origin).toBe('catalogue')
    const { origin, ...stored } = defined(bundle.cases[0])
    expect(record?.revision).toBe(revisionOf(stored))
    expect(catalogue.get('case', 'unknown')).toBeUndefined()
  })

  it('refuses a case whose manufacturer has no record', () => {
    const [first] = bundle.cases
    expect(() =>
      testCatalogue({
        ...bundle,
        cases: [{ ...defined(first), manufacturer: 'catalogue:nobody' }],
      }),
    ).toThrow('alpha-brass: unknown manufacturer nobody')
  })
})

describe('GET /cases', () => {
  it('lists, filters by cartridge and manufacturer and refuses a bad filter', async () => {
    const all = await get(`${API_PREFIX}/cases`)
    expect(all.status).toBe(200)
    expect(all.body.total).toBe(3)
    expect(ids((await get(`${API_PREFIX}/cases?cartridge=beta-pistol`)).body)).toEqual([
      'beta-brass',
    ])
    expect(ids((await get(`${API_PREFIX}/cases?manufacturer=example-b`)).body)).toEqual([
      'alpha-steel',
    ])
    expect((await get(`${API_PREFIX}/cases?q=steel`)).body.total).toBe(1)
    expect((await get(`${API_PREFIX}/cases?cartridge=Alpha Rifle`)).status).toBe(400)
  })
})

describe('GET /cases/:id', () => {
  it('answers the whole record with its origin and revision, 404 for an unknown id', async () => {
    const { status, body } = await get(`${API_PREFIX}/cases/alpha-brass`)
    expect(status).toBe(200)
    const { revision, ...record } = body
    expect(record).toEqual(defined(bundle.cases[0]))
    expect(revision).toMatch(/^[0-9a-f]{14}$/)
    expect(body.kind).toBeUndefined()
    expect((await get(`${API_PREFIX}/cases/unknown`)).status).toBe(404)
  })
})
