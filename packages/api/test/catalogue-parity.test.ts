import type { Bundle } from '@openreloading/data'
import { type Cartridge, compareKeys, type Provenance } from '@openreloading/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { loadBundle } from '../src/bundle.ts'
import { buildCatalogue } from '../src/catalogue/build.ts'
import { openCatalogue } from '../src/catalogue/open.ts'
import type { Catalogue } from '../src/catalogue/types.ts'
import {
  getDiscipline,
  getFederation,
  getTargetFace,
  getTargetMapping,
  listDisciplines,
  listFederations,
  listTargetFaces,
  listTargetMappings,
} from '../src/db/competition-queries.ts'
import {
  getBullet,
  getManufacturer,
  getPowder,
  listBullets,
  listManufacturers,
  listPowders,
} from '../src/db/component-queries.ts'
import type { Db } from '../src/db/index.ts'
import { getCartridge, listCartridges } from '../src/db/queries.ts'
import { seedBundle } from '../src/db/seed.ts'
import { API_PREFIX } from '../src/version.ts'
import { bundle as synthetic } from './fixtures.ts'
import { closeTestDb, createTestDb } from './setup.ts'

const published: Provenance = { kind: 'published', sources: [{ title: 'Test standard' }] }

const fitting: Cartridge = {
  id: 'delta-rifle',
  name: 'Delta Rifle',
  table: 'II',
  published: '2020-01-01',
  verification: 'unverified',
  provenance: published,
  values: [
    { side: 'cartridge', symbol: 'G1', quantity: 'length', value: 7.85 },
    { side: 'chamber', symbol: 'F', quantity: 'length', value: 7.62 },
    { side: 'chamber', symbol: 'Z', quantity: 'length', value: 7.92 },
  ],
}

/** The synthetic records with a cartridge that has the C.I.P. values the bullet fit needs, and bullets around its window. */
const rich: Bundle = {
  ...synthetic,
  cartridges: [...synthetic.cartridges, fitting],
  bullets: [
    ...synthetic.bullets,
    ...[7.7, 7.855, 7.86, 8.2].map((d, i) => ({
      ...synthetic.bullets[0],
      id: `example-b-${i}`,
      manufacturer: 'example-b',
      name: `Bullet ${i}`,
      diameter: { value: d },
    })),
  ],
}

/** The parameters of the sixteen reference queries for a data set. */
interface Params {
  cartridgeQuery: string
  table: string
  powderQuery: string
  powderManufacturer: string
  bulletQuery: string
  bulletManufacturer: string
  fitCartridge: string
  federation: string
  discipline: string
  face: string
}

/** One query: the ids and the total the SQL layer answers, and the same from the catalogue. */
type Query = (db: Db, catalogue: Catalogue) => Promise<{ sql: Answer; catalogue: Answer }>
type Answer = { total: number; items: object[] }

const all = { limit: 100000, offset: 0 }

