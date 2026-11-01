import { readFileSync } from 'node:fs'
import { interiorBody } from '@open-reloading/api/compute'
import { recordResistance } from '@open-reloading/core'
import { powder } from '@open-reloading/schema'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { exampleInterior } from '../src/lib/example-data.ts'
import { interiorRequest } from '../src/lib/interior-request.ts'
import { tuneBaseKey, tuneLoadKey, writeTuneLoad } from '../src/lib/powder-tune.ts'
import { readTuneBase, readTuneLoad, readTuneTable } from '../src/lib/tune-load.ts'

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
const record = JSON.parse(
  readFileSync(
    new URL('../../../packages/data/records/powders/demo-powder-dp40.json', import.meta.url),
    'utf8',
  ),
)
// the record names its source by id; the schema needs a title
record.provenance.sources[0].title = 'Synthetic test data'
const demo = powder.parse(record)

it('hands the tuning route the load the workbench runs, as its run parses it', () => {
  const { body } = interiorRequest({ values, powder: undefined, boreArea: 4.7e-5 })
  writeTuneLoad('user:a', body.load)
  expect(readTuneLoad('user:a')).toStrictEqual(interiorBody.parse(body).load)
  expect(readTuneLoad('user:b')).toBeUndefined()
})

it('hands the CIP table of the cartridge record with the load, and removes it with the load', () => {
  const { body } = interiorRequest({ values, powder: undefined })
  writeTuneLoad('user:a', body.load, undefined, 'IV')
  expect(readTuneTable('user:a')).toBe('IV')
  writeTuneLoad('user:a', undefined, undefined, 'IV')
  expect(readTuneTable('user:a')).toBeUndefined()
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

it('hands over the powder record with the load, and nothing for a damaged one', () => {
  const { body } = interiorRequest({ values, powder: demo })
  writeTuneLoad('user:a', body.load, demo)
  expect(readTuneBase('user:a')).toStrictEqual(demo)
  expect(readTuneBase('user:b')).toBeUndefined()
  sessionStorage.setItem(tuneBaseKey('user:a'), '{"name":"no id"}')
  expect(readTuneBase('user:a')).toBeUndefined()
  sessionStorage.setItem(tuneBaseKey('user:a'), '{')
  sessionStorage.setItem(tuneLoadKey('user:a'), '{')
  expect(readTuneBase('user:a')).toBeUndefined()
  expect(readTuneLoad('user:a')).toBeUndefined()
})

it('reads nothing handed over where session storage is blocked', () => {
  const blocked = () => {
    throw new DOMException('Blocked.', 'SecurityError')
  }
  vi.stubGlobal('sessionStorage', { getItem: blocked })
  expect(readTuneLoad('user:a')).toBeUndefined()
  expect(readTuneBase('user:a')).toBeUndefined()
})

it("applies the powder record's bore resistance with the loaded cartridge's groove diameter", () => {
  const cartridge = { id: '308-win', g1: 7.85 }
  const r = interiorRequest({
    values,
    powder: demo,
    cartridge,
    groove: { id: '308-win', z: 7.82 },
    bulletLength: 30,
  })
  const { load } = r.body
  const law = recordResistance(demo, {
    boreDiameter: load.chamber.boreDiameter,
    boreArea: load.chamber.boreArea,
    startPressure: load.startPressure,
    cartridge: { g1: 7.85, z: 7.82 },
    bulletLengthMm: 30,
  })
  expect(r.missing).toEqual([])
  expect(load.resistance?.friction).toBeGreaterThan(0)
  expect(load.resistance?.friction).toBe(law.resistance?.friction)
})

it('names the groove diameter of a cartridge record not loaded yet, and runs without the law', () => {
  const r = interiorRequest({
    values,
    powder: demo,
    cartridge: { id: '308-win', g1: 7.85 },
    groove: { id: '223-rem', z: 5.69 },
    bulletLength: 30,
  })
  expect(r.missing).toEqual(["the cartridge record's groove diameter (not loaded)"])
  expect(r.body.load.resistance).toBeUndefined()
})

it('lets a typed bore friction replace the friction of the law', () => {
  const r = interiorRequest({ values: { ...values, boreFriction: 3e7 }, powder: demo })
  expect(r.body.load.resistance?.friction).toBe(3e7)
})

it("takes the record's bulk density and temperature sensitivity", () => {
  const sensitive = {
    ...demo,
    bulkDensity: { value: 0.95 },
    temperatureSensitivity: {
      reference: { value: 294.15 },
      cold: { value: 0.001 },
      hot: { value: 0.002 },
    },
  }
  const r = interiorRequest({ values, powder: sensitive })
  expect(r.bulkDensity).toBeCloseTo(950, 9)
  expect(r.body.load.propellant.temperatureSensitivity).toEqual({
    reference: 294.15,
    cold: 0.001,
    hot: 0.002,
  })
  // the demo powder has none of its own: it takes the default of its grain form, extruded
  expect(demo.temperatureSensitivity).toBeUndefined()
  expect(
    interiorRequest({ values, powder: demo }).body.load.propellant.temperatureSensitivity,
  ).toMatchObject({ hot: 0.001, cold: 0.001 })
})

it('sends no bore resistance without a powder record or a link', () => {
  const r = interiorRequest({ values, powder: undefined })
  expect(r.bulkDensity).toBeUndefined()
  expect(r.body.load.resistance).toBeUndefined()
})

it('gives a powder without its own coefficient the default of its grain form, and says so', () => {
  const { temperatureSensitivity: _, ...without } = demo
  const ball = interiorRequest({ values, powder: { ...without, grainForm: 'ball' } })
  expect(ball.body.load.propellant.temperatureSensitivity).toMatchObject({
    hot: 0.0027,
    cold: 0.0012,
  })
  expect(ball.sensitivityDefault?.form).toBe('ball')
  // the reference is the fitted propellant temperature of the record, else 21 °C
  const reference = without.interior
    ? without.interior.propellantTemperature.value + 273.15
    : 294.15
  expect(ball.body.load.propellant.temperatureSensitivity?.reference).toBeCloseTo(reference, 9)
  const other = interiorRequest({ values, powder: { ...without, grainForm: 'other' } })
  expect(other.body.load.propellant.temperatureSensitivity).toBeUndefined()
  expect(other.sensitivityDefault).toBeUndefined()
  expect(interiorRequest({ values, powder: undefined }).sensitivityDefault).toBeUndefined()
})
