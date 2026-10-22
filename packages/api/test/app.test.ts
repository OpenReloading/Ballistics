import type { Bundle } from '@openreloading/data'
import type { Cartridge, SpecValue } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import { seedBundle } from '../src/db/seed.ts'
import { API_PREFIX } from '../src/version.ts'
import { bundle } from './fixtures.ts'
import { withApi } from './setup.ts'

const api = withApi()
const { get } = api
/** A second database, reseeded by each test that needs records of its own. */
const otherApi = withApi({ seed: false })

describe('GET /', () => {
  it('answers the root route', async () => {
    expect(await get('/')).toEqual({ status: 200, body: { root: true } })
  })

  it('limits the time a request may take to arrive', () => {
    expect(api.app.server.requestTimeout).toBe(30_000)
  })
})

describe('GET /cartridges', () => {
  it('lists cartridges by name with their table', async () => {
    const { status, body } = await get(`${API_PREFIX}/cartridges`)
    expect(status).toBe(200)
    expect(body.total).toBe(3)
    expect(body.items).toEqual([
      {
        id: 'alpha-rifle',
        name: 'Alpha Rifle',
        aliases: ['Alpha 7,62'],
        table: 'I',
        pmax: 4000,
      },
      {
        id: 'beta-pistol',
        name: 'Beta Pistol',
        aliases: [],
        table: 'IV',
        // the smallest cartridge G1 of the sheet; the chamber G1 is not one
        maxBulletDiameter: 9.02,
        caseLength: 20,
        // the smallest cartridge L6, as L3: the shortest variant
        cartridgeLength: 29.7,
      },
      {
        id: 'gamma-100-percent',
        name: 'Gamma 100% Mag.',
        aliases: [],
        table: 'I',
      },
    ])
  })

  it('lists the country of a cartridge when its sheet prints one', async () => {
    await seedBundle(otherApi.db, {
      ...bundle,
      cartridges: bundle.cartridges.map((c) =>
        c.id === 'alpha-rifle' ? { ...c, country: 'Germany' } : c,
      ),
    })
    const items = (await otherApi.app.inject({ url: `${API_PREFIX}/cartridges` })).json().items
    const alpha = items.find((c: { id: string }) => c.id === 'alpha-rifle')
    expect(alpha.country).toBe('Germany')
    expect(items.find((c: { id: string }) => c.id === 'beta-pistol')).not.toHaveProperty('country')
  })

  it('gives the case type from the cartridge R1, P1 and R3 of the sheet', async () => {
    const head = (r1: number, p1: number, r3?: number): SpecValue[] => [
      { side: 'cartridge', symbol: 'R1', quantity: 'length', value: r1 },
      { side: 'cartridge', symbol: 'P1', quantity: 'length', value: p1 },
      ...(r3 === undefined
        ? []
        : [{ side: 'cartridge' as const, symbol: 'R3', quantity: 'length' as const, value: r3 }]),
      // a chamber R1 is not the case's
      { side: 'chamber', symbol: 'R1', quantity: 'length', value: 20 },
    ]
    const heads: Record<string, SpecValue[]> = {
      'alpha-rifle': head(11.94, 11.95),
      'beta-pistol': head(13.72, 11.68),
      'gamma-100-percent': head(11.2, 11.73),
    }
    await seedBundle(otherApi.db, {
      ...bundle,
      cartridges: bundle.cartridges.map((c) => ({ ...c, values: [...c.values, ...heads[c.id]] })),
    })
    const types = (await otherApi.app.inject({ url: `${API_PREFIX}/cartridges` }))
      .json()
      .items.map((c: { caseType?: string }) => c.caseType)
    expect(types).toEqual(['rimless', 'rimmed', 'rebated'])
    // the record gives the same type as the list
    for (const [id, type] of [
      ['alpha-rifle', 'rimless'],
      ['beta-pistol', 'rimmed'],
      ['gamma-100-percent', 'rebated'],
    ])
      expect(
        (await otherApi.app.inject({ url: `${API_PREFIX}/cartridges/${id}` })).json().caseType,
      ).toBe(type)
    await seedBundle(otherApi.db, {
      ...bundle,
      cartridges: bundle.cartridges.map((c) => ({
        ...c,
        values: [...c.values, ...head(13, 13.05, 13.4)],
      })),
    })
    expect(
      (await otherApi.app.inject({ url: `${API_PREFIX}/cartridges?limit=1` })).json().items[0]
        .caseType,
    ).toBe('belted')
  })

  it('searches names and aliases', async () => {
    expect(
      (await get(`${API_PREFIX}/cartridges?q=7,62`)).body.items.map((c: { id: string }) => c.id),
    ).toEqual(['alpha-rifle'])
    expect((await get(`${API_PREFIX}/cartridges?q=pistol`)).body.total).toBe(1)
  })

  it('treats % and _ in the search as text', async () => {
    expect((await get(`${API_PREFIX}/cartridges?q=100%25`)).body.total).toBe(1)
    expect((await get(`${API_PREFIX}/cartridges?q=%25`)).body.total).toBe(1)
    expect((await get(`${API_PREFIX}/cartridges?q=_`)).body.total).toBe(0)
  })

  it('filters by table and pages', async () => {
    expect((await get(`${API_PREFIX}/cartridges?table=IV`)).body.total).toBe(1)
    const page = await get(`${API_PREFIX}/cartridges?limit=1&offset=1`)
    expect(page.body.total).toBe(3)
    expect(page.body.items.map((c: { id: string }) => c.id)).toEqual(['beta-pistol'])
  })

  it('ignores the removed standard parameter', async () => {
    const all = (await get(`${API_PREFIX}/cartridges`)).body.total
    expect((await get(`${API_PREFIX}/cartridges?standard=SAAMI`)).body.total).toBe(all)
  })

  it('rejects invalid parameters', async () => {
    expect((await get(`${API_PREFIX}/cartridges?limit=0`)).status).toBe(400)
    expect((await get(`${API_PREFIX}/cartridges?limit=201`)).status).toBe(400)
    expect((await get(`${API_PREFIX}/cartridges?offset=-1`)).status).toBe(400)
    expect((await get(`${API_PREFIX}/cartridges?offset=1e22`)).status).toBe(400)
    for (const query of ['q=a%00b', 'table=a%00b'])
      expect((await get(`${API_PREFIX}/cartridges?${query}`)).status).toBe(400)
  })
})

