import { describe, expect, it } from 'vitest'
import { revisionOf } from '../src/catalogue/derive.ts'
import { API_PREFIX } from '../src/version.ts'
import { defined } from './defined.ts'
import { bundle } from './fixtures.ts'
import { testCatalogue, withApi } from './setup.ts'

const { get } = withApi()
const ids = (page: { items: { id: string }[] }) => page.items.map((i) => i.id)

describe('the catalogue of primers', () => {
  const catalogue = testCatalogue(bundle)

  it('lists primers by manufacturer name and name, ids as plain record ids', () => {
    expect(catalogue.primers().items).toEqual([
      {
        id: 'example-a-large-rifle',
        manufacturer: 'example-a',
        name: 'Large Rifle',
        productNumber: 'LR-1',
        size: 'large-rifle',
        magnum: false,
        compound: 'lead-styphnate',
      },
      {
        id: 'example-a-small-pistol',
        manufacturer: 'example-a',
        name: 'Small Pistol',
        size: 'small-pistol',
        compound: 'lead-free',
      },
      {
        id: 'example-b-large-rifle-magnum',
        manufacturer: 'example-b',
        name: 'Large Rifle Magnum',
        size: 'large-rifle',
        magnum: true,
      },
    ])
  })

  it('filters by manufacturer, size and compound, and searches name, maker, alias and product number', () => {
    expect(ids(catalogue.primers({ manufacturer: 'example-b' }))).toEqual([
      'example-b-large-rifle-magnum',
    ])
    expect(ids(catalogue.primers({ size: 'large-rifle' }))).toEqual([
      'example-a-large-rifle',
      'example-b-large-rifle-magnum',
    ])
    expect(ids(catalogue.primers({ compound: 'lead-free' }))).toEqual(['example-a-small-pistol'])
    expect(ids(catalogue.primers({ q: 'pistol' }))).toEqual(['example-a-small-pistol'])
    expect(ids(catalogue.primers({ q: 'old a lr-1' }))).toEqual(['example-a-large-rifle'])
    expect(ids(catalogue.primers({ limit: 1, offset: 1 }))).toEqual(['example-a-small-pistol'])
  })

  it('answers a record with its kind, origin and revision', () => {
    const record = catalogue.get('primer', 'example-a-large-rifle')
    expect(record?.kind).toBe('primer')
    expect(record?.revision).toBe(revisionOf(defined(bundle.primers[0])))
    expect(catalogue.get('primer', 'unknown')).toBeUndefined()
  })

  it('refuses a primer whose manufacturer has no record', () => {
    expect(() =>
      testCatalogue({
        ...bundle,
        primers: [{ ...defined(bundle.primers[0]), manufacturer: 'nobody' }],
      }),
    ).toThrow('example-a-large-rifle: unknown manufacturer nobody')
  })
})

describe('GET /primers', () => {
  it('lists, filters and refuses a bad filter', async () => {
    const all = await get(`${API_PREFIX}/primers`)
    expect(all.status).toBe(200)
    expect(all.body.total).toBe(3)
    expect(ids((await get(`${API_PREFIX}/primers?size=small-pistol`)).body)).toEqual([
      'example-a-small-pistol',
    ])
    expect(ids((await get(`${API_PREFIX}/primers?compound=lead-free`)).body)).toEqual([
      'example-a-small-pistol',
    ])
    expect((await get(`${API_PREFIX}/primers?manufacturer=example-b`)).body.total).toBe(1)
    expect((await get(`${API_PREFIX}/primers?q=magnum`)).body.total).toBe(1)
    expect((await get(`${API_PREFIX}/primers?size=medium`)).status).toBe(400)
    expect((await get(`${API_PREFIX}/primers?manufacturer=Example A`)).status).toBe(400)
  })
})

describe('GET /primers/:id', () => {
  it('answers the whole record, 404 for an unknown id', async () => {
    const { status, body } = await get(`${API_PREFIX}/primers/example-a-large-rifle`)
    expect(status).toBe(200)
    expect(body).toEqual(defined(bundle.primers[0]))
    expect((await get(`${API_PREFIX}/primers/unknown`)).status).toBe(404)
  })
})