const queries = (p: Params): Record<string, Query> => ({
  cartridges: async (db, c) => ({
    sql: await listCartridges(db, all),
    catalogue: c.cartridges(),
  }),
  'cartridges q': async (db, c) => ({
    sql: await listCartridges(db, { ...all, q: p.cartridgeQuery }),
    catalogue: c.cartridges({ q: p.cartridgeQuery }),
  }),
  'cartridges table': async (db, c) => ({
    sql: await listCartridges(db, { ...all, table: p.table }),
    catalogue: c.cartridges({ table: p.table }),
  }),
  'cartridges paged': async (db, c) => ({
    sql: await listCartridges(db, { limit: 2, offset: 1 }),
    catalogue: c.cartridges({ limit: 2, offset: 1 }),
  }),
  powders: async (db, c) => ({ sql: await listPowders(db, all), catalogue: c.powders() }),
  'powders q': async (db, c) => ({
    sql: await listPowders(db, { ...all, q: p.powderQuery }),
    catalogue: c.powders({ q: p.powderQuery }),
  }),
  'powders manufacturer': async (db, c) => ({
    sql: await listPowders(db, { ...all, manufacturer: p.powderManufacturer }),
    catalogue: c.powders({ manufacturer: p.powderManufacturer }),
  }),
  bullets: async (db, c) => ({ sql: await listBullets(db, all), catalogue: c.bullets() }),
  'bullets q': async (db, c) => ({
    sql: await listBullets(db, { ...all, q: p.bulletQuery }),
    catalogue: c.bullets({ q: p.bulletQuery }),
  }),
  'bullets manufacturer': async (db, c) => ({
    sql: await listBullets(db, { ...all, manufacturer: p.bulletManufacturer }),
    catalogue: c.bullets({ manufacturer: p.bulletManufacturer }),
  }),
  'bullets cartridge': async (db, c) => ({
    sql: await listBullets(db, { ...all, cartridge: p.fitCartridge }),
    catalogue: c.bullets({ cartridge: p.fitCartridge }),
  }),
  manufacturers: async (db, c) => ({
    sql: await listManufacturers(db),
    catalogue: c.manufacturers(),
  }),
  'target faces': async (db, c) => ({
    sql: await listTargetFaces(db),
    catalogue: c.targetFaces(),
  }),
  federations: async (db, c) => ({
    sql: await listFederations(db),
    catalogue: c.federations(),
  }),
  disciplines: async (db, c) => ({
    sql: await listDisciplines(db, { federation: p.federation }),
    catalogue: c.disciplines({ federation: p.federation }),
  }),
  'target mappings': async (db, c) => ({
    sql: await listTargetMappings(db, { discipline: p.discipline, face: p.face }),
    catalogue: c.targetMappings({ discipline: p.discipline, face: p.face }),
  }),
})

const sets: { name: string; bundle: () => Bundle; params: Params }[] = [
  {
    name: 'synthetic records',
    bundle: () => rich,
    params: {
      cartridgeQuery: 'alpha',
      table: 'I',
      powderQuery: 'fast',
      powderManufacturer: 'example-a',
      bulletQuery: 'bullet',
      bulletManufacturer: 'example-b',
      fitCartridge: 'delta-rifle',
      federation: 'test-federation',
      discipline: 'test-discipline',
      face: 'test-face',
    },
  },
  {
    name: 'public bundle',
    bundle: loadBundle,
    params: {
      cartridgeQuery: 'win',
      table: 'I',
      powderQuery: 'demo',
      powderManufacturer: 'demo-powder',
      bulletQuery: 'demo',
      bulletManufacturer: 'demo-bullets',
      fitCartridge: '308-win',
      federation: 'issf',
      discipline: 'issf-10m-air-rifle',
      face: 'issf-10m-air-rifle',
    },
  },
]

for (const set of sets)
  describe(`the SQL layer and the catalogue answer alike, ${set.name}`, () => {
    let db: Db
    let catalogue: Catalogue
    beforeAll(async () => {
      const data = set.bundle()
      db = await createTestDb()
      await seedBundle(db, data)
      catalogue = openCatalogue(buildCatalogue(data))
    })
    afterAll(() => closeTestDb(db))

    for (const [name, run] of Object.entries(queries(set.params)))
      it(`answers "${name}" with the same ids and total`, async () => {
        const { sql, catalogue: mine } = await run(db, catalogue)
        // the orders differ (the database collation against the sort key), the ids do not
        const sorted = (a: Answer) => a.items.map((i) => (i as { id: string }).id).sort(compareKeys)
        // no query passes on two empty answers
        expect(sql.total).toBeGreaterThan(0)
        expect(mine.total).toBe(sql.total)
        if (name === 'cartridges paged') expect(mine.items).toHaveLength(sql.items.length)
        else {
          expect(sorted(mine)).toEqual(sorted(sql))
          // the items too: what the route answers today is what the catalogue lists
          const byId = (a: Answer) => new Map(a.items.map((i) => [(i as { id: string }).id, i]))
          expect(byId(mine)).toEqual(byId(sql))
        }
      })
  })

/** The competition lists have one order in both layers: the comparators of the schema package. */
const competitionOrder: Record<string, Query> = {
  'target faces': queries({} as Params)['target faces'],
  federations: queries({} as Params).federations,
  disciplines: async (db, c) => ({
    sql: await listDisciplines(db, {}),
    catalogue: c.disciplines(),
  }),
  'target mappings': async (db, c) => ({
    sql: await listTargetMappings(db, {}),
    catalogue: c.targetMappings(),
  }),
}

