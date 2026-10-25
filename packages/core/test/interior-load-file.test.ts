import { describe, expect, it } from 'vitest'
import {
  boreArea,
  burnFormKeys,
  cartridgeBoreAreaMm2,
  checkResistanceValues,
  fillLoadRatioLimit,
  interiorLoad,
  interiorValueKeys,
  loadRatio,
  missingLoadKeys,
  overrideResistance,
  recordResistance,
  solidFill,
  solidFillLimit,
  unknownValueKeys,
  ValueError,
  workbenchValueKeys,
} from '../src/index.ts'

const values: Record<string, number> = {
  volume: 3.4e-6,
  boreDiameter: 7.82e-3,
  travel: 0.6,
  twist: 0.305,
  bulletMass: 0.0109,
  charge: 0.0028,
  propellantEnergy: 4.0779e6,
  gamma: 1.22,
  density: 1600,
  covolume: 0.000983,
  vivacity: 0.59,
  exponent: 1,
  referencePressure: 98066.5,
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 1e7,
}

describe('missingLoadKeys', () => {
  it('lists every key interiorLoad needs, as interiorLoad throws for each alone', () => {
    expect(missingLoadKeys(values)).toEqual([])
    for (const key of Object.keys(values)) {
      const { [key]: _, ...rest } = values
      expect(missingLoadKeys(rest)).toEqual([key])
      expect(() => interiorLoad(rest)).toThrow(expect.objectContaining({ field: key }))
    }
  })

  it('names all missing keys at once, a non-finite value among them, and not the optional bore area', () => {
    const { volume: _v, twist: _t, ...rest } = values
    expect(missingLoadKeys({ ...rest, gamma: Number.NaN, boreArea: undefined })).toEqual([
      'volume',
      'twist',
      'gamma',
    ])
    expect(missingLoadKeys({})).toHaveLength(Object.keys(values).length)
  })
})

describe('interiorLoad', () => {
  it('maps the field values; an empty bore area is the circle of the bore diameter', () => {
    const load = interiorLoad(values)
    expect(load.chamber.boreArea).toBeCloseTo((Math.PI * 7.82e-3 ** 2) / 4, 15)
    expect(load.propellant.burn).toMatchObject({ form: { kind: 'constant' } })
    expect(load).not.toHaveProperty('gradient')
    expect(interiorLoad({ ...values, boreArea: 4.7e-5, sebert: 0.3 })).toMatchObject({
      chamber: { boreArea: 4.7e-5 },
      gradient: { energy: 0.3, breech: 0.3 },
    })
  })

  it('takes an empty bore area from the groove diameter, else the bore diameter', () => {
    const d = 7.82e-3
    expect(interiorLoad(values, undefined, 7.82e-3 + 1e-4).chamber.boreArea).toBeCloseTo(
      (Math.PI / 4) * (d + 5e-5) ** 2,
      15,
    )
    expect(interiorLoad({ ...values, boreArea: 4.7e-5 }, undefined, 8e-3).chamber.boreArea).toBe(
      4.7e-5,
    )
  })

  it('reads the two-stage form when all four values are there', () => {
    const form = { formA: 0, formM: 0.5, formQ: 0.5, formZ1: 0.8 }
    expect(interiorLoad({ ...values, ...form }).propellant.burn).toMatchObject({
      form: { kind: 'twoStage', a: 0, m: 0.5, q: 0.5, z1: 0.8 },
    })
  })

  it('names the field of a missing value, with the label given', () => {
    const missing = { ...values, charge: undefined }
    expect(() => interiorLoad(missing)).toThrow('Enter a number for charge.')
    expect(() => interiorLoad(missing, () => 'Charge mass')).toThrow('Charge mass')
    expect(() => interiorLoad({ ...values, sebert: Number.POSITIVE_INFINITY })).toThrow(
      'Enter a number for sebert.',
    )
    try {
      interiorLoad({ ...values, vivacity: Number.NaN })
    } catch (error) {
      expect(error).toBeInstanceOf(ValueError)
      expect((error as ValueError).field).toBe('vivacity')
    }
  })

  it('refuses a partly filled burn form at the first empty field', () => {
    expect(() => interiorLoad({ ...values, formA: 0.8 })).toThrow('m, q, z1')
    expect(() => interiorLoad({ ...values, formA: 0.8 })).toThrow(ValueError)
  })

  it('reads a leak area as a constant over the travel; no value, no leakage', () => {
    expect(interiorLoad(values)).not.toHaveProperty('leakage')
    expect(interiorLoad({ ...values, leakArea: 2e-6 }).leakage).toEqual({
      area: [
        { travel: 0, area: 2e-6 },
        { travel: 0.6, area: 2e-6 },
      ],
    })
    expect(() => interiorLoad({ ...values, leakArea: Number.NaN })).toThrow(ValueError)
  })

  it('takes a leak area of 0 and refuses one below 0, naming the field', () => {
    expect(interiorLoad({ ...values, leakArea: 0 }).leakage?.area[0].area).toBe(0)
    expect(() => interiorLoad({ ...values, leakArea: -1e-9 })).toThrow(
      expect.objectContaining({ field: 'leakArea' }),
    )
  })

  it('lists the keys it reads', () => {
    const read = new Set(interiorValueKeys)
    for (const key of Object.keys(values)) expect(read.has(key as never)).toBe(true)
    for (const key of Object.keys(burnFormKeys)) expect(read.has(key as never)).toBe(true)
  })
})

describe('loadRatio', () => {
  it('is the charge bulk volume over the free volume; none without bulk density', () => {
    expect(loadRatio(0.0028, 900, 3.4e-6)).toBeCloseTo(0.0028 / 900 / 3.4e-6, 12)
    expect(loadRatio(0.0028, undefined, 3.4e-6)).toBeUndefined()
    expect(loadRatio(0.0028, 900, 0)).toBeUndefined()
  })
})