describe('GET /cartridges/:id', () => {
  it('returns the cartridge record with its sheet values and provenance', async () => {
    const { status, body } = await get(`${API_PREFIX}/cartridges/alpha-rifle`)
    expect(status).toBe(200)
    expect(body).toMatchObject({
      id: 'alpha-rifle',
      name: 'Alpha Rifle',
      aliases: ['Alpha 7,62'],
      table: 'I',
      published: '2020-01-01',
      verification: 'unverified',
    })
    expect(body.provenance).toEqual(bundle.cartridges[0].provenance)
    expect(body.values).toEqual(bundle.cartridges[0].values)
    expect(body).not.toHaveProperty('specs')
    expect(body).not.toHaveProperty('revised')
    expect(body).not.toHaveProperty('pressureMethod')
  })

  it('returns the revision date, pressure method, country and exceptions of the sheet', async () => {
    const extra = {
      country: 'Germany',
      revised: '2024-05-06',
      pressureMethod: 'piezo' as const,
      exceptions: [{ finding: 'f', note: 'n' }],
    }
    await seedBundle(otherApi.db, {
      ...bundle,
      cartridges: bundle.cartridges.map((c) => (c.id === 'beta-pistol' ? { ...c, ...extra } : c)),
    })
    const body = (await otherApi.app.inject({ url: `${API_PREFIX}/cartridges/beta-pistol` })).json()
    expect(body).toMatchObject(extra)
  })

  it('includes case capacities', async () => {
    const { body } = await get(`${API_PREFIX}/cartridges/alpha-rifle`)
    expect(body.capacities).toEqual(bundle.capacities)
    expect((await get(`${API_PREFIX}/cartridges/beta-pistol`)).body.capacities).toEqual([])
  })

  it('keeps raw-only values', async () => {
    const { body } = await get(`${API_PREFIX}/cartridges/gamma-100-percent`)
    expect(body.values).toEqual([{ symbol: 'M', quantity: 'length', raw: '25/30' }])
  })

  it('answers 404 for an unknown cartridge and 400 for an invalid id', async () => {
    expect((await get(`${API_PREFIX}/cartridges/unknown`)).status).toBe(404)
    expect((await get(`${API_PREFIX}/cartridges/Not_An_Id`)).status).toBe(400)
  })
})

