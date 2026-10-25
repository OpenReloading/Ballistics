import {
  chargeLadder,
  type InteriorLoad,
  icao,
  interior,
  interiorPressureRange,
  interiorSampledBand,
  lbPerSqInToKgPerSqM,
  millerStability,
  type Projectile,
  pressureToleranceDefaults,
  type TrajectoryInput,
  trajectory,
  trueDrag,
  trueMuzzleVelocity,
} from '@open-reloading/core'
import type { Cartridge } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { caps } from '../src/compute/schemas.ts'
import { stabilityBounds } from '../src/compute/stability-schema.ts'
import { API_PREFIX } from '../src/version.ts'
import { defined } from './defined.ts'
import { bundle, m3Load, rifleProjectile as projectile, rifleShot as shot } from './fixtures.ts'
import { withApi } from './setup.ts'

/** A bullet with G7 bands and a length, seeded only here; the numbers are made up. */
const banded = {
  id: 'example-a-2',
  manufacturer: 'example-a',
  productNumber: '2',
  name: 'Test 175',
  diameter: { value: 7.82 },
  mass: { value: 11.34 },
  length: { value: 31.2 },
  ballisticCoefficients: [
    { dragModel: 'G7' as const, value: 0.243 },
    { dragModel: 'G7' as const, value: 0.25, minVelocity: { value: 610 } },
  ],
  provenance: { kind: 'published' as const, sources: [{ title: 'Test catalog' }] },
}

/** Two G1 values without velocity bands, as records list alternatives (tip, test range). */
const alternatives = {
  ...banded,
  id: 'example-a-3',
  productNumber: '3',
  ballisticCoefficients: [
    { dragModel: 'G1' as const, value: 0.5 },
    { dragModel: 'G1' as const, value: 0.52 },
  ],
}

/** Powder records with a bulk density of 0 and one off by a factor of 1000 (g/cm3 as kg/m3). */
const zeroDensity = {
  id: 'example-c-zero',
  manufacturer: 'example-c',
  name: 'Zero',
  bulkDensity: { value: 0 },
  provenance: { kind: 'published' as const, sources: [{ title: 'Test chart' }] },
}
const unitError = {
  ...zeroDensity,
  id: 'example-c-unit',
  name: 'Unit',
  bulkDensity: { value: 900 },
}

/** A bullet of 500 g, outside the stability bound on mass. */
const heavy = { ...banded, id: 'example-a-4', productNumber: '4', mass: { value: 500 } }

const testSource = { kind: 'published' as const, sources: [{ title: 'Test sheet' }] }
/** A cartridge whose C.I.P. sheet holds `values`; the numbers are made up. */
function limitCartridge(id: string, values: Cartridge['values'], pressureMethod?: string) {
  return {
    id,
    name: id,
    table: 'I',
    published: '2020-01-01',
    ...(pressureMethod && { pressureMethod }),
    verification: 'unverified' as const,
    values,
    provenance: testSource,
  } as Cartridge
}

const m3Config = { maxTime: 0.04, maxSteps: 50000 }

// Pmax midway between the nominal peak and the high end of its range (bar)
const p0 = (interior(m3Load, m3Config) as { peakBreechPressure: number }).peakBreechPressure
const high = interiorPressureRange(m3Load, p0, pressureToleranceDefaults, m3Config).highPressure
const midway = (p0 + high) / 2 / 1e5
const seeded = [
  limitCartridge(
    'delta-rifle',
    [{ symbol: 'Pmax', quantity: 'pressure', value: midway }],
    'transducer',
  ),
  limitCartridge(
    'epsilon-rifle',
    [{ symbol: 'Pmax', quantity: 'pressure', value: 3000 }],
    'crusher',
  ),
]
const api = withApi({
  seed: {
    ...bundle,
    cartridges: [...bundle.cartridges, ...seeded],
    bullets: [...bundle.bullets, banded, alternatives, heavy],
    powders: [...bundle.powders, zeroDensity, unitError],
  },
})
const { post } = api

async function postRaw(url: string, payload: string) {
  const res = await api.app.inject({
    method: 'POST',
    url,
    payload,
    headers: { 'content-type': 'application/json' },
  })
  return { status: res.statusCode, body: res.json() }
}

const json = (value: unknown) => JSON.parse(JSON.stringify(value))

const ranges = [0, 100, 200, 300, 500]