describe('solidFill', () => {
  it('is the charge solid volume over the chamber volume', () => {
    expect(solidFill(0.0028, 1600, 3.4e-6)).toBeCloseTo(0.0028 / 1600 / 3.4e-6, 12)
  })

  it('gives the load ratio at the limit from the solid and bulk densities', () => {
    // 0.64 of the chamber as solid at 1.6 g/cm³ is load ratio 0.64 * 1.6 / 0.9 at 0.9 g/cm³ bulk
    expect(fillLoadRatioLimit(1600, 900)).toBeCloseTo((0.64 * 1.6) / 0.9, 12)
    const charge = solidFillLimit * 1600 * 3.4e-6
    expect(loadRatio(charge, 900, 3.4e-6)).toBeCloseTo(fillLoadRatioLimit(1600, 900), 12)
  })
})

describe('recordResistance', () => {
  const run = {
    boreDiameter: 7.82e-3,
    boreArea: 4.75e-5,
    startPressure: 1e7,
    cartridge: { g1: 7.85, z: 7.82 },
    bulletLengthMm: 30,
  }
  const law = { interior: { resistance: { stress: { value: 4.2 }, oversize: 1.3, engraving: 0 } } }

  it('gives nothing for a record without the law', () => {
    expect(recordResistance({}, run)).toEqual({ missing: [] })
  })

  it('names what the run lacks', () => {
    expect(recordResistance(law, { ...run, cartridge: undefined }).missing).toEqual([
      'a cartridge record',
    ])
    expect(recordResistance(law, { ...run, bulletLengthMm: undefined }).missing).toEqual([
      'a bullet length',
    ])
  })

  it('applies the law with stress in bar', () => {
    const { resistance, missing } = recordResistance(law, run)
    expect(missing).toEqual([])
    expect(resistance?.friction).toBeGreaterThan(0)
  })
})

describe('overrideResistance', () => {
  const record = {
    friction: 2e6,
    engraving: [
      { travel: 0, pressure: 3e6 },
      { travel: 0.03, pressure: 0 },
    ],
  }

  it('is the record itself without an override', () => {
    expect(overrideResistance(record, {})).toBe(record)
    expect(overrideResistance(undefined, {})).toBeUndefined()
  })

  it('replaces the friction and keeps the record engraving', () => {
    expect(overrideResistance(record, { boreFriction: 5e5 })).toEqual({ ...record, friction: 5e5 })
    expect(overrideResistance(record, { boreFriction: 0 })).toEqual({ ...record, friction: 0 })
  })

  it('replaces the start or the length of the engraving ramp, the other staying the record', () => {
    expect(overrideResistance(record, { engravingPressure: 4e6 })?.engraving).toEqual([
      { travel: 0, pressure: 4e6 },
      { travel: 0.03, pressure: 0 },
    ])
    expect(overrideResistance(record, { engravingLength: 0.02 })?.engraving).toEqual([
      { travel: 0, pressure: 3e6 },
      { travel: 0.02, pressure: 0 },
    ])
  })

  it('stands alone without a record, with both engraving values', () => {
    expect(overrideResistance(undefined, { boreFriction: 1e6 })).toEqual({ friction: 1e6 })
    expect(
      overrideResistance(undefined, { engravingPressure: 1e6, engravingLength: 0.01 })?.engraving,
    ).toHaveLength(2)
  })

  it('names the engraving value that has nothing to complete it', () => {
    expect(() => overrideResistance(undefined, { engravingPressure: 1e6 })).toThrow(ValueError)
    try {
      overrideResistance(undefined, { engravingLength: 0.01 })
    } catch (error) {
      expect((error as ValueError).field).toBe('engravingPressure')
    }
  })

  it('takes 0 for a friction and an engraving pressure, refuses what the solver refuses', () => {
    expect(() =>
      checkResistanceValues({ boreFriction: 0, engravingPressure: 0, engravingLength: 1e-6 }),
    ).not.toThrow()
    for (const [key, value] of [
      ['boreFriction', -1],
      ['engravingPressure', -1],
      ['engravingLength', 0],
      ['engravingLength', -0.01],
      ['engravingLength', Number.NaN],
    ] as const)
      expect(() => overrideResistance(undefined, { [key]: value }), `${key} ${value}`).toThrow(
        expect.objectContaining({ field: key }),
      )
  })
})

describe('boreArea', () => {
  const c = { boreDiameter: 7.62, grooveDiameter: 7.82 }
  it('is Q, else the circle of the mean of F and Z, else of F', () => {
    expect(boreArea({ ...c, area: 47.51 })).toBe(47.51)
    expect(boreArea(c)).toBeCloseTo((Math.PI / 4) * 7.72 ** 2, 12)
    expect(boreArea({ boreDiameter: 7.62 })).toBeCloseTo((Math.PI / 4) * 7.62 ** 2, 12)
  })

  it('reads Q of the CIP chamber', () => {
    const q = (value?: number) => ({ values: [{ side: 'chamber', symbol: 'Q', value }] })
    expect(cartridgeBoreAreaMm2(q(47.51))).toBe(47.51)
    expect(cartridgeBoreAreaMm2(q())).toBeUndefined()
  })
})

describe('unknownValueKeys', () => {
  it('lists the keys the workbench never saves', () => {
    expect(unknownValueKeys({ charge: 1, firearmMass: 2, extra: 3, other: 4 })).toEqual([
      'extra',
      'other',
    ])
    expect(unknownValueKeys(Object.fromEntries(workbenchValueKeys.map((k) => [k, 1])))).toEqual([])
  })
})
