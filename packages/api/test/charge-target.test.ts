import {
  chargeUpperBound,
  interior,
  interiorPressureRange,
  pressureToleranceDefaults,
} from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { chargeTargetExample } from '../src/compute/charge-schema.ts'
import { ComputeBusy } from '../src/compute/tasks.ts'
import { buildOpenApi } from '../src/openapi.ts'
import { API_PREFIX, API_VERSION } from '../src/version.ts'
import { bundle, m3Load as load } from './fixtures.ts'
import { testCatalogue, withApi } from './setup.ts'

/** The charge route's run configuration (`interiorApiDefaults`, `caps.chargeSteps`). */
const config = { maxTime: 0.04, maxSteps: 10000 }
const nominal = (() => {
  const r = interior(load, config)
  if (!r.valid) throw new Error(r.reason)
  return r
})()

const testSource = { kind: 'published' as const, sources: [{ title: 'Test sheet' }] }
/** A cartridge with one CIP Pmax, bar; the numbers are made up. */
function limitCartridge(id: string, pmax: number, pressureMethod: 'transducer' | 'crusher') {
  return {
    id,
    name: id,
    table: 'I',
    published: '2020-01-01',
    pressureMethod,
    verification: 'unverified' as const,
    values: [{ symbol: 'Pmax', quantity: 'pressure' as const, value: pmax }],
    provenance: testSource,
  }
}

// twice the nominal peak: 50 % of the limit is the nominal peak pressure
const seeded = [
  limitCartridge('twice-rifle', (2 * nominal.peakBreechPressure) / 1e5, 'transducer'),
  limitCartridge('crusher-rifle', 3000, 'crusher'),
]
// a bulk density above the 5000 kg/m3 bound of a request body
const dense = {
  id: 'example-a-dense',
  manufacturer: 'example-a',
  name: 'Dense',
  bulkDensity: { value: 6 },
  provenance: testSource,
}
const api = withApi({
  seed: {
    ...bundle,
    cartridges: [...bundle.cartridges, ...seeded],
    powders: [...bundle.powders, dense],
  },
})
const post = (payload: unknown) => api.post(`${API_PREFIX}/interior/charge-target`, payload)

const notice = 'simulation, not load data'
const json = (value: unknown) => JSON.parse(JSON.stringify(value))