for (const set of sets)
  describe(`the competition lists have the same order, ${set.name}`, () => {
    let db: Db
    let catalogue: Catalogue
    beforeAll(async () => {
      const data = set.bundle()
      db = await createTestDb()
      await seedBundle(db, data)
      catalogue = openCatalogue(buildCatalogue(data))
    })
    afterAll(() => closeTestDb(db))

    for (const [name, run] of Object.entries(competitionOrder))
      it(`lists the ${name} in the same order`, async () => {
        const { sql, catalogue: mine } = await run(db, catalogue)
        const ids = (a: Answer) => a.items.map((i) => (i as { id: string }).id)
        expect(sql.total).toBeGreaterThan(0)
        expect(ids(mine)).toEqual(ids(sql))
      })
  })

/** The record routes of each kind with the SQL layer's answer for an id. */
const recordRoutes: {
  path: string
  ids: (b: Bundle) => string[]
  sql: (db: Db, id: string) => unknown
}[] = [
  { path: 'cartridges', ids: (b) => b.cartridges.map((r) => r.id), sql: getCartridge },
  { path: 'manufacturers', ids: (b) => b.manufacturers.map((r) => r.id), sql: getManufacturer },
  { path: 'powders', ids: (b) => b.powders.map((r) => r.id), sql: getPowder },
  { path: 'bullets', ids: (b) => b.bullets.map((r) => r.id), sql: getBullet },
  { path: 'target-faces', ids: (b) => b.targetFaces.map((r) => r.id), sql: getTargetFace },
  { path: 'federations', ids: (b) => b.federations.map((r) => r.id), sql: getFederation },
  { path: 'disciplines', ids: (b) => b.disciplines.map((r) => r.id), sql: getDiscipline },
  { path: 'target-mappings', ids: (b) => b.targetMappings.map((r) => r.id), sql: getTargetMapping },
]

for (const set of sets)
  describe(`the record routes answer as the SQL layer did, ${set.name}`, () => {
    let db: Db
    let app: ReturnType<typeof buildApp>
    beforeAll(async () => {
      const data = set.bundle()
      db = await createTestDb()
      await seedBundle(db, data)
      app = buildApp({ catalogue: openCatalogue(buildCatalogue(data)) })
    })
    afterAll(async () => {
      await app.close()
      await closeTestDb(db)
    })

    for (const { path, ids, sql } of recordRoutes)
      it(`answers every ${path} record with the same body`, async () => {
        const all = ids(set.bundle())
        expect(all.length).toBeGreaterThan(0)
        for (const id of all) {
          const res = await app.inject({ url: `${API_PREFIX}/${path}/${id}` })
          expect(res.statusCode).toBe(200)
          expect(res.json(), id).toEqual(JSON.parse(JSON.stringify(await sql(db, id))))
        }
      })
  })

describe('where the catalogue goes beyond the SQL layer', () => {
  it('has a bullet fit for an unknown cartridge and one without its values: none, as in SQL', async () => {
    const db = await createTestDb()
    await seedBundle(db, rich)
    const catalogue = openCatalogue(buildCatalogue(rich))
    for (const cartridge of ['unknown', 'beta-pistol']) {
      expect(catalogue.bullets({ cartridge })).toEqual({ total: 0, items: [] })
      expect(await listBullets(db, { ...all, cartridge })).toEqual({ total: 0, items: [] })
    }
    // 7.855 sits on the bound G1 + 0.005, 7.7 under the middle of F and Z (7.77)
    expect(
      catalogue
        .bullets({ cartridge: 'delta-rifle' })
        .items.map((b) => b.id)
        .sort(compareKeys),
    ).toEqual(['example-a-1', 'example-b-1'])
    await closeTestDb(db)
  })

  it('finds words in any order and the printed form of a number, which ilike does not', async () => {
    const db = await createTestDb()
    await seedBundle(db, rich)
    const catalogue = openCatalogue(buildCatalogue(rich))
    for (const q of ['rifle alpha', 'alpha 7.62']) {
      expect(catalogue.cartridges({ q }).total).toBe(1)
      expect((await listCartridges(db, { ...all, q })).total).toBe(0)
    }
    await closeTestDb(db)
  })
})