/** The API defaults of `POST /interior`. */
describe('POST /exterior/trajectory', () => {
  it('returns the core trajectory for the same input', async () => {
    const { status, body } = await post(`${API_PREFIX}/exterior/trajectory`, { shot, ranges })
    expect(status).toBe(200)
    expect(body.result).toEqual(json(trajectory(shot, ranges, { maxSteps: 5000 })))
    expect(body.units.height).toBe('m')
    expect(body.resolved).toBeUndefined()
  })

  it('resolves a bullet id with the BCs of the drag model in SI', async () => {
    const ref = { bullet: 'example-a-2', dragModel: 'G7' }
    const { status, body } = await post(`${API_PREFIX}/exterior/trajectory`, {
      shot: { ...shot, projectile: ref },
      ranges,
    })
    expect(status).toBe(200)
    const want: Projectile = {
      mass: 11.34e-3,
      diameter: 7.82e-3,
      length: 31.2e-3,
      drag: {
        kind: 'bc',
        model: 'G7',
        bands: [
          { ballisticCoefficient: 0.243 * lbPerSqInToKgPerSqM, minVelocity: 0 },
          { ballisticCoefficient: 0.25 * lbPerSqInToKgPerSqM, minVelocity: 610 },
        ],
      },
    }
    expect(body.resolved.projectile).toEqual(want)
    expect(body.resolved.bullet).toEqual({
      id: 'example-a-2',
      manufacturer: 'example-a',
      name: 'Test 175',
      dragModel: 'G7',
      suppliedFields: ['mass', 'diameter', 'length', 'ballisticCoefficients'],
      provenance: banded.provenance,
    })
    expect(body.result).toEqual(
      json(trajectory({ ...shot, projectile: want }, ranges, { maxSteps: 5000 })),
    )
  })

  it('omits spin drift and jump for a record without length', async () => {
    const { status, body } = await post(`${API_PREFIX}/exterior/trajectory`, {
      shot: { ...shot, projectile: { bullet: 'example-a-1', dragModel: 'G1' } },
      ranges,
    })
    expect(status).toBe(200)
    expect(body.result.omitted).toEqual(expect.arrayContaining(['spinDrift', 'jump']))
    expect(body.resolved.bullet.suppliedFields).toEqual([
      'mass',
      'diameter',
      'ballisticCoefficients',
    ])
  })

  it('answers 404, 400 and 422 for bad bullet references', async () => {
    const send = (p: object) =>
      post(`${API_PREFIX}/exterior/trajectory`, { shot: { ...shot, projectile: p }, ranges })
    expect((await send({ bullet: 'unknown', dragModel: 'G7' })).status).toBe(404)
    expect((await send({ bullet: 'example-a-1' })).status).toBe(400)
    const noG7 = await send({ bullet: 'example-a-1', dragModel: 'G7' })
    expect(noG7.status).toBe(422)
    expect(noG7.body.message).toBe('bullet example-a-1 has no G7 ballistic coefficient')
    const twoG1 = await send({ bullet: 'example-a-3', dragModel: 'G1' })
    expect(twoG1.status).toBe(422)
    expect(twoG1.body.message).toBe(
      'bullet example-a-3 has 2 G1 values without distinct velocity bands; send drag explicitly',
    )
  })

  it('matches the vacuum drop with a zero drag curve', async () => {
    const v = 600
    const g = icao.gravity
    const vacuum = {
      ...shot,
      projectile: {
        mass: 0.01,
        diameter: 0.008,
        drag: {
          kind: 'curve',
          curve: [
            [0, 0],
            [10, 0],
          ],
        },
      },
      muzzleVelocity: v,
      firearm: { sightHeight: 0.05 },
      wind: undefined,
      zero: { elevationAngle: 0, windageAngle: 0 },
    }
    const xs = [100, 400, 900]
    const { status, body } = await post(`${API_PREFIX}/exterior/trajectory`, {
      shot: vacuum,
      ranges: xs,
    })
    expect(status).toBe(200)
    body.result.points.forEach((p: { range: number; height: number }, i: number) => {
      const x = defined(xs[i])
      const want = -0.05 - (g * x ** 2) / (2 * v ** 2)
      expect(p.range).toBe(x)
      expect(Math.abs(p.height - want) / Math.abs(want)).toBeLessThan(1e-9)
    })
  })

  it('reads the drag with the monotone cubic and rejects an unknown interpolation', async () => {
    const cubic: TrajectoryInput = {
      ...shot,
      projectile: { ...projectile, drag: { ...projectile.drag, interpolation: 'monotone-cubic' } },
    }
    const { status, body } = await post(`${API_PREFIX}/exterior/trajectory`, {
      shot: cubic,
      ranges,
    })
    expect(status).toBe(200)
    expect(body.result).toEqual(json(trajectory(cubic, ranges, { maxSteps: 5000 })))
    const curve: TrajectoryInput = {
      ...shot,
      projectile: {
        ...projectile,
        drag: {
          kind: 'curve',
          curve: [
            [0, 0.3],
            [0.9, 0.32],
            [1.1, 0.45],
            [2, 0.35],
            [5, 0.25],
          ],
          interpolation: 'monotone-cubic',
        },
      },
    }
    const onCurve = await post(`${API_PREFIX}/exterior/trajectory`, { shot: curve, ranges })
    expect(onCurve.status).toBe(200)
    expect(onCurve.body.result).toEqual(json(trajectory(curve, ranges, { maxSteps: 5000 })))
    const bad = {
      ...shot,
      projectile: { ...projectile, drag: { ...projectile.drag, interpolation: 'spline' } },
    }
    expect((await post(`${API_PREFIX}/exterior/trajectory`, { shot: bad, ranges })).status).toBe(
      400,
    )
  })

  it('rejects inputs outside the caps with issues', async () => {
    const tooMany = Array.from({ length: 501 }, (_, i) => i)
    for (const payload of [
      { shot, ranges: tooMany },
      { shot, ranges, options: { maxSteps: 5001 } },
      { shot, ranges, extra: 1 },
      { shot: { ...shot, firearm: { ...shot.firearm, sightHieght: 0.04 } }, ranges },
    ]) {
      const { status, body } = await post(`${API_PREFIX}/exterior/trajectory`, payload)
      expect(status).toBe(400)
      expect(body.issues.length).toBeGreaterThan(0)
    }
    const infinite = await postRaw(
      `${API_PREFIX}/exterior/trajectory`,
      JSON.stringify({ shot, ranges }).replace('"muzzleVelocity":800', '"muzzleVelocity":1e400'),
    )
    expect(infinite.status).toBe(400)
    expect(infinite.body.issues[0].path).toEqual(['shot', 'muzzleVelocity'])
  })

  it('passes invalid JSON and oversized bodies through as Fastify errors', async () => {
    const invalid = await postRaw(`${API_PREFIX}/exterior/trajectory`, '{"shot":')
    expect(invalid.status).toBe(400)
    expect(invalid.body.issues).toBeUndefined()
    const big = await postRaw(
      `${API_PREFIX}/exterior/trajectory`,
      JSON.stringify({ pad: 'x'.repeat(300000) }),
    )
    expect(big.status).toBe(413)
  })

  it('writes the NaN spin drift beyond the point-mass twin run as null', async () => {
    // steep line of sight, bore along it: the twin stops at its apex near 3666 m, the modified
    // point mass (Magnus force below 0) reaches 3700 m
    const steep: TrajectoryInput = {
      ...shot,
      projectile: {
        ...projectile,
        aerodynamics: { liftSlope: 2.6, momentSlope: 2.8, magnusForceSlope: -2 },
      },
      wind: undefined,
      lookAngle: 0.8,
      zero: { elevationAngle: 0, windageAngle: 0 },
    }
    const options = { model: 'modified-point-mass' as const }
    const { status, body } = await post(`${API_PREFIX}/exterior/trajectory`, {
      shot: steep,
      ranges: [3000, 3700],
      options,
    })
    expect(status).toBe(200)
    expect(body.result).toEqual(
      json(trajectory(steep, [3000, 3700], { maxSteps: 5000, ...options })),
    )
    expect(body.result.points[0].spinDrift).toBeTypeOf('number')
    expect(body.result.points[1].spinDrift).toBeNull()
  })

  it('answers 422 when the step cap is reached', async () => {
    const { status, body } = await post(`${API_PREFIX}/exterior/trajectory`, {
      shot,
      ranges,
      options: { maxSteps: 10 },
    })
    expect(status).toBe(422)
    expect(body.message).toMatch(/step/)
  })
})