describe('POST /interior/charge-target', () => {
  it('returns the charge, its single run and the pressure range at that charge', async () => {
    const target = { kind: 'peakPressure', value: nominal.peakBreechPressure }
    const { status, body } = await post({ load: { ...load, charge: 0.001 }, target })
    expect(status).toBe(200)
    expect(body.notice).toBe(notice)
    expect(body.relativeTolerance).toBe(1e-6)
    expect(Math.abs(body.achievedValue - target.value)).toBeLessThanOrEqual(1e-6 * target.value)
    expect(Math.abs(body.charge - 0.0028) / 0.0028).toBeLessThan(1e-3)
    // the same run and range as POST /interior at the solved charge
    const run = interior({ ...load, charge: body.charge }, config)
    if (!run.valid) throw new Error(run.reason)
    const { points: _points, ...summary } = run
    expect(body.result).toEqual(json(summary))
    expect(body.pressureRange).toEqual(
      json(
        interiorPressureRange(
          { ...load, charge: body.charge },
          run.peakBreechPressure,
          pressureToleranceDefaults,
          config,
        ),
      ),
    )
    expect(body.reachable.minValue.value).toBeLessThan(target.value)
    expect(body.reachable.maxValue.value).toBeGreaterThan(target.value)
    // the charge of an extreme gives the extreme's value in one run
    const atHigh = interior({ ...load, charge: body.reachable.maxValue.charge }, config)
    if (!atHigh.valid) throw new Error(atHigh.reason)
    expect(atHigh.peakBreechPressure).toBe(body.reachable.maxValue.value)
    expect(body.warnings.map((w: { code: string }) => w.code)).toEqual(['noCartridge'])
  })

  it('solves each target kind', async () => {
    for (const [kind, value] of [
      ['muzzleVelocity', nominal.muzzleVelocity],
      ['barrelTime', nominal.barrelTime],
      ['bulletLeadTime', nominal.muzzleTime - nominal.tenPercentPressureTime],
    ] as const) {
      const { status, body } = await post({ load, target: { kind, value } })
      expect(status).toBe(200)
      expect(Math.abs(body.achievedValue - value)).toBeLessThanOrEqual(1e-6 * value)
    }
    const ratio = await post({
      load: { ...load, propellant: { ...load.propellant, bulkDensity: 900 } },
      target: { kind: 'loadRatio', value: 0.8 },
    })
    expect(ratio.status).toBe(200)
    expect(ratio.body.charge).toBeCloseTo(0.8 * 900 * load.chamber.volume, 8)
  })

  it('reads a pressure target as a percentage of the compared cartridge limit', async () => {
    const { status, body } = await post({
      load,
      cartridge: 'twice-rifle',
      target: { kind: 'peakPressure', value: 50, unit: 'percentOfLimit' },
    })
    expect(status).toBe(200)
    expect(body.target.percentOfLimit).toBe(50)
    expect(body.target.limit).toMatchObject({
      cartridge: 'twice-rifle',
      revised: '2020-01-01',
      symbol: 'Pmax',
    })
    expect(Math.abs(body.achievedValue - nominal.peakBreechPressure)).toBeLessThanOrEqual(
      1e-6 * nominal.peakBreechPressure,
    )
    expect(body.limits[0]).toMatchObject({ compared: true })
    expect(body.resolved.cartridge.id).toBe('twice-rifle')
  })

  it('refuses a percentage without a compared limit', async () => {
    const target = { kind: 'peakPressure', value: 50, unit: 'percentOfLimit' }
    for (const cartridge of [undefined, 'crusher-rifle']) {
      const { status, body } = await post({ load, cartridge, target })
      expect(status).toBe(422)
      expect(body).toMatchObject({ reason: 'noComparableLimit', notice })
    }
  })

  it('refuses a target outside the reachable range with the reason and the range', async () => {
    const { status, body } = await post({
      load: { ...load, propellant: { ...load.propellant, bulkDensity: 900 } },
      target: { kind: 'peakPressure', value: 1e11 },
    })
    expect(status).toBe(422)
    expect(body).toMatchObject({ reason: 'aboveRange', notice })
    expect(body.reachable.maxValue.value).toBeLessThan(1e11)
    expect(body.reachable.minValue.charge).toBeLessThan(body.reachable.maxValue.charge)
    const low = await post({ load, target: { kind: 'muzzleVelocity', value: 1 } })
    expect(low.body.reason).toBe('belowRange')
  })

  it('names the failure of the first scanned run where no charge gives a valid run', async () => {
    const { status, body } = await post({
      load: { ...load, startPressure: 1e18 },
      target: { kind: 'peakPressure', value: 1e8 },
    })
    const first = interior(
      { ...load, startPressure: 1e18, charge: chargeUpperBound(load) * 1e-3 },
      config,
    )
    if (first.valid) throw new Error('invalid run expected')
    expect(status).toBe(422)
    expect(body).toMatchObject({ reason: 'noValidRun', failure: { reason: first.reason }, notice })
    expect(body.message).toContain(`interior ${first.reason}`)
  })

  it('caps options.maxSteps at the charge solver cap', async () => {
    const target = { kind: 'peakPressure', value: 1e8 }
    expect((await post({ load, target, options: { maxSteps: 10001 } })).status).toBe(400)
    expect((await post({ load, target, options: { maxSteps: 10000 } })).status).toBe(200)
  })

  it('answers 400 with the notice for unknown keys and a load ratio without bulk density', async () => {
    const target = { kind: 'peakPressure', value: 1e8 }
    const unknown = await post({ load, target, extra: 1 })
    expect(unknown.status).toBe(400)
    expect(unknown.body.notice).toBe(notice)
    expect((await post({ load, target, maximumPressure: 3e8 })).status).toBe(400)
    const ratio = await post({ load, target: { kind: 'loadRatio', value: 0.8 } })
    expect(ratio.status).toBe(400)
    const unit = await post({
      load,
      target: { kind: 'muzzleVelocity', value: 1, unit: 'percentOfLimit' },
    })
    expect(unit.status).toBe(400)
  })

  it("takes a load ratio's bulk density from the powder record unless the load states one", async () => {
    const target = { kind: 'loadRatio', value: 0.8 }
    const record = await post({ load, target, powder: 'example-a-fast' })
    expect(record.status).toBe(200)
    // 0.9 g/cm3 in the record
    expect(record.body.charge).toBeCloseTo(0.8 * 900 * load.chamber.volume, 8)
    expect(record.body.resolved.powder.suppliedFields).toEqual(['bulkDensity'])
    const stated = await post({
      load: { ...load, propellant: { ...load.propellant, bulkDensity: 1000 } },
      target,
      powder: 'example-a-fast',
    })
    expect(stated.body.charge).toBeCloseTo(0.8 * 1000 * load.chamber.volume, 8)
    expect(stated.body.resolved.powder.suppliedFields).toEqual([])
  })

  it('refuses a load ratio for a powder without a bulk density and a record density out of bounds', async () => {
    const target = { kind: 'loadRatio', value: 0.8 }
    const none = await post({ load, target, powder: 'example-b-slow' })
    expect(none.status).toBe(422)
    expect(none.body).toMatchObject({
      message: 'powder example-b-slow has no bulk density',
      notice,
    })
    const high = await post({ load, target, powder: 'example-a-dense' })
    expect(high.status).toBe(422)
    expect(high.body.message).toBe(
      'powder example-a-dense bulk density 6000 kg/m3 must be above 0 and at most 5000 kg/m3',
    )
  })

  it('answers 404 for an unknown cartridge or powder', async () => {
    const target = { kind: 'peakPressure', value: 1e8 }
    expect((await post({ load, target, cartridge: 'nope' })).status).toBe(404)
    expect((await post({ load, target, powder: 'nope' })).status).toBe(404)
  })

  it('stamps a solved answer with the input hash, API version and data hash', async () => {
    const { body } = await post({ load, target: { kind: 'peakPressure', value: 1e8 } })
    expect(body.inputHash).toMatch(/^[0-9a-f]{64}$/)
    expect(body.apiVersion).toBe(API_VERSION)
    expect(body.dataHash).toBe(await api.catalogue.dataHash())
  })

  it('answers 413 for a body above 256 KiB', async () => {
    const target = { kind: 'peakPressure', value: 1e8 }
    const res = await api.app.inject({
      method: 'POST',
      url: `${API_PREFIX}/interior/charge-target`,
      payload: { load, target, pad: 'x'.repeat(256 * 1024) },
    })
    expect(res.statusCode).toBe(413)
  })

  it('answers 503 with the notice and retry-after when the compute pool is full', async () => {
    const busy = buildApp({
      catalogue: testCatalogue(bundle),
      compute: {
        run: () => Promise.reject(new ComputeBusy('all compute workers are busy', 5)),
        close: async () => {},
      },
    })
    const res = await busy.inject({
      method: 'POST',
      url: `${API_PREFIX}/interior/charge-target`,
      payload: { load, target: { kind: 'peakPressure', value: 1e8 } },
    })
    await busy.close()
    expect(res.statusCode).toBe(503)
    expect(res.headers['retry-after']).toBe('5')
    expect(res.json()).toMatchObject({ reason: 'busy', notice })
  })

  it('documents its summary, statuses, example and answer schema', async () => {
    const operation = (await buildOpenApi()).paths[`${API_PREFIX}/interior/charge-target`]?.post
    expect(operation?.summary).toBe('Solve the charge for a target')
    expect(operation?.description).toContain('Results are simulations, not load data.')
    expect(Object.keys(operation?.responses ?? {})).toEqual([
      '200',
      '400',
      '404',
      '413',
      '415',
      '422',
      '500',
      '503',
    ])
    expect(operation?.requestBody?.content['application/json']?.example).toEqual(
      chargeTargetExample,
    )
    const answer = operation?.responses['200']?.content?.['application/json']?.schema
    expect(answer).toHaveProperty('properties.charge')
  })
})
