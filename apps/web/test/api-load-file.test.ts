import { startBundleApi } from '@rangefoundry/api/static'
import { type Load, load as loadSchema, type UserRecord } from '@rangefoundry/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { apiFileRecords, type LoadParts, toApiLoad, toLoad } from '../src/lib/load-record.ts'
import { userDataText } from '../src/lib/user-data.ts'

let api: Awaited<ReturnType<typeof startBundleApi>>
beforeAll(async () => {
  api = await startBundleApi()
})
afterAll(() => api?.close())

/** The SI values of a load the workbench holds after Run, every field filled. */
const values = {
  volume: 3.6e-6,
  boreDiameter: 0.00762,
  boreArea: 4.751e-5,
  travel: 0.5334,
  twist: 0.254,
  bulletMass: 0.010886,
  charge: 0.0024,
  propellantEnergy: 3950000,
  gamma: 1.215,
  density: 1600,
  covolume: 0.00097,
  vivacity: 0.612,
  exponent: 1,
  referencePressure: 98066.5,
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 2.5e7,
  firearmMass: 3.7,
}

const parts = (over: Partial<LoadParts> = {}): LoadParts => ({
  values,
  given: new Set(),
  cartridge: 'catalogue:308-win',
  bullet: 'catalogue:demo-bullet-168',
  powder: 'catalogue:demo-powder-dp40',
  notes: '',
  sessions: [],
  ...over,
})

/** A load record of the file for the API holding `data`. */
const loadRecord = (data: Load) =>
  ({
    kind: 'load',
    id: crypto.randomUUID(),
    name: 'Load',
    saved: new Date().toISOString(),
    data,
  }) as const

/** `POST /interior/load-file` with `data` as the one load of a file. */
const runFile = (data: Load) => postFile([loadRecord(data)])

/** `POST /interior/load-file` with a file of `records`. */
async function postFile(records: UserRecord[]) {
  const text = userDataText(records)
  const res = await api.app.inject({
    method: 'POST',
    url: '/v1/interior/load-file',
    payload: JSON.parse(text),
  })
  return { status: res.statusCode, body: res.json() }
}

describe('toApiLoad', () => {
  it('writes every value of the moment, so the route runs the file as it is', async () => {
    const given = new Set(Object.keys(values))
    // the saved load stores the typed keys only: with everything given it holds none
    expect(toLoad(parts({ given })).analysis?.overrides).toBeUndefined()
    const file = toApiLoad(parts({ given }), { cartridge: 'catalogue:308-win' })
    expect(Object.keys(file.analysis?.overrides ?? {})).toHaveLength(Object.keys(values).length - 1)
    expect(loadSchema.safeParse(file).success).toBe(true)
    const { status, body } = await runFile(file)
    expect(status).toBe(200)
    expect(body.summary.peakPressure).toBeGreaterThan(0)
  })

  it('runs with the catalogue references of the loaded records, not the id asked for', async () => {
    const refs = {
      cartridge: 'catalogue:308-win',
      bullet: 'catalogue:demo-bullet-168',
      powder: 'catalogue:demo-powder-dp40',
    }
    // the powder id the load keeps may be one no record answered: the file drops it
    expect(toApiLoad(parts({ powder: 'catalogue:unloaded' }), {}).powder).toBeUndefined()
    const file = toApiLoad(parts({ powder: 'catalogue:unloaded' }), refs)
    expect(file).toMatchObject(refs)
    expect((await runFile(file)).status).toBe(200)
  })

  it('answers the same load saved with typed keys only by one 422 that names each missing key', async () => {
    const given = new Set(['volume', 'twist', 'gamma', 'vivacity'])
    const saved = toLoad(parts({ given, powder: undefined }))
    const { status, body } = await runFile(saved)
    expect(status).toBe(422)
    expect(body.missing.map((m: { key: string }) => m.key)).toEqual([
      'volume',
      'twist',
      'gamma',
      'vivacity',
    ])
    expect(
      (
        await runFile(
          toApiLoad(parts({ given, powder: undefined }), { cartridge: 'catalogue:308-win' }),
        )
      ).status,
    ).toBe(200)
  })

  it("runs a load on the user's own cartridge with its design in the file, and refuses one without a cartridge", async () => {
    const design = {
      id: '5b0e6f8a-2c41-4d7e-9a13-7f2c8e4b6d01',
      name: 'My 308',
      data: { origin: 'user', basedOn: 'catalogue:308-win' } as const,
    }
    const ref = `user:${design.id}`
    const record = loadRecord(toApiLoad(parts({ cartridge: ref }), { cartridge: ref }))
    const records = apiFileRecords(record, design)
    expect(records.map((r) => r.kind)).toEqual(['load', 'cartridge'])
    const { status, body } = await postFile(records)
    expect(status).toBe(200)
    expect(body.summary.peakPressure).toBeGreaterThan(0)
    // the reference alone, without the design, names nothing the server has
    expect((await postFile([record])).status).toBe(400)
    const bare = await runFile(toApiLoad(parts({ cartridge: undefined }), {}))
    expect(bare.status).toBe(422)
    expect(bare.body.field).toBe('records.0.data.cartridge')
  })

  it('leaves out what the API cannot read: a user reference, the firearm, the capacity, sessions and a seating ladder', () => {
    const seating = { kind: 'seating', stepCount: 3, step: 0.0005, direction: 'around' } as const
    const file = toApiLoad(
      parts({
        firearm: `user:${crypto.randomUUID()}`,
        capacity: 'catalogue:x',
        ladder: seating,
        sessions: ['user:11111111-1111-4111-8111-111111111111'],
      }),
      {},
    )
    expect(file.cartridge).toBeUndefined()
    expect(file.bullet).toBeUndefined()
    expect(file.powder).toBeUndefined()
    expect(file.firearm).toBeUndefined()
    expect(file.capacity).toBeUndefined()
    expect(file.sessions).toBeUndefined()
    expect(file.analysis?.ladder).toBeUndefined()
    const charge = toApiLoad(
      parts({ ladder: { kind: 'charge', stepCount: 3, step: 1e-4, direction: 'up' } }),
      {},
    )
    expect(charge.analysis?.ladder).toMatchObject({ stepCount: 3, direction: 'up' })
  })
})