describe('POST /exterior/truing', () => {
  /** The defaults the API passes to core. */
  const defaults = {
    maxSteps: caps.truingSteps,
    maxIterations: caps.truingIterations,
    maxTotalSteps: caps.truingTotalSteps,
  }
  const observed = trajectory({ ...shot, muzzleVelocity: 810 }, [300, 500], {
    relativeTolerance: 1e-10,
    absoluteTolerance: 1e-9,
    zeroTolerance: 1e-9,
  })
  const observations = observed.points.map((p) => ({
    kind: 'height' as const,
    range: p.range,
    value: p.height,
  }))

  it('returns the core muzzle-velocity truing', async () => {
    const { status, body } = await post(`${API_PREFIX}/exterior/truing`, {
      shot,
      observations,
      fit: { kind: 'muzzleVelocity' },
    })
    expect(status).toBe(200)
    expect(body.result).toEqual(json(trueMuzzleVelocity(shot, observations, defaults)))
    expect(body.result.parameters[0].value).toBeCloseTo(810, 3)
    const one = await post(`${API_PREFIX}/exterior/truing`, {
      shot,
      observations: observations.slice(0, 1),
      fit: { kind: 'muzzleVelocity' },
    })
    expect(one.status).toBe(200)
    expect(one.body.result.degreesOfFreedom).toBe(0)
  })

  it('passes options to the core truing', async () => {
    const options = { relativeTolerance: 1e-9, spinDrift: false }
    const { status, body } = await post(`${API_PREFIX}/exterior/truing`, {
      shot,
      observations,
      fit: { kind: 'muzzleVelocity' },
      options,
    })
    expect(status).toBe(200)
    expect(body.result).toEqual(
      json(trueMuzzleVelocity(shot, observations, { ...defaults, ...options })),
    )
  })

  it('returns the core drag truing with and without knots', async () => {
    const truth = trajectory({ ...shot, muzzleVelocity: 810 }, [100, 300, 500, 700, 900], {
      relativeTolerance: 1e-10,
      absoluteTolerance: 1e-9,
      zeroTolerance: 1e-9,
    })
    const mixed = truth.points.flatMap((p) => [
      {
        kind: 'velocity' as const,
        range: p.range,
        value: p.velocity * 0.99,
        standardUncertainty: 1,
      },
      { kind: 'height' as const, range: p.range, value: p.height, standardUncertainty: 0.01 },
    ])
    for (const fit of [{ knots: [1.3, 2], fitMuzzleVelocity: true }, { knots: [1.3, 2] }, {}]) {
      const want = json(trueDrag(shot, mixed, fit, defaults))
      const { status, body } = await post(`${API_PREFIX}/exterior/truing`, {
        shot,
        observations: mixed,
        fit: { kind: 'drag', ...fit },
      })
      expect(status).toBe(200)
      expect(body.result).toEqual(want)
    }
  })

  it('answers 422 underdetermined with the truing fields', async () => {
    const { status, body } = await post(`${API_PREFIX}/exterior/truing`, {
      shot,
      observations: observations.slice(0, 1),
      fit: { kind: 'drag', fitMuzzleVelocity: true },
    })
    expect(status).toBe(422)
    expect(body).toMatchObject({ statusCode: 422, reason: 'underdetermined' })
  })
})