describe('GET /target-faces', () => {
  it('lists faces and returns a whole record', async () => {
    expect((await get(`${API_PREFIX}/target-faces`)).body).toEqual({
      total: 1,
      items: [
        {
          id: 'test-face',
          organization: 'Test',
          name: 'Test Face',
          caliberClasses: ['air-4-5'],
          categories: ['air-pistol', 'air-rifle'],
        },
      ],
    })
    expect((await get(`${API_PREFIX}/target-faces/test-face`)).body).toEqual(bundle.targetFaces[0])
    expect((await get(`${API_PREFIX}/target-faces/unknown`)).status).toBe(404)
    expect((await get(`${API_PREFIX}/target-faces/Not_An_Id`)).status).toBe(400)
  })
})

describe('GET /federations, /disciplines and /target-mappings', () => {
  it('lists summaries and returns whole records', async () => {
    expect((await get(`${API_PREFIX}/federations`)).body).toEqual({
      total: 1,
      items: [
        {
          id: 'test-federation',
          name: 'Test Federation',
          abbreviation: 'Test',
          country: 'international',
        },
      ],
    })
    const discipline = {
      id: 'test-discipline',
      federation: 'test-federation',
      name: 'Test discipline',
      number: '1',
      distanceMm: 10000,
      category: 'air-pistol',
    }
    expect((await get(`${API_PREFIX}/disciplines`)).body).toEqual({ total: 1, items: [discipline] })
    expect((await get(`${API_PREFIX}/disciplines?federation=test-federation`)).body.total).toBe(1)
    expect((await get(`${API_PREFIX}/disciplines?federation=other`)).body.total).toBe(0)
    const mapping = {
      id: 'test-discipline-test-face',
      discipline: 'test-discipline',
      face: 'test-face',
      event: 'Test event',
      gaugeMm: 4.5,
    }
    expect((await get(`${API_PREFIX}/target-mappings`)).body).toEqual({
      total: 1,
      items: [mapping],
    })
    expect(
      (await get(`${API_PREFIX}/target-mappings?discipline=test-discipline&face=test-face`)).body
        .total,
    ).toBe(1)
    expect((await get(`${API_PREFIX}/target-mappings?face=other`)).body.total).toBe(0)
    for (const [path, record] of [
      ['federations/test-federation', bundle.federations[0]],
      ['disciplines/test-discipline', bundle.disciplines[0]],
      ['target-mappings/test-discipline-test-face', bundle.targetMappings[0]],
    ] as const)
      expect((await get(`${API_PREFIX}/${path}`)).body).toEqual(record)
    for (const path of ['federations', 'disciplines', 'target-mappings']) {
      expect((await get(`${API_PREFIX}/${path}/unknown`)).status).toBe(404)
      expect((await get(`${API_PREFIX}/${path}/Not_An_Id`)).status).toBe(400)
    }
    expect((await get(`${API_PREFIX}/disciplines?federation=Bad_Id`)).status).toBe(400)
  })
})

