import {
  interiorLoad,
  interiorValueKeys,
  overrideResistance,
  powderModelValues,
  recordResistance,
  workbenchValueKeys,
} from '@open-reloading/core'
import { analysisKinds, legacyLoadProblem, toSi } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { maxPoints } from '../src/compute/interior-schema.ts'
import { filePath } from '../src/compute/load-file.ts'
import { API_PREFIX } from '../src/version.ts'
import { bundle, file, siValues } from './fixtures.ts'
import { withApi } from './setup.ts'

const published = { kind: 'published' as const, sources: [{ title: 'Test chart' }] }
const law = { stress: { value: 4.2 }, oversize: 1.3, engraving: 0 }
/** The model parameters of a fitted record in stored units; the numbers are made up. */
const model = {
  energy: { value: 4.1e6 },
  gamma: 1.23,
  density: { value: 1.6 },
  covolume: { value: 0.00098 },
  vivacity: { value: 0.6 },
  pressureExponent: 1,
  referencePressure: { value: 0.980665 },
  ignitionPressure: { value: 60 },
  startPressure: { value: 110 },
  burnForm: { kind: 'constant', a: { value: 1 }, m: 0.5, q: 0.5, z1: 0.8 },
}
/** A powder with a bulk density and a bore-resistance law; the numbers are made up. */
const fitted = {
  id: 'example-f-fitted',
  manufacturer: 'example-f',
  name: 'Fitted',
  bulkDensity: { value: 0.9 },
  interior: { ...model, resistance: law },
  provenance: published,
}
/** A powder whose law has an engraving ramp: 0.5 of the start pressure over the bullet length. */
const ramped = {
  ...fitted,
  id: 'example-f-ramped',
  name: 'Ramped',
  interior: { ...model, resistance: { ...law, engraving: 0.5 } },
}
/** A powder with a low bulk density: the example charge fills 1.37 of the case. */
const fluffy = {
  id: 'example-f-fluffy',
  manufacturer: 'example-f',
  name: 'Fluffy',
  bulkDensity: { value: 0.6 },
  provenance: published,
}
/** The SI values of a load on the powder record `p`: its model parameters, then the typed `siValues`. */
const withPowder = (p: object) => ({ ...powderModelValues(p as never), ...siValues })
const longBullet = {
  id: 'example-a-long',
  manufacturer: 'example-a',
  productNumber: 'L',
  name: 'Long',
  diameter: { value: 7.82 },
  mass: { value: 10.89 },
  length: { value: 30 },
  ballisticCoefficients: [{ dragModel: 'G1' as const, value: 0.46 }],
  provenance: published,
}

const cartridges = bundle.cartridges.map((c) =>
  c.id === 'beta-pistol'
    ? {
        ...c,
        values: [
          ...c.values,
          { side: 'chamber', symbol: 'Z', quantity: 'length', value: 8.85 },
          { side: 'cartridge', symbol: 'Pmax', quantity: 'pressure', value: 2300 },
        ],
      }
    : c,
)
const api = withApi({
  seed: {
    ...bundle,
    cartridges: cartridges as typeof bundle.cartridges,
    powders: [...bundle.powders, fitted as never, ramped as never, fluffy as never],
    bullets: [...bundle.bullets, longBullet],
  },
})

async function simulate(body: unknown, query = '') {
  const res = await api.app.inject({
    method: 'POST',
    url: `${API_PREFIX}/interior/load-file${query}`,
    payload: body as object,
  })
  return { status: res.statusCode, body: res.json() }
}

async function interior(body: unknown) {
  const res = await api.app.inject({
    method: 'POST',
    url: `${API_PREFIX}/interior`,
    payload: body as object,
  })
  return { status: res.statusCode, body: res.json() }
}