describe('POST /interior', () => {
  it('returns the M3 result with the notice', async () => {
    const { status, body } = await post(`${API_PREFIX}/interior`, { model: 'm3', load: m3Load })
    expect(status).toBe(200)
    expect(body).toMatchObject({ notice: 'simulation, not load data', model: 'm3' })
    expect(body.result).toEqual(json(interior(m3Load, { maxTime: 0.04, maxSteps: 50000 })))
  })

  it('passes options to the M3 model', async () => {
    const options = { outputStep: 1e-5, relativeTolerance: 1e-8 }
    const { status, body } = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: m3Load,
      options,
    })
    expect(status).toBe(200)
    expect(body.result).toEqual(
      json(interior(m3Load, { maxTime: 0.04, maxSteps: 50000, ...options })),
    )
  })

  it('accepts M3 leakage and heat with only the flame temperature', async () => {
    const load: InteriorLoad = {
      ...m3Load,
      heat: { model: 'convective', flameTemperature: 2900 },
      leakage: {
        area: [
          { travel: 0, area: 1e-7 },
          { travel: 0.6, area: 1e-7 },
        ],
        backPressure: 2e5,
        discharge: 0.8,
      },
    }
    const { status, body } = await post(`${API_PREFIX}/interior`, { model: 'm3', load })
    expect(status).toBe(200)
    expect(body.result).toEqual(json(interior(load, { maxTime: 0.04, maxSteps: 50000 })))
    expect(body.result.energy.leakage).toBeGreaterThan(0)
    expect(body.result.points[0].leakedMass).toBe(0)
    expect(body.units.mass).toBe('kg')
  })

  it('accepts a three-stage form and names it when invalid', async () => {
    const form = { kind: 'threeStage', a: 1.2, m: 0.4, q: 1.5, z1: 0.45, z2: 0.85, r: 0.3 } as const
    const withForm = (f: typeof form | { kind: 'threeStage'; r: number }): InteriorLoad => ({
      ...m3Load,
      propellant: {
        ...m3Load.propellant,
        burn: {
          kind: 'vivacity',
          vivacity: 0.56,
          exponent: 1,
          referencePressure: 98066.5,
          form: { ...form, ...f },
        },
      },
    })
    const load = withForm(form)
    const ok = await post(`${API_PREFIX}/interior`, { model: 'm3', load })
    expect(ok.status).toBe(200)
    expect(ok.body.result).toEqual(json(interior(load, { maxTime: 0.04, maxSteps: 50000 })))
    const bad = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: withForm({ kind: 'threeStage', r: 1 }),
    })
    expect(bad.status).toBe(422)
    expect(bad.body).toMatchObject({ reason: 'input', field: 'propellant.burn.form' })
  })

  it('answers 422 with reason and field for an invalid M3 load', async () => {
    const load = { ...m3Load, chamber: { ...m3Load.chamber, volume: -1 } }
    const { status, body } = await post(`${API_PREFIX}/interior`, { model: 'm3', load })
    expect(status).toBe(422)
    expect(body).toMatchObject({ notice: 'simulation, not load data', reason: 'input' })
    expect(body.field).toBeTypeOf('string')
  })

  it('caps the M3 output points', async () => {
    const { status, body } = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: m3Load,
      options: { outputStep: 1e-8 },
    })
    expect(status).toBe(400)
    expect(body.issues.length).toBeGreaterThan(0)
    const ratio = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: m3Load,
      options: { outputStep: 1e-6 },
    })
    expect(ratio.status).toBe(400)
  })
})