describe('GET /powders and /bullets', () => {
  it('lists powders, searches manufacturer name, aliases and name, filters by manufacturer id', async () => {
    expect((await get(`${API_PREFIX}/powders`)).body).toEqual({
      total: 2,
      items: [
        { id: 'example-a-fast', manufacturer: 'example-a', name: 'Fast' },
        { id: 'example-b-slow', manufacturer: 'example-b', name: 'Slow' },
      ],
    })
    expect((await get(`${API_PREFIX}/powders?q=a fast`)).body.total).toBe(1)
    expect((await get(`${API_PREFIX}/powders?q=old a fast`)).body.total).toBe(1)
    expect((await get(`${API_PREFIX}/powders?q=old a slow`)).body.total).toBe(0)
    expect((await get(`${API_PREFIX}/powders?manufacturer=example-b`)).body.total).toBe(1)
    expect((await get(`${API_PREFIX}/powders?manufacturer=Example B`)).status).toBe(400)
  })

  it('orders powders by manufacturer name, not id', async () => {
    await seedBundle(otherApi.db, {
      ...bundle,
      manufacturers: bundle.manufacturers.map((m) =>
        m.id === 'example-a' ? { ...m, name: 'Zulu' } : m,
      ),
    })
    const items = (await otherApi.app.inject({ url: `${API_PREFIX}/powders` })).json().items
    expect(items.map((i: { id: string }) => i.id)).toEqual(['example-b-slow', 'example-a-fast'])
  })

  it('lists manufacturers by name and returns a whole record', async () => {
    const { body } = await get(`${API_PREFIX}/manufacturers`)
    expect(body.total).toBe(4)
    expect(body.items[0]).toEqual({ id: 'example-a', name: 'Example A', aliases: ['Old A'] })
    expect(body.items[1]).toEqual({ id: 'example-b', name: 'Example B' })
    expect((await get(`${API_PREFIX}/manufacturers/example-a`)).body).toEqual(
      bundle.manufacturers[0],
    )
    expect((await get(`${API_PREFIX}/manufacturers/unknown`)).status).toBe(404)
    expect((await get(`${API_PREFIX}/manufacturers/Not_An_Id`)).status).toBe(400)
  })

  it('lists the form, base and burn parameters of a powder', async () => {
    const interior = {
      model: 'm3',
      fitted: ['vivacity'],
      vivacity: { value: 0.66, standardUncertainty: 0.02 },
      energy: { value: 3.4e6 },
      gamma: 1.24,
      covolume: { value: 0.001 },
      density: { value: 1.6 },
      pressureExponent: 1,
      referencePressure: { value: 0.980665 },
      burnForm: { kind: 'twoStage', a: { value: 0 }, m: 0.5, q: 0.5, z1: 0.8 },
    }
    await seedBundle(otherApi.db, {
      ...bundle,
      powders: [
        { ...bundle.powders[0], grainForm: 'ball', propellantBase: 'double', interior },
        bundle.powders[1],
      ] as Bundle['powders'],
    })
    const [fast, slow] = (await otherApi.app.inject({ url: `${API_PREFIX}/powders` })).json().items
    expect(fast).toEqual({
      id: 'example-a-fast',
      manufacturer: 'example-a',
      name: 'Fast',
      grainForm: 'ball',
      propellantBase: 'double',
      // only what the burn-rate curve needs
      interior: {
        vivacity: interior.vivacity,
        pressureExponent: 1,
        referencePressure: interior.referencePressure,
        burnForm: interior.burnForm,
      },
    })
    expect(slow).toEqual({ id: 'example-b-slow', manufacturer: 'example-b', name: 'Slow' })
  })

  it('returns a whole powder record', async () => {
    expect((await get(`${API_PREFIX}/powders/example-a-fast`)).body).toEqual(bundle.powders[0])
    expect((await get(`${API_PREFIX}/powders/unknown`)).status).toBe(404)
  })

  it('lists bullets with diameter, mass, length and BCs and returns a whole record', async () => {
    expect((await get(`${API_PREFIX}/bullets`)).body.items).toEqual([
      {
        id: 'example-a-1',
        manufacturer: 'example-a',
        name: 'Test 168',
        diameter: 7.82,
        mass: 10.89,
        length: null,
        ballisticCoefficientG1: 0.46,
        ballisticCoefficientG7: null,
      },
    ])
    expect((await get(`${API_PREFIX}/bullets/example-a-1`)).body).toEqual(bundle.bullets[0])
    expect(await get(`${API_PREFIX}/bullets/unknown`)).toEqual({
      status: 404,
      body: { statusCode: 404, error: 'Not Found', message: 'bullet unknown not found' },
    })
  })

  it('lists the first G1 and G7 of a record and its length', async () => {
    await seedBundle(otherApi.db, {
      ...bundle,
      bullets: [
        {
          ...bundle.bullets[0],
          length: { value: 31.5 },
          ballisticCoefficients: [
            { dragModel: 'G7', value: 0.243 },
            { dragModel: 'G1', value: 0.5, minVelocity: { value: 800 } },
            { dragModel: 'G1', value: 0.47 },
          ],
        },
      ],
    })
    const [item] = (await otherApi.app.inject({ url: `${API_PREFIX}/bullets` })).json().items
    expect(item).toMatchObject({
      length: 31.5,
      ballisticCoefficientG1: 0.5,
      ballisticCoefficientG7: 0.243,
    })
  })

  it('lists the country of a bullet and a powder and the tip type of a bullet', async () => {
    await seedBundle(otherApi.db, {
      ...bundle,
      powders: [{ ...bundle.powders[0], country: 'FI' }, bundle.powders[1]] as Bundle['powders'],
      bullets: [
        {
          ...bundle.bullets[0],
          country: 'US',
          tip: { type: 'hollow-point' },
          construction: { raw: 'Jacketed Lead', core: { material: 'lead' }, jacket: {} },
        },
        {
          ...bundle.bullets[0],
          id: 'bonded-1',
          construction: { raw: 'Bonded Soft Point', structure: 'bonded' },
        },
        { ...bundle.bullets[0], id: 'plain-1' },
      ] as Bundle['bullets'],
    })
    const [fast, slow] = (await otherApi.app.inject({ url: `${API_PREFIX}/powders` })).json().items
    expect(fast.country).toBe('FI')
    expect(slow).not.toHaveProperty('country')
    const items = (await otherApi.app.inject({ url: `${API_PREFIX}/bullets` })).json().items
    const byId = (id: string) => items.find((i: { id: string }) => i.id === id)
    expect(byId('example-a-1')).toMatchObject({
      country: 'US',
      tipType: 'hollow-point',
      construction: 'lead-core',
    })
    expect(byId('bonded-1').construction).toBe('bonded')
    expect(byId('plain-1')).not.toHaveProperty('construction')
  })

  it('pages bullets with the same manufacturer and name by id', async () => {
    const twin = (id: string) => ({ ...bundle.bullets[0], id })
    const ids: string[] = []
    await seedBundle(otherApi.db, {
      ...bundle,
      bullets: [twin('example-a-3'), twin('example-a-2'), twin('example-a-1')],
    })
    for (const offset of [0, 1, 2]) {
      ids.push(
        (
          await otherApi.app.inject({ url: `${API_PREFIX}/bullets?limit=1&offset=${offset}` })
        ).json().items[0].id,
      )
    }
    expect(ids).toEqual(['example-a-1', 'example-a-2', 'example-a-3'])
  })

  it('filters bullets by the cartridge they fit: above the middle of F and Z, up to G1', async () => {
    const sized = (id: string, value: number) => ({ ...bundle.bullets[0], id, diameter: { value } })
    const fit: Cartridge = {
      ...bundle.cartridges[0],
      id: 'fit-rifle',
      name: 'Fit Rifle',
      values: [
        { side: 'cartridge', symbol: 'G1', quantity: 'length', value: 7.85 },
        { side: 'chamber', symbol: 'G1', quantity: 'length', value: 7.87 },
        { side: 'chamber', symbol: 'F', quantity: 'length', value: 7.62 },
        { side: 'chamber', symbol: 'Z', quantity: 'length', value: 7.82 },
      ],
    }
    await seedBundle(otherApi.db, {
      ...bundle,
      cartridges: [...bundle.cartridges, fit],
      bullets: [
        sized('b-1', 7.823),
        // G1 plus the rounding of its two decimals
        sized('b-2', 7.855),
        sized('b-3', 7.856),
        // the middle of F and Z, excluded
        sized('b-4', 7.72),
        sized('b-5', 7.721),
        sized('b-6', 6.706),
      ],
    })
    const ids = async (url: string) => {
      const res = await otherApi.app.inject({ url })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(body.items.length)
      return body.items.map((b: { id: string }) => b.id)
    }
    expect(await ids(`${API_PREFIX}/bullets?cartridge=fit-rifle`)).toEqual(['b-1', 'b-2', 'b-5'])
    expect(await ids(`${API_PREFIX}/bullets?cartridge=fit-rifle&q=test`)).toEqual([
      'b-1',
      'b-2',
      'b-5',
    ])
    // without F and Z, and an unknown cartridge: no bullet fits
    expect(await ids(`${API_PREFIX}/bullets?cartridge=beta-pistol`)).toEqual([])
    expect(await ids(`${API_PREFIX}/bullets?cartridge=no-such`)).toEqual([])
    const list = await otherApi.app.inject({ url: `${API_PREFIX}/cartridges?q=Fit` })
    expect(list.json().items[0]).toMatchObject({
      maxBulletDiameter: 7.85,
      boreDiameter: 7.62,
      grooveDiameter: 7.82,
    })
  })

  it('rejects an invalid cartridge', async () => {
    for (const query of [
      'cartridge=',
      'cartridge=Not%20an%20id',
      'q=a%00b',
      'manufacturer=Not%20an%20id',
      'offset=1e22',
    ])
      expect((await get(`${API_PREFIX}/bullets?${query}`)).status).toBe(400)
  })
})

describe('API version prefix', () => {
  it('serves the probe unversioned and answers 404 for an unversioned route', async () => {
    expect((await api.app.inject({ url: '/' })).json()).toEqual({ root: true })
    expect((await api.app.inject({ url: '/cartridges' })).statusCode).toBe(404)
    expect((await api.app.inject({ url: `${API_PREFIX}/cartridges?limit=1` })).statusCode).toBe(200)
  })
})
