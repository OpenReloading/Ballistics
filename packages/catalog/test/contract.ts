// Every way the catalogue is opened (in memory, the API server, the static site, the CLI) answers these alike.
import { beforeAll, describe, expect, it } from 'vitest'
import type { Catalogue, CatalogueKind, CataloguePage } from '../src/catalogue.ts'
import type { Bundle } from '../src/records.ts'
import { bundle } from './bundle.ts'

/** Opens the catalogue of a bundle the way one consumer does. */
export type OpenCatalogue = (bundle: Bundle) => Catalogue | Promise<Catalogue>

type List = (c: Catalogue) => CataloguePage<{ id: string }>

/** A list query of the fixture bundle, the ids it answers in order, and its total before paging. */
const lists: [string, List, string[], number?][] = [
  [
    'cartridges by name',
    (c) => c.cartridges(),
    ['alpha-rifle', 'beta-pistol', 'gamma-100-percent'],
  ],
  ['cartridges of a C.I.P. table', (c) => c.cartridges({ table: 'IV' }), ['beta-pistol']],
  ['a page of cartridges', (c) => c.cartridges({ limit: 1, offset: 1 }), ['beta-pistol'], 3],
  ['cartridges found by a query', (c) => c.cartridges({ q: 'beta' }), ['beta-pistol']],
  [
    'manufacturers by name',
    (c) => c.manufacturers(),
    ['example-a', 'example-b', 'example-c', 'example-f'],
  ],
  ['powders by maker and name', (c) => c.powders(), ['example-a-fast', 'example-b-slow']],
  ['powders of a maker', (c) => c.powders({ manufacturer: 'example-b' }), ['example-b-slow']],
  [
    'primers by maker and name',
    (c) => c.primers(),
    ['example-a-large-rifle', 'example-a-small-pistol', 'example-b-large-rifle-magnum'],
  ],
  [
    'primers of a size',
    (c) => c.primers({ size: 'large-rifle' }),
    ['example-a-large-rifle', 'example-b-large-rifle-magnum'],
  ],
  [
    'primers of a compound',
    (c) => c.primers({ compound: 'lead-free' }),
    ['example-a-small-pistol'],
  ],
  ['bullets by maker and name', (c) => c.bullets(), ['example-a-1']],
  [
    'no bullets for a cartridge without G1, F or Z',
    (c) => c.bullets({ cartridge: 'alpha-rifle' }),
    [],
  ],
  ['cases by maker and name', (c) => c.cases(), ['alpha-brass', 'beta-brass', 'alpha-steel']],
  [
    'cases of a cartridge',
    (c) => c.cases({ cartridge: 'alpha-rifle' }),
    ['alpha-brass', 'alpha-steel'],
  ],
  ['target faces', (c) => c.targetFaces(), ['test-face']],
  ['federations', (c) => c.federations(), ['test-federation']],
  [
    'disciplines of a federation',
    (c) => c.disciplines({ federation: 'test-federation' }),
    ['test-discipline'],
  ],
  ['no disciplines of an unknown federation', (c) => c.disciplines({ federation: 'none' }), []],
  [
    'target mappings of a discipline and a face',
    (c) => c.targetMappings({ discipline: 'test-discipline', face: 'test-face' }),
    ['test-discipline-test-face'],
  ],
  ['caliber classes', (c) => c.caliberClasses(), ['air-4-5']],
  ['event types', (c) => c.eventTypes(), ['test-championship']],
]

/** Kind, id, revision and name where it has one; a revision changes with any field of the stored record, so update it with the fixture. */
const records: [CatalogueKind, string, string, string?][] = [
  ['cartridge', 'alpha-rifle', '1d2713937e50c5', 'Alpha Rifle'],
  ['manufacturer', 'example-a', '137c9d55f895bd', 'Example A'],
  ['powder', 'example-a-fast', '19e0478241d44d', 'Fast'],
  ['primer', 'example-a-large-rifle', '10f3c2652460d4', 'Large Rifle'],
  ['bullet', 'example-a-1', '001abc6b0beec5', 'Test 168'],
  ['case', 'alpha-brass', '0fc76454c0c1ef', 'Alpha Brass'],
  ['caseCapacity', 'alpha-rifle-test', '1634ea6acba1ee'],
  ['targetFace', 'test-face', '0ad5cb203143c5', 'Test Face'],
  ['federation', 'test-federation', '1de7b755784a79', 'Test Federation'],
  ['discipline', 'test-discipline', '1c3619c5c4c31b', 'Test discipline'],
  ['targetMapping', 'test-discipline-test-face', '1487636e7e4668'],
  ['caliberClass', 'air-4-5', '1d5d128ae27e4d', '4.5 mm (.177) air'],
  ['eventType', 'test-championship', '0b6d36f7b9213b', 'Test championship'],
]

/** The SHA-256 of every record of the fixture bundle: update it with the fixture or the record file's header. */
const fixtureDataHash = '54d3b177acab15454234f7d3b6ada5ea64a547ddf4d97d03bb07b7c7cdc8df67'

/** The lists of the contract, which every opener answers, the static site's index included. */
export function catalogueListContract(name: string, open: OpenCatalogue): void {
  describe(`${name}: the lists of the Catalogue contract`, () => {
    let catalogue: Catalogue
    beforeAll(async () => {
      catalogue = await open(bundle)
    })
    it.each(lists)('%s', (_, list, ids, total = ids.length) => {
      const page = list(catalogue)
      expect(page.items.map((item) => item.id)).toEqual(ids)
      expect(page.total).toBe(total)
    })
  })
}

/** The records of the contract: `get`, `capacities` and `dataHash`, for an opener that holds the record file. */
export function catalogueRecordContract(name: string, open: OpenCatalogue): void {
  describe(`${name}: the records of the Catalogue contract`, () => {
    let catalogue: Catalogue
    beforeAll(async () => {
      catalogue = await open(bundle)
    })
    it.each(records)('answers the %s %s', (kind, id, revision, recordName) => {
      expect(catalogue.get(kind, id)).toMatchObject({
        id,
        kind,
        origin: 'catalogue',
        revision,
        ...(recordName && { name: recordName }),
      })
    })
    it('answers nothing for an unknown id or an id of another kind', () => {
      expect(catalogue.get('cartridge', 'none')).toBeUndefined()
      expect(catalogue.get('bullet', 'example-a-fast')).toBeUndefined()
    })
    it('lists the capacities of a cartridge', () => {
      expect(catalogue.capacities('alpha-rifle').map((c) => c.id)).toEqual(['alpha-rifle-test'])
      expect(catalogue.capacities('beta-pistol')).toEqual([])
    })
    it('hashes the whole data set, the same on every call', async () => {
      expect(await catalogue.dataHash()).toBe(fixtureDataHash)
      expect(await catalogue.dataHash()).toBe(fixtureDataHash)
    })
  })
}