describe('POST /interior pressure range and limits', () => {
  const run = (extra: object = {}, load: InteriorLoad = m3Load) =>
    post(`${API_PREFIX}/interior`, { model: 'm3', load, ...extra })
  /** Nominal peak about 4783 bar, above the Pmax of alpha-rifle. */
  const hot: InteriorLoad = { ...m3Load, charge: 0.0032 }

  it('returns the core range with the default tolerances and a noCartridge warning', async () => {
    const { status, body } = await run()
    expect(status).toBe(200)
    const r = interior(m3Load, m3Config) as { peakBreechPressure: number }
    expect(body.pressureRange).toEqual(
      json(
        interiorPressureRange(m3Load, r.peakBreechPressure, pressureToleranceDefaults, m3Config),
      ),
    )
    expect(body.pressureRange.tolerances).toEqual(pressureToleranceDefaults)
    expect(body.warnings.map((w: { code: string }) => w.code)).toEqual(['noCartridge'])
    expect(body.limits).toBeUndefined()
  })

  it('warns chargeTooSmall for a small M3 charge', async () => {
    const codes = async (load: InteriorLoad, cartridge?: string) => {
      const { status, body } = await post(`${API_PREFIX}/interior`, {
        model: 'm3',
        load,
        cartridge,
      })
      expect(status).toBe(200)
      return body.warnings.map((w: { code: string }) => w.code)
    }
    // 0.001 kg: peak mean pressure about 226 bar, 22.6 times the 10 bar ignition pressure
    expect(await codes(m3Load, 'alpha-rifle')).not.toContain('chargeTooSmall')
    expect(await codes({ ...m3Load, charge: 0.001 }, 'alpha-rifle')).not.toContain('chargeTooSmall')
    // start pressure 0: 2.82 times the ignition pressure at 0.0003 kg, 1.83 times at 0.0002 kg
    expect(await codes({ ...m3Load, charge: 0.0003 })).toEqual(['noCartridge'])
    expect(await codes({ ...m3Load, charge: 0.0002 })).toEqual(['noCartridge', 'chargeTooSmall'])
    // a 30 bar start pressure: 2.77 times at 0.0005 kg, 1.64 times at 0.0003 kg
    expect(await codes({ ...m3Load, charge: 0.0005, startPressure: 3e6 })).toEqual(['noCartridge'])
    expect(await codes({ ...m3Load, charge: 0.0003, startPressure: 3e6 })).toEqual([
      'noCartridge',
      'chargeTooSmall',
    ])
  })

  it('compares the CIP Pmax of a database cartridge', async () => {
    const { status, body } = await run({ cartridge: 'alpha-rifle' }, hot)
    expect(status).toBe(200)
    expect(body.limits).toEqual([
      {
        cartridge: 'alpha-rifle',
        revised: '2020-01-01',
        symbol: 'Pmax',
        method: null,
        pressure: 4e8,
        compared: true,
        exceeded: true,
        nominalExceeded: true,
      },
    ])
    const { nominalPressure, lowPressure, highPressure } = body.pressureRange
    const bar = (pa: number) => Math.round(pa / 1e5)
    expect(body.warnings).toEqual([
      {
        code: 'limitExceeded',
        spec: 'cip-alpha-rifle-2020-01-01',
        symbol: 'Pmax',
        method: null,
        message: `Simulated peak pressure ${bar(nominalPressure)} bar (range ${bar(lowPressure)} to ${bar(highPressure)} bar) is above CIP Pmax 4000 bar (cip-alpha-rifle-2020-01-01; measuring method not stated in the record).`,
      },
    ])
    expect(body.resolved.cartridge).toEqual({
      id: 'alpha-rifle',
      name: 'Alpha Rifle',
      provenance: { kind: 'published', sources: [{ title: 'Test standard' }] },
    })
    const m3 = await run({ cartridge: 'alpha-rifle' })
    expect(m3.status).toBe(200)
    // the M3 test load stays below the limit: no warning at all
    expect(
      m3.body.limits.map(
        (l: { compared: boolean; exceeded?: boolean; nominalExceeded?: boolean }) => [
          l.compared,
          l.exceeded,
          l.nominalExceeded,
        ],
      ),
    ).toEqual([[true, false, false]])
    expect(m3.body.pressureRange.highPressure).toBeLessThan(4e8)
    expect(m3.body.warnings).toEqual([])
    expect(m3.body.resolved.cartridge.id).toBe('alpha-rifle')
  })

  it('marks an M3 range incomplete when the slower cases pass maxTime', async () => {
    // maxTime 0.2 % above the nominal muzzle time (1.7416e-3 s)
    const { status, body } = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: m3Load,
      cartridge: 'alpha-rifle',
      options: { maxTime: 1.745e-3 },
    })
    expect(status).toBe(200)
    expect(body.pressureRange.complete).toBe(false)
    expect(
      body.pressureRange.cases
        .filter((c: { maxPressure: number | null }) => c.maxPressure === null)
        .map((c: { input: string; side: number; reason: string }) => [c.input, c.side, c.reason]),
    ).toEqual([
      ['chargeFraction', -1, 'maxTime'],
      ['volumeFraction', 1, 'maxTime'],
      ['burnRateFraction', -1, 'maxTime'],
      ['all', -1, 'maxTime'],
    ])
    expect(body.warnings).toEqual([
      {
        code: 'rangeIncomplete',
        message:
          '4 of 12 range cases could not be computed (maxTime); the range covers only the computed cases, and the true range can be wider.',
      },
    ])
  })

  it('warns when only the high end of the range is above a limit', async () => {
    const { body } = await run({ cartridge: 'delta-rifle' })
    expect(body.limits[0]).toMatchObject({ compared: true, exceeded: true, nominalExceeded: false })
    expect(body.warnings).toHaveLength(1)
    expect(body.warnings[0].message).toMatch(
      /^The upper end of the simulated peak pressure range, \d+ bar, is above CIP Pmax \d+(\.\d+)? bar \(cip-delta-rifle-2020-01-01; transducer\); the nominal value is \d+ bar\.$/,
    )
  })

  it('answers noComparableLimit without limits or with crusher values only', async () => {
    const none = await run({ cartridge: 'beta-pistol' })
    expect(none.body.limits).toEqual([])
    expect(none.body.warnings.map((w: { code: string }) => w.code)).toEqual(['noComparableLimit'])
    const crusher = await run({ cartridge: 'epsilon-rifle' })
    expect(
      crusher.body.limits.map((l: { compared: boolean; reason: string }) => [l.compared, l.reason]),
    ).toEqual([[false, 'crusher']])
    expect(crusher.body.warnings.map((w: { code: string }) => w.code)).toEqual([
      'noComparableLimit',
    ])
    for (const w of [...none.body.warnings, ...crusher.body.warnings])
      expect(w.message).not.toMatch(/safe/i)
  })

  it('validates the cartridge id and the tolerances', async () => {
    expect((await run({ cartridge: 'unknown' })).status).toBe(404)
    const noCharge = await run({ tolerances: { chargeFraction: 0 } })
    expect(noCharge.status).toBe(200)
    expect(noCharge.body.pressureRange.tolerances.chargeFraction).toBe(0)
    expect(
      noCharge.body.pressureRange.cases.some(
        (c: { input: string }) => c.input === 'chargeFraction',
      ),
    ).toBe(false)
    const zeros = {
      chargeFraction: 0,
      volumeFraction: 0,
      burnRateFraction: 0,
      temperatureKelvin: 0,
      startPressureFraction: 0,
    }
    for (const tolerances of [{ burnRateFraction: 0.6 }, { chrage: 0.01 }, zeros]) {
      const { status, body } = await run({ tolerances })
      expect(status).toBe(400)
      expect(body.issues.length).toBeGreaterThan(0)
      expect(body.notice).toBe('simulation, not load data')
    }
  })
})

