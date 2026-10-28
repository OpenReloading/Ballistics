import { interiorBody } from '@open-reloading/api/compute'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { exampleInterior } from '../src/lib/example-data.ts'
import { interiorRequest } from '../src/lib/interior-request.ts'
import { tuneLoadKey, writeTuneLoad } from '../src/lib/powder-tune.ts'
import { readTuneLoad } from '../src/lib/tune-load.ts'

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  })
})
afterEach(() => vi.unstubAllGlobals())

const values = { ...exampleInterior, boreArea: undefined }

it('hands the tuning route the load the workbench runs, as its run parses it', () => {
  const { body } = interiorRequest({ values, powder: undefined, boreArea: 4.7e-5 })
  writeTuneLoad('user:a', body.load)
  expect(readTuneLoad('user:a')).toStrictEqual(interiorBody.parse(body).load)
  expect(readTuneLoad('user:b')).toBeUndefined()
})

it('removes the load of an edit not saved, and refuses one the run would refuse', () => {
  const { body } = interiorRequest({ values, powder: undefined })
  writeTuneLoad('user:a', body.load)
  writeTuneLoad('user:a', undefined)
  expect(readTuneLoad('user:a')).toBeUndefined()
  sessionStorage.setItem(tuneLoadKey('user:a'), '{"charge":"x"}')
  expect(readTuneLoad('user:a')).toBeUndefined()
})

it('takes the bore area of the record for an empty field, the typed one first', () => {
  expect(
    interiorRequest({ values, powder: undefined, boreArea: 4.7e-5 }).body.load.chamber.boreArea,
  ).toBe(4.7e-5)
  const typed = { ...values, boreArea: 4.6e-5 }
  expect(
    interiorRequest({ values: typed, powder: undefined, boreArea: 4.7e-5 }).body.load.chamber
      .boreArea,
  ).toBe(4.6e-5)
})

it('lays the bore resistance a link carried over a missing powder record', () => {
  const linked = { bulkDensity: 900, boreFriction: 2e7 }
  const r = interiorRequest({ values, powder: undefined, linked })
  expect(r.bulkDensity).toBe(900)
  expect(r.missing).toEqual([])
  expect(r.body.load.resistance).toBeDefined()
})