describe('POST /interior/load-file', () => {
  it('gives the results of the same load through /interior', async () => {
    const sim = await simulate(file({ siValues, cartridge: 'beta-pistol' }))
    const int = await interior({
      model: 'm3',
      load: interiorLoad(siValues),
      cartridge: 'beta-pistol',
    })
    expect(sim.status).toBe(200)
    const r = int.body.result
    expect(sim.body.summary).toEqual({
      peakPressure: int.body.pressureRange.nominalPressure,
      muzzleVelocity: r.muzzleVelocity,
      muzzleEnergy: r.muzzleEnergy,
      barrelTime: r.barrelTime,
      muzzleBurntFraction: r.muzzleBurntFraction,
    })
    expect(sim.body.pressureRange).toEqual(int.body.pressureRange)
    expect(sim.body.limits).toEqual(int.body.limits)
    expect(sim.body.warnings).toEqual(int.body.warnings)
    expect(sim.body.notice).toBe('simulation, not load data')
    expect(sim.body.loadName).toBe('Load')
    expect(sim.body.resolved.cartridge.id).toBe('beta-pistol')
    expect(sim.body).not.toHaveProperty('points')
  })

  it('accepts the firearm mass the workbench saves and gives the same results', async () => {
    const plain = await simulate(file({ siValues }))
    const sim = await simulate(file({ siValues: { ...siValues, firearmMass: 7 } }))
    expect(sim.status).toBe(200)
    expect(sim.body.summary).toEqual(plain.body.summary)
  })

  it('takes an empty bore area from the cartridge record, as the workbench fills it', async () => {
    const { boreArea: _, ...empty } = siValues
    const sim = await simulate(file({ siValues: empty, cartridge: 'beta-pistol' }))
    const int = await interior({
      model: 'm3',
      load: {
        ...interiorLoad(empty),
        chamber: { ...interiorLoad(siValues).chamber, boreArea: 47.51e-6 },
      },
      cartridge: 'beta-pistol',
    })
    expect(sim.status).toBe(200)
    expect(sim.body.summary.muzzleVelocity).toBe(int.body.result.muzzleVelocity)
    expect(sim.body.summary.peakPressure).toBe(int.body.pressureRange.nominalPressure)
    // without a cartridge the circle of the bore diameter
    const bare = await simulate(file({ siValues: empty }))
    expect(bare.body.summary.peakPressure).not.toBe(sim.body.summary.peakPressure)
  })

  it('adds the curves on request', async () => {
    const { body } = await simulate(file({ siValues }), '?curves=true')
    expect(body.points.length).toBeGreaterThan(10)
    expect(body.points[0]).toHaveProperty('time')
  })

  it('applies the bore resistance of the powder record and gives the load ratio', async () => {
    const sim = await simulate(
      file({ siValues, cartridge: 'beta-pistol', bullet: longBullet.id, powder: fitted.id }),
    )
    const load = interiorLoad(withPowder(fitted))
    const { resistance } = recordResistance(fitted, {
      boreDiameter: load.chamber.boreDiameter,
      boreArea: load.chamber.boreArea,
      startPressure: load.startPressure,
      // the smallest cartridge-side G1 of the fixture and the chamber Z added above
      cartridge: { g1: 9.02, z: 8.85 },
      bulletLengthMm: 30,
    })
    expect(resistance).toBeDefined()
    const int = await interior({ model: 'm3', load: { ...load, resistance } })
    expect(sim.status).toBe(200)
    expect(sim.body.summary.muzzleVelocity).toBe(int.body.result.muzzleVelocity)
    expect(sim.body.summary.loadRatio).toBeCloseTo(0.0028 / 900 / 3.4e-6, 12)
    expect(sim.body.resolved.powder.suppliedFields).toEqual(['bulkDensity', 'interior.resistance'])
    expect(sim.body.resolved.bullet.id).toBe(longBullet.id)
  })

  it('takes a leak area as an input: the load of /interior with a constant leak, a lower velocity', async () => {
    const leakArea = 5e-6
    const sim = await simulate(file({ siValues: { ...siValues, leakArea } }))
    const int = await interior({
      model: 'm3',
      load: {
        ...interiorLoad(siValues),
        leakage: {
          area: [
            { travel: 0, area: leakArea },
            { travel: siValues.travel, area: leakArea },
          ],
        },
      },
    })
    expect(sim.status).toBe(200)
    expect(sim.body.summary.muzzleVelocity).toBe(int.body.result.muzzleVelocity)
    expect(sim.body.summary.muzzleVelocity).toBeLessThan(
      (await simulate(file({ siValues }))).body.summary.muzzleVelocity,
    )
  })

  it('takes a bore friction as an input, also with the record resistance, and lowers the velocity', async () => {
    const boreFriction = 2e7
    const sim = await simulate(file({ siValues: { ...siValues, boreFriction } }))
    const int = await interior({
      model: 'm3',
      load: { ...interiorLoad(siValues), resistance: { friction: boreFriction } },
    })
    expect(sim.body.summary.muzzleVelocity).toBe(int.body.result.muzzleVelocity)
    expect(sim.body.summary.muzzleVelocity).toBeLessThan(
      (await simulate(file({ siValues }))).body.summary.muzzleVelocity,
    )
    // with a powder record the typed friction replaces the record's, the record's engraving stays
    const data = { cartridge: 'beta-pistol', bullet: longBullet.id, powder: fitted.id }
    const withRecord = await simulate(file({ ...data, siValues: { ...siValues, boreFriction } }))
    const load = interiorLoad(withPowder(fitted))
    const { resistance } = recordResistance(fitted, {
      boreDiameter: load.chamber.boreDiameter,
      boreArea: load.chamber.boreArea,
      startPressure: load.startPressure,
      cartridge: { g1: 9.02, z: 8.85 },
      bulletLengthMm: 30,
    })
    const expected = await interior({
      model: 'm3',
      load: { ...load, resistance: overrideResistance(resistance, { boreFriction }) },
    })
    expect(withRecord.body.summary.muzzleVelocity).toBe(expected.body.result.muzzleVelocity)
  })

  it('takes the engraving pressure and length as inputs: a ramp from the pressure to 0 over the length', async () => {
    const [engravingPressure, engravingLength] = [4e7, 0.01]
    const sim = await simulate(
      file({ siValues: { ...siValues, engravingPressure, engravingLength } }),
    )
    const int = await interior({
      model: 'm3',
      load: {
        ...interiorLoad(siValues),
        resistance: {
          engraving: [
            { travel: 0, pressure: engravingPressure },
            { travel: engravingLength, pressure: 0 },
          ],
        },
      },
    })
    expect(sim.body.summary.muzzleVelocity).toBe(int.body.result.muzzleVelocity)
    // the ramp holds the bullet while the pressure builds: another peak and velocity
    expect(sim.body.summary.muzzleVelocity).not.toBe(
      (await simulate(file({ siValues }))).body.summary.muzzleVelocity,
    )
  })

  it('names the engraving value that has no record to complete it, at its key in the file', async () => {
    for (const [given, missing] of [
      [{ engravingPressure: 4e7 }, 'engravingLength'],
      [{ engravingLength: 0.01 }, 'engravingPressure'],
    ] as const) {
      const res = await api.app.inject({
        method: 'POST',
        url: `${API_PREFIX}/interior/load-file`,
        payload: file({ siValues: { ...siValues, ...given } }),
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().issues[0].path).toEqual([
        'records',
        0,
        'data',
        'analysis',
        'overrides',
        missing,
      ])
    }
    // a record whose law has friction only has no ramp either
    const data = { cartridge: 'beta-pistol', bullet: longBullet.id, powder: fitted.id }
    const res = await api.app.inject({
      method: 'POST',
      url: `${API_PREFIX}/interior/load-file`,
      payload: file({ ...data, siValues: { ...siValues, engravingLength: 0.01 } }),
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().issues[0].path).toEqual([
      'records',
      0,
      'data',
      'analysis',
      'overrides',
      'engravingPressure',
    ])
  })

  describe('with a record ramp', () => {
    const data = { cartridge: 'beta-pistol', bullet: longBullet.id, powder: ramped.id }
    const load = interiorLoad(withPowder(ramped))
    const { resistance } = recordResistance(ramped, {
      boreDiameter: load.chamber.boreDiameter,
      boreArea: load.chamber.boreArea,
      startPressure: load.startPressure,
      cartridge: { g1: 9.02, z: 8.85 },
      bulletLengthMm: 30,
    })
    const expected = async (values: Record<string, number>) =>
      (
        await interior({
          model: 'm3',
          load: { ...load, resistance: overrideResistance(resistance, values) },
        })
      ).body.result.muzzleVelocity

    it('has a ramp from half the start pressure over the bullet length', () => {
      expect(resistance?.engraving).toEqual([
        { travel: 0, pressure: 0.5 * siValues.startPressure },
        { travel: 0.03, pressure: 0 },
      ])
    })

    for (const values of [{ engravingPressure: 4e6 }, { engravingLength: 0.01 }] as Record<
      string,
      number
    >[]) {
      it(`completes the record ramp with ${Object.keys(values)[0]} alone`, async () => {
        const sim = await simulate(file({ ...data, siValues: { ...siValues, ...values } }))
        expect(sim.status).toBe(200)
        expect(sim.body.summary.muzzleVelocity).toBe(await expected(values))
        expect(sim.body.summary.muzzleVelocity).not.toBe(
          (await simulate(file({ ...data, siValues }))).body.summary.muzzleVelocity,
        )
      })
    }

    it('replaces the whole record ramp with both values', async () => {
      const values = { engravingPressure: 4e6, engravingLength: 0.01 }
      const sim = await simulate(file({ ...data, siValues: { ...siValues, ...values } }))
      expect(sim.status).toBe(200)
      expect(sim.body.summary.muzzleVelocity).toBe(await expected(values))
    })
  })

  describe('with a value outside what the solver takes', () => {
    const bad: [string, number][] = [
      ['leakArea', -1e-6],
      ['boreFriction', -1],
      ['engravingPressure', -1],
      ['engravingLength', 0],
      ['engravingLength', -0.01],
    ]
    for (const [key, value] of bad)
      it(`answers 400 at analysis.overrides.${key} for ${value}`, async () => {
        // the pair is complete, so only the value itself is wrong
        const other = { engravingPressure: 4e6, engravingLength: 0.01 }
        const res = await api.app.inject({
          method: 'POST',
          url: `${API_PREFIX}/interior/load-file`,
          payload: file({ siValues: { ...siValues, ...other, [key]: value } }),
        })
        expect(res.statusCode).toBe(400)
        expect(res.json().issues[0].path).toEqual([
          'records',
          0,
          'data',
          'analysis',
          'overrides',
          key,
        ])
      })

    it('names the key before any record is read', async () => {
      const res = await api.app.inject({
        method: 'POST',
        url: `${API_PREFIX}/interior/load-file`,
        payload: file({ powder: 'unknown', siValues: { ...siValues, boreFriction: -1 } }),
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().issues[0].path).toEqual([
        'records',
        0,
        'data',
        'analysis',
        'overrides',
        'boreFriction',
      ])
    })

    it('takes 0 for a leak area, a bore friction and an engraving pressure', async () => {
      for (const extra of [
        { leakArea: 0 },
        { boreFriction: 0 },
        { engravingPressure: 0, engravingLength: 0.01 },
      ])
        expect(
          (await simulate(file({ siValues: { ...siValues, ...extra } }))).status,
          JSON.stringify(extra),
        ).toBe(200)
    })
  })

  it('warns when the solid fill is above the limit, with the load ratio where known', async () => {
    // a covolume below the solid volume per kg, so the chamberVolume rule allows these charges
    const warned = async (charge: number, powder?: string) => {
      const { status, body } = await simulate(
        file({ siValues: { ...siValues, charge, covolume: 6e-4 }, ...(powder && { powder }) }),
      )
      expect(status).toBe(200)
      return body.warnings.filter((w: { code: string }) => w.code === 'loadRatioHigh')
    }
    // 0.0036 kg is 0.66 of 3.4 cm3 as solid at 1.6 g/cm3, 1.76 times the bulk volume at 0.6 g/cm3
    expect((await warned(0.0036, fluffy.id))[0].message).toContain(
      'load ratio 1.76 is above 1.71, solid fill 0.64 for this powder',
    )
    expect((await warned(0.0036))[0].message).toContain('solid fill 0.66 is above 0.64')
    // 0.0028 kg is 0.51 as solid, load ratio 1.37 at 0.6 g/cm3
    expect(await warned(0.0028, fluffy.id)).toEqual([])
  })

  it('warns when the powder law cannot be applied', async () => {
    const { body } = await simulate(file({ siValues, powder: fitted.id }))
    expect(body.warnings.map((w: { code: string }) => w.code)).toContain('resistanceNotApplied')
    expect(body.warnings.at(-1).message).toContain('the parameters of Example F Fitted were fitted')
    expect(body.warnings.at(-1).message).toContain('missing: a cartridge record, a bullet length')
  })

  it('runs the ladder as the workbench does and shows the main step', async () => {
    const ladder = { stepCount: 3, chargeStep: 0.0001, direction: 'around' }
    const { status, body } = await simulate(file({ siValues, ladder }))
    expect(status).toBe(200)
    expect(body.ladderSteps.map((s: { charge: number }) => s.charge)).toEqual([
      0.0027, 0.0028, 0.0029,
    ])
    expect(body.shown).toBe(1)
    expect(body.summary).toEqual(body.ladderSteps[1].summary)
    const down = await simulate(file({ siValues, ladder: { ...ladder, direction: 'down' } }))
    expect(down.body.shown).toBe(0)
    expect(down.body.summary.peakPressure).toBe(body.ladderSteps[1].summary.peakPressure)
    // a ladder without a step size runs the charge alone
    expect(
      (await simulate(file({ siValues, ladder: { stepCount: 3, direction: 'up' } }))).body,
    ).not.toHaveProperty('ladderSteps')
  })

  it('refuses a temperature ladder instead of reading its step as a charge step', async () => {
    const { status, body } = await simulate(
      file({
        siValues,
        ladder: { kind: 'temperature', stepCount: 3, chargeStep: 5, direction: 'up' },
      }),
    )
    expect(status).toBe(422)
    expect(body.message).toContain('temperature ladder')
  })

  it('refuses a seating ladder, which needs the seating geometry of the workbench', async () => {
    const { status, body } = await simulate(
      file({
        siValues,
        ladder: { kind: 'seating', stepCount: 3, chargeStep: 0.0005, direction: 'up' },
      }),
    )
    expect(status).toBe(422)
    expect(body.field).toBe('ladder.kind')
    expect(body.notice).toBe('simulation, not load data')
    // a bad file answers 400 before the seating ladder is refused
    const bad = await simulate(
      file({
        siValues: { ...siValues, leakArea: -1e-6 },
        ladder: { kind: 'seating', stepCount: 3, chargeStep: 0.0005, direction: 'up' },
      }),
    )
    expect(bad.status).toBe(400)
    // the charge kind named in the file is the default ladder
    const charge = await simulate(
      file({
        siValues,
        ladder: { kind: 'charge', stepCount: 3, chargeStep: 0.0001, direction: 'up' },
      }),
    )
    expect(charge.status).toBe(200)
    expect(charge.body.ladderSteps).toHaveLength(3)
  })

  it('gives the curves once with a ladder, within the output cap', async () => {
    const ladder = { stepCount: 3, chargeStep: 0.0001, direction: 'around' }
    const { status, body } = await simulate(file({ siValues, ladder }), '?curves=true')
    expect(status).toBe(200)
    const int = await interior({
      model: 'm3',
      load: interiorLoad(siValues),
      ladder: {
        chargeStep: ladder.chargeStep,
        stepCount: ladder.stepCount,
        direction: ladder.direction,
      },
    })
    expect(body.points).toEqual(int.body.ladderSteps[body.shown].result.points)
    expect(body.ladderSteps.some((s: object) => 'points' in s)).toBe(false)
    expect(body.points.length).toBeLessThanOrEqual(5 * maxPoints)
  })

  it('reads a file with every optional field the workbench saves', async () => {
    const data = {
      siValues,
      cartridge: 'beta-pistol',
      bullet: longBullet.id,
      powder: fitted.id,
      note: 'Range day',
      capacity: `user:${crypto.randomUUID()}`,
      case: { firingCount: 2 },
      firearm: `user:${crypto.randomUUID()}`,
      seating: { by: 'overallLength', value: { value: 71.1 } },
      ladder: { stepCount: 3, chargeStep: 0.0001, direction: 'up' },
      measurements: [
        {
          name: 'session.csv',
          date: '2026-10-20',
          device: 'Chronograph',
          muzzleDistance: { value: 3000 },
          strings: [
            {
              label: 'A',
              charge: { value: 2.8 },
              shots: [{ velocity: { value: 765 }, coldBore: true }],
            },
          ],
        },
      ],
    }
    expect((await simulate(file(data))).status).toBe(200)
  })

  it('takes the values the load does not type from the records it names', async () => {
    // only the charge and what no record gives: the powder's model parameters and the bullet's mass
    const keep = ['volume', 'boreDiameter', 'boreArea', 'travel', 'twist', 'propellantTemperature']
    const typed = Object.fromEntries(keep.map((k) => [k, siValues[k as keyof typeof siValues]]))
    const data = { cartridge: 'beta-pistol', bullet: longBullet.id, powder: fitted.id }
    const sparse = await simulate(
      file({ ...data, siValues: { charge: siValues.charge, ...typed } }),
    )
    expect(sparse.status).toBe(200)
    const powderValues = powderModelValues(fitted as never) as Record<string, number>
    const full = await simulate(
      file({
        ...data,
        siValues: {
          ...siValues,
          ...powderValues,
          bulletMass: toSi('mass', longBullet.mass.value),
        },
      }),
    )
    expect(sparse.body.summary).toEqual(full.body.summary)
    // a typed value wins over the record's
    const typedGamma = await simulate(
      file({ ...data, siValues: { charge: siValues.charge, ...typed, gamma: 1.3 } }),
    )
    expect(typedGamma.body.summary.peakPressure).not.toBe(sparse.body.summary.peakPressure)
  })

  it('answers 422 with the value no record gives, at its key under the overrides', async () => {
    const { vivacity: _, ...noVivacity } = siValues
    const res = await simulate(file({ siValues: noVivacity }))
    expect(res.status).toBe(422)
    expect(res.body.reason).toBe('missingValues')
    expect(res.body.notice).toBe('simulation, not load data')
    expect(res.body.missing).toEqual([
      {
        key: 'vivacity',
        path: ['records', 0, 'data', 'analysis', 'overrides', 'vivacity'],
        quantity: 'burnRate',
      },
    ])
    // the powder record gives it
    expect((await simulate(file({ siValues: noVivacity, powder: fitted.id }))).status).toBe(200)
  })

  it('lists every missing value in one 422, the charge at the load', async () => {
    const { charge: _c, volume: _v, twist: _t, gamma: _g, ...rest } = siValues
    const res = await simulate(file({ siValues: rest }))
    expect(res.status).toBe(422)
    expect(res.body.missing).toEqual([
      {
        key: 'volume',
        path: ['records', 0, 'data', 'analysis', 'overrides', 'volume'],
        quantity: 'volume',
      },
      {
        key: 'twist',
        path: ['records', 0, 'data', 'analysis', 'overrides', 'twist'],
        quantity: 'length',
      },
      { key: 'charge', path: ['records', 0, 'data', 'charge'], quantity: 'mass' },
      {
        key: 'gamma',
        path: ['records', 0, 'data', 'analysis', 'overrides', 'gamma'],
        quantity: 'dimensionless',
      },
    ])
    expect(res.body.message).toContain('volume, twist, charge, gamma')
    // a file with nothing typed names every value, the powder and bullet records take theirs off
    const none = await simulate(file({}))
    expect(none.status).toBe(422)
    expect(none.body.missing).toHaveLength(16)
    const records = await simulate(file({ powder: fitted.id, bullet: longBullet.id }))
    expect(records.body.missing.map((m: { key: string }) => m.key)).toEqual([
      'volume',
      'boreDiameter',
      'travel',
      'twist',
      'charge',
      'propellantTemperature',
    ])
  })

  it('answers an unknown record id with 404', async () => {
    expect((await simulate(file({ siValues, cartridge: 'nope' }))).status).toBe(404)
    expect((await simulate(file({ siValues, bullet: 'nope' }))).status).toBe(404)
    expect((await simulate(file({ siValues, powder: 'nope' }))).status).toBe(404)
  })
})

describe('POST /interior/load-file, references', () => {
  it('reads a catalogue reference like a plain id', async () => {
    const plain = await simulate(file({ siValues, cartridge: 'beta-pistol' }))
    const ref = await simulate(file({ siValues, cartridge: 'catalogue:beta-pistol' }))
    expect(ref.status).toBe(200)
    expect(ref.body.resolved.cartridge.id).toBe('beta-pistol')
    expect(ref.body.summary).toEqual(plain.body.summary)
  })

  it('answers 400 at the field of a user reference: user records are not on the server', async () => {
    const user = `user:${crypto.randomUUID()}`
    for (const k of ['cartridge', 'bullet']) {
      const res = await simulate(file({ siValues, [k]: user }))
      expect(res.status).toBe(400)
      expect(res.body.issues.map((i: { path: unknown[] }) => i.path)).toEqual([
        ['records', 0, 'data', k],
      ])
    }
  })
})

describe('POST /interior/load-file, 400 with the field path', () => {
  const paths = async (body: unknown, query = '') => {
    const res = await simulate(body, query)
    expect(res.status).toBe(400)
    expect(res.body.notice).toBe('simulation, not load data')
    return res.body.issues.map((i: { path: unknown[] }) => i.path)
  }
  const at = ['records', 0, 'data']

  it('maps every load field of a file to its value in the file', () => {
    const values = Object.fromEntries(interiorValueKeys.map((k, i) => [k, 1 + i / 64]))
    const load = { ...interiorLoad(values), resistance: overrideResistance(undefined, values) }
    const leaves = (x: unknown, path: string[]): [string[], number][] =>
      typeof x === 'number'
        ? [[path, x]]
        : x && typeof x === 'object'
          ? Object.entries(x).flatMap(([k, v]) => leaves(v, [...path, k]))
          : []
    const mapped = new Set<string>()
    for (const [path, x] of leaves(load, [])) {
      const key = interiorValueKeys.find((k) => values[k] === x)
      if (key === undefined) continue
      expect(filePath(['load', ...path], at)).toEqual(
        key === 'charge' ? [...at, 'charge'] : [...at, 'analysis', 'overrides', key],
      )
      mapped.add(key)
    }
    expect([...mapped].sort()).toEqual([...interiorValueKeys].sort())
  })

  it('names an unknown field at each level', async () => {
    expect(await paths(file({ siValues }, { extra: 1 }))).toContainEqual(['extra'])
    expect(await paths(file({ siValues, extra: 1 }))).toContainEqual([...at, 'extra'])
    expect(await paths(file({ siValues: { ...siValues, extra: 1 } }))).toContainEqual([
      ...at,
      'analysis',
      'overrides',
      'extra',
    ])
    const record = { ...file({ siValues }).records[0], extra: 1 }
    expect(await paths({ ...file({ siValues }), records: [record] })).toContainEqual([
      'records',
      0,
      'extra',
    ])
    expect(await paths(file({ siValues }), '?extra=1')).toContainEqual(['extra'])
    expect(await paths(file({ siValues }), '?curves=yes')).toContainEqual(['curves'])
  })

  it('does not take inherited names for fields', async () => {
    const record = { ...file({ siValues }).records[0], constructor: 1 }
    expect(await paths({ ...file({ siValues }), records: [record], toString: 1 })).toEqual([
      ['records', 0, 'constructor'],
      ['toString'],
    ])
    expect(await paths(file({ siValues, valueOf: 1 }))).toEqual([[...at, 'valueOf']])
    expect(await paths(file({ siValues: { ...siValues, hasOwnProperty: 1 } }))).toEqual([
      [...at, 'analysis', 'overrides', 'hasOwnProperty'],
    ])
  })

  it('answers a bad file with 400 before it looks up its records', async () => {
    const ladder = { stepCount: 3, chargeStep: 1, direction: 'up' }
    expect(await paths(file({ siValues, cartridge: 'nope', bullet: 'nope', ladder }))).toEqual([
      [...at, 'analysis', 'ladder', 'step'],
    ])
  })

  it('names a partly filled burn form', async () => {
    expect(await paths(file({ siValues: { ...siValues, formA: 0.5 } }))).toEqual([
      [...at, 'analysis', 'overrides', 'formM'],
    ])
  })

  it('answers a value the model refuses with 422, as /interior does', async () => {
    const { status, body } = await simulate(file({ siValues: { ...siValues, volume: -1 } }))
    expect(status).toBe(422)
    expect(body.notice).toBe('simulation, not load data')
  })

  it('refuses a record of the old kind and names the kind that replaces it', async () => {
    const old = file({ siValues })
    old.records[0].kind = 'workbenchState'
    const res = await simulate(old)
    expect(res.status).toBe(400)
    expect(res.body.issues).toEqual([
      expect.objectContaining({ path: ['records', 0, 'kind'], message: legacyLoadProblem }),
    ])
  })

  it('refuses the case water capacity of the earlier format at its path', async () => {
    const res = await simulate(file({ siValues, case: { waterCapacity: { value: 3.6 } } }))
    expect(res.status).toBe(400)
    expect(res.body.issues.map((i: { path: unknown[] }) => i.path)).toEqual([
      ['records', 0, 'data', 'case', 'waterCapacity'],
    ])
  })

  it('has one override per workbench key but the charge', () => {
    expect([...Object.keys(analysisKinds), 'charge'].sort()).toEqual([...workbenchValueKeys].sort())
  })

  it('names a file that is not one load', async () => {
    expect(await paths({ ...file({ siValues }), records: [] })).toEqual([['records']])
    const two = file({ siValues })
    two.records.push({ ...two.records[0], id: 'l2' })
    expect(await paths(two)).toEqual([['records']])
    expect(await paths({ ...file({ siValues }), version: 99 })).toContainEqual(['version'])
    expect(await paths({ format: 'other' })).toContainEqual(['format'])
  })

  it('refuses a file of another format version, naming the version it reads', async () => {
    const { status, body } = await simulate({ ...file({ siValues }), version: 4 })
    expect(status).toBe(400)
    expect(body.issues).toEqual([
      expect.objectContaining({
        path: ['version'],
        message: 'The file has format version 4; this app reads version 1.',
      }),
    ])
  })
})