describe('POST /interior sampled band', () => {
  const run = (extra: object) =>
    post(`${API_PREFIX}/interior`, { model: 'm3', load: m3Load, ...extra })

  it('returns the percentiles of the core sampler for the seed, and none without sampling', async () => {
    const { status, body } = await run({ sampling: { samples: 20, seed: 3 } })
    expect(status).toBe(200)
    const core = interiorSampledBand(
      m3Load,
      pressureToleranceDefaults,
      { samples: 20, seed: 3, budgetMs: 3000, now: Date.now },
      m3Config,
    )
    expect(body.sampled).toEqual(json(core))
    expect(body.sampled.status).toBe('sampled')
    expect(body.sampled.pressure.p05).toBeLessThan(body.pressureRange.nominalPressure)
    expect((await run({})).body.sampled).toBeUndefined()
  })

  it('answers with the corner-case range and the over-budget status when the budget is spent', async () => {
    const { status, body } = await run({ sampling: { samples: 2000, budgetMs: 1 } })
    expect(status).toBe(200)
    expect(body.sampled).toMatchObject({ status: 'overBudget', samples: 2000, budgetMs: 1 })
    expect(body.sampled.pressure).toBeUndefined()
    expect(body.pressureRange.highPressure).toBeGreaterThan(body.pressureRange.nominalPressure)
  })

  it('rejects sampling with a ladder and a sample count outside its bounds', async () => {
    const ladder = { chargeStep: 0.0001, stepCount: 3 }
    expect((await run({ ladder, sampling: {} })).status).toBe(400)
    expect((await run({ sampling: { samples: 5 } })).status).toBe(400)
  })
})

describe('POST /interior charge ladder', () => {
  /** The single answer at `charge` without the fields a ladder sends once. */
  async function single(body: { load: { charge: number } }, charge: number) {
    const one = await post(`${API_PREFIX}/interior`, { ...body, load: { ...body.load, charge } })
    expect(one.status).toBe(200)
    const { result, pressureRange, limits, warnings } = one.body
    return { charge, result, pressureRange, limits, warnings }
  }

  it.each([
    ['m3', m3Load, 'up'],
    ['m3', m3Load, 'down'],
  ] as const)(
    'gives each %s step the single answer at its charge',
    async (model, load, direction) => {
      const body = { model, load, cartridge: 'alpha-rifle' }
      const ladder = { chargeStep: 0.0001, stepCount: 3, direction }
      const { status, body: answer } = await post(`${API_PREFIX}/interior`, { ...body, ladder })
      expect(status).toBe(200)
      expect(answer).toMatchObject({ notice: 'simulation, not load data', model })
      expect(answer.result).toBeUndefined()
      expect(answer.resolved.cartridge.id).toBe('alpha-rifle')
      const charges = chargeLadder(load.charge, ladder.chargeStep, ladder.stepCount, direction)
      expect(answer.ladderSteps).toEqual(await Promise.all(charges.map((c) => single(body, c))))
    },
  )

  it('keeps the valid steps when a step does not fit the chamber', async () => {
    // solid volume 5.8 g / 1600 kg/m3 is above the 3.4 cm3 chamber
    const ladder = { chargeStep: 0.001, stepCount: 4 }
    const { status, body } = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: m3Load,
      ladder,
    })
    expect(status).toBe(200)
    expect(body.ladderSteps.slice(0, 3).every((s: object) => 'result' in s)).toBe(true)
    expect(body.ladderSteps[3]).toEqual({
      charge: chargeLadder(m3Load.charge, 0.001, 4, 'up')[3],
      error: { message: 'interior: chamberVolume', reason: 'chamberVolume' },
    })
  })

  it('centres an odd ladder on the charge and answers 400 for an even one around it', async () => {
    const around = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: m3Load,
      ladder: { chargeStep: 0.0001, stepCount: 3, direction: 'around' },
    })
    expect(around.status).toBe(200)
    expect(around.body.ladderSteps.map((s: { charge: number }) => s.charge)).toEqual(
      chargeLadder(m3Load.charge, 0.0001, 3, 'around'),
    )
    expect(around.body.ladderSteps[1].charge).toBe(m3Load.charge)
    // more steps than one batch of 4: every charge, in ladder order
    const nine = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: m3Load,
      ladder: { chargeStep: 0.00005, stepCount: 9, direction: 'around' },
    })
    expect(nine.status).toBe(200)
    expect(nine.body.ladderSteps.map((s: { charge: number }) => s.charge)).toEqual(
      chargeLadder(m3Load.charge, 0.00005, 9, 'around'),
    )
    const even = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: m3Load,
      ladder: { chargeStep: 0.0001, stepCount: 4, direction: 'around' },
    })
    expect(even.status).toBe(400)
  })

  it('answers 400 for more steps than the cap and 422 for a charge below 0', async () => {
    const six = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: m3Load,
      ladder: { chargeStep: 0.0001, stepCount: caps.ladderSteps + 1 },
    })
    expect(six.status).toBe(400)
    expect(six.body.notice).toBe('simulation, not load data')
    const negative = await post(`${API_PREFIX}/interior`, {
      model: 'm3',
      load: m3Load,
      ladder: { chargeStep: 0.002, stepCount: 3, direction: 'down' },
    })
    expect(negative.status).toBe(422)
    expect(negative.body).toMatchObject({ notice: 'simulation, not load data' })
    expect(negative.body.message).toMatch(/ladder charge .* must be above 0/)
  })
})

describe('GET /exterior/stability', () => {
  const air = { altitude: 0, pressure: icao.pressure, temperature: icao.temperature, humidity: 0 }

  it('returns Miller stability for explicit values and for a bullet id', async () => {
    const explicit = await api.app.inject({
      url: `${API_PREFIX}/exterior/stability?mass=0.01134&diameter=0.00782&length=0.0312&twist=0.254&muzzleVelocity=800`,
    })
    expect(explicit.statusCode).toBe(200)
    const input = { mass: 0.01134, diameter: 0.00782, length: 0.0312, twist: 0.254, velocity: 800 }
    expect(explicit.json()).toEqual({
      units: { result: '1' },
      method: 'miller',
      result: millerStability({ ...input, air }),
    })
    const byId = (
      await api.app.inject({
        url: `${API_PREFIX}/exterior/stability?bullet=example-a-2&twist=0.254&muzzleVelocity=800`,
      })
    ).json()
    expect(byId.result).toBe(millerStability({ ...input, length: 0.0312, air }))
    expect(byId.resolved.bullet.suppliedFields).toEqual(['mass', 'diameter', 'length'])
    const res = await api.app.inject({
      url: `${API_PREFIX}/exterior/stability?bullet=example-a-2&length=0.033&twist=0.254&muzzleVelocity=800&temperature=250&pressure=80000`,
    })
    expect(res.statusCode).toBe(200)
    const cold = { altitude: 0, pressure: 80000, temperature: 250, humidity: 0 }
    expect(res.json().result).toBe(millerStability({ ...input, length: 0.033, air: cold }))
    expect(res.json().resolved.bullet.suppliedFields).toEqual(['mass', 'diameter'])
  })

  it('answers 422 for a bullet without length and 400 for missing values', async () => {
    const noLength = await api.app.inject({
      url: `${API_PREFIX}/exterior/stability?bullet=example-a-1&twist=0.254&muzzleVelocity=800`,
    })
    expect(noLength.statusCode).toBe(422)
    for (const query of [
      'twist=0.254&muzzleVelocity=800',
      'mass=&diameter=0.00782&length=0.0312&twist=0.254&muzzleVelocity=800',
      'bullet=example-a-2&twist=x&muzzleVelocity=800',
      'mass=%20&diameter=0.00782&length=0.0312&twist=0.254&muzzleVelocity=800',
      'bullet=example-a-2&twist=0x10&muzzleVelocity=800',
      'bullet=example-a-2&twist=0.254&muzzleVelocity=800&pressure=-101325',
      'bullet=example-a-2&twist=0.254&muzzleVelocity=800&temperature=0',
      'bullet=example-a-2&twist=-0.254&muzzleVelocity=800',
    ])
      expect(
        (await api.app.inject({ url: `${API_PREFIX}/exterior/stability?${query}` })).statusCode,
      ).toBe(400)
  })

  it('reads a query number written with or without digits around the point', async () => {
    const get = (twist: string) =>
      api.app.inject({
        url: `${API_PREFIX}/exterior/stability?mass=0.01&diameter=0.0078&length=0.031&muzzleVelocity=800&twist=${twist}`,
      })
    const results = []
    for (const twist of ['0.254', '.254', '0.2540', '2.54e-1', '2540E-4', '%2B.254']) {
      const res = await get(twist)
      expect(res.statusCode).toBe(200)
      results.push(res.json().result)
    }
    expect(new Set(results).size).toBe(1)
    expect((await get('1.')).statusCode).toBe(200)
    for (const twist of ['.', '1.2.3', 'e5', '1e', '1,5'])
      expect((await get(twist)).statusCode).toBe(400)
  })

  it('bounds the query values and record values', async () => {
    const base = { mass: 0.01, diameter: 0.0078, length: 0.031, twist: 0.254, muzzleVelocity: 800 }
    const get = (q: object) =>
      api.app.inject({
        url: `${API_PREFIX}/exterior/stability?${new URLSearchParams(q as Record<string, string>)}`,
      })
    for (const q of [
      { mass: '1e308' },
      { twist: '1e-200' },
      { muzzleVelocity: '3001' },
      { diameter: '0.0009' },
    ])
      expect((await get({ ...base, ...q })).statusCode).toBe(400)
    for (const [key, [lo, hi]] of Object.entries(stabilityBounds))
      for (const value of [lo, hi])
        expect((await get({ ...base, [key]: value })).statusCode).toBe(200)
    const heavy = await api.app.inject({
      url: `${API_PREFIX}/exterior/stability?bullet=example-a-4&twist=0.254&muzzleVelocity=800`,
    })
    expect(heavy.statusCode).toBe(422)
    expect(heavy.json().message).toBe(
      'bullet example-a-4 mass 0.5 kg must be within 0.0001 and 0.2 kg',
    )
  })

  it('keeps Miller stability finite and above 0 at every vertex of the bounds', () => {
    const keys = Object.keys(stabilityBounds) as (keyof typeof stabilityBounds)[]
    for (let mask = 0; mask < 2 ** keys.length; mask++) {
      const v = Object.fromEntries(keys.map((k, i) => [k, stabilityBounds[k][(mask >> i) & 1]]))
      const bound = (k: keyof typeof stabilityBounds) => defined(v[k], k)
      const s = millerStability({
        mass: bound('mass'),
        diameter: bound('diameter'),
        length: bound('length'),
        twist: bound('twist'),
        velocity: bound('muzzleVelocity'),
        air: {
          altitude: 0,
          pressure: bound('pressure'),
          temperature: bound('temperature'),
          humidity: 0,
        },
      })
      expect(Number.isFinite(s) && s > 0).toBe(true)
    }
  })
})
