import { workbenchValueKeys } from '@openreloading/core'
import { ladderStepKinds, load as loadSchema } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import { interiorFields } from '../src/lib/interior-input.ts'
import {
  fromLoad,
  type Givers,
  givenKeys,
  type LoadParts,
  overrideKeys,
  toLoad,
} from '../src/lib/load-record.ts'
import { canonicalJson } from '../src/lib/user-data.ts'

const none: Givers = {
  defaults: {},
  defaulted: new Set(),
  followed: new Set(),
  suggestions: {},
  previewed: {},
  seatingKept: false,
  gunMass: false,
}

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
  sebert: 0.9,
  formA: 0.05,
  formM: 0.5,
  formQ: 0.5,
  formZ1: 0.8,
  leakArea: 1e-9,
  boreFriction: 3e6,
  engravingPressure: 1.2e7,
  engravingLength: 0.0007,
  firearmMass: 3.7,
}

const parts = (over: Partial<LoadParts> = {}): LoadParts => ({
  values,
  given: new Set(),
  cartridge: 'catalogue:308-win',
  bullet: 'catalogue:demo-bullet-168',
  powder: 'catalogue:demo-powder-dp40',
  notes: '',
  measurements: [],
  ...over,
})

describe('the keys of a load', () => {
  it('are the workbench fields but the charge, the keys the solver reads', () => {
    expect([...overrideKeys, 'charge'].sort()).toEqual([...workbenchValueKeys].sort())
    expect(interiorFields.map((f) => f.key).filter((k) => k !== 'charge')).toEqual(
      expect.arrayContaining(overrideKeys.filter((k) => k !== 'firearmMass')),
    )
  })
})

describe('toLoad', () => {
  it('saves the typed values under analysis.overrides in stored units and the charge as its own', () => {
    const l = toLoad(parts())
    expect(l.charge).toEqual({ value: 2.4 })
    expect(l.analysis?.overrides?.bulletMass).toBe(10.886)
    expect(l.analysis?.overrides?.propellantTemperature).toBe(21)
    expect(l.analysis?.overrides?.startPressure).toBe(250)
    expect(l.analysis?.overrides?.volume).toBe(3.6)
    expect(l.analysis?.overrides).not.toHaveProperty('charge')
    expect(loadSchema.safeParse(l).success).toBe(true)
  })

  it('leaves out every value a record, the Settings, the seating or the gun gives', () => {
    const given = new Set(['bulletMass', 'volume', 'twist', 'firearmMass', 'gamma'])
    const l = toLoad(parts({ given }))
    for (const k of given) expect(l.analysis?.overrides).not.toHaveProperty(k)
    expect(l.analysis?.overrides?.boreDiameter).toBe(7.62)
  })

  it('writes no analysis for a load of references only', () => {
    const l = toLoad(parts({ values: { charge: 0.0024 } }))
    expect(l.analysis).toBeUndefined()
    expect(l.charge).toEqual({ value: 2.4 })
  })

  it('leaves a charge of 0 out, as the schema would reject it', () => {
    const l = toLoad(parts({ values: { charge: 0 } }))
    expect(l.charge).toBeUndefined()
    expect(loadSchema.safeParse(l).success).toBe(true)
  })

  it('writes an empty text and no series as absent', () => {
    const l = toLoad(parts({ values: {}, notes: '' }))
    expect(l.note).toBeUndefined()
    expect(l.measurements).toBeUndefined()
    expect(l.case).toBeUndefined()
    expect(l.seating).toBeUndefined()
  })

  it('stores the ladder step in the unit of its kind and leaves the charge kind out', () => {
    const charge = toLoad(
      parts({ ladder: { kind: 'charge', stepCount: 5, step: 1.3e-5, direction: 'down' } }),
    )
    expect(charge.analysis?.ladder).toEqual({ stepCount: 5, step: 0.013, direction: 'down' })
    const seating = toLoad(
      parts({ ladder: { kind: 'seating', stepCount: 3, step: 0.0005, direction: 'around' } }),
    )
    expect(seating.analysis?.ladder).toEqual({
      kind: 'seating',
      stepCount: 3,
      step: 0.5,
      direction: 'around',
    })
    const temperature = toLoad(
      parts({ ladder: { kind: 'temperature', stepCount: 4, step: 10, direction: 'up' } }),
    )
    expect(temperature.analysis?.ladder?.step).toBe(10)
    expect(ladderStepKinds.temperature).toBe('absoluteTemperature')
  })

  it('leaves a step of 0 out, as the schema would reject it', () => {
    const l = toLoad(parts({ ladder: { kind: 'charge', stepCount: 3, step: 0, direction: 'up' } }))
    expect(l.analysis?.ladder?.step).toBeUndefined()
    expect(loadSchema.safeParse(l).success).toBe(true)
  })
})

describe('givenKeys', () => {
  const v = { bulletMass: 0.010886, gamma: 1.215, volume: 3.6e-6, travel: 0.5, twist: 0.254 }

  it('knows the values of the powder record, within rounding', () => {
    const g = givenKeys(v, { ...none, origin: { gamma: 1.215 * (1 + 1e-12), vivacity: 1 } })
    expect([...g]).toEqual(['gamma'])
  })

  it('knows the mass of the bullet record or design', () => {
    expect([...givenKeys(v, { ...none, bulletMass: 0.010886 })]).toEqual(['bulletMass'])
    expect([...givenKeys(v, { ...none, bulletMass: 0.0108 })]).toEqual([])
  })

  it('knows a Settings default while the field holds it', () => {
    const g = givenKeys(v, {
      ...none,
      defaults: { gamma: 1.215, twist: 0.3 },
      defaulted: new Set(['gamma', 'twist']),
    })
    expect([...g]).toEqual(['gamma'])
    expect([...givenKeys(v, { ...none, defaults: { gamma: 1.215 } })]).toEqual([])
  })

  it('knows a followed default while the field holds it', () => {
    const g = givenKeys(v, {
      ...none,
      followed: new Set(['volume', 'twist']),
      suggestions: { volume: 3.6e-6, twist: 0.3 },
    })
    expect([...g]).toEqual(['volume'])
  })

  it('knows the volume and travel of a seating the load keeps', () => {
    const previewed = { volume: 3.6e-6, travel: 0.4 }
    expect([...givenKeys(v, { ...none, previewed, seatingKept: true })]).toEqual(['volume'])
    expect([...givenKeys(v, { ...none, previewed })]).toEqual([])
  })

  it('knows the gun weight of a firearm the load names, and a typed one', () => {
    expect([...givenKeys({ firearmMass: 3.7 }, { ...none, gunMass: true })]).toEqual([
      'firearmMass',
    ])
    expect([...givenKeys({ firearmMass: 3.7 }, none)]).toEqual([])
  })

  it('has no key for an empty field', () => {
    expect([...givenKeys({ gamma: undefined }, { ...none, origin: { gamma: 1.2 } })]).toEqual([])
  })
})

describe('opening and saving a load', () => {
  const full = parts({
    firearm: 'user:6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c21',
    notes: 'first ladder',
    waterCapacity: 3.6e-6,
    seating: { by: 'overallLength', value: 0.07112 },
    ladder: { kind: 'seating', stepCount: 5, step: 0.0003, direction: 'around' },
    measurements: [
      {
        name: 'day1.csv',
        muzzleDistance: 3,
        strings: [{ label: 'A', charge: 0.0024, shots: [{ velocity: { value: 800 } }] }],
      },
    ],
  })

  /** What the workbench holds after it opened `l`: the values of the query and the series. */
  const reopened = (l: ReturnType<typeof toLoad>): LoadParts => {
    const { query, measurements } = fromLoad(l)
    const si = (k: string) => (query.has(k) ? Number(query.get(k)) : undefined)
    const kind = (query.get('ladderKind') ?? 'charge') as 'charge' | 'seating' | 'temperature'
    return {
      values: Object.fromEntries([...overrideKeys, 'charge'].map((k) => [k, si(k)])),
      given: new Set(),
      cartridge: l.cartridge,
      firearm: l.firearm,
      bullet: typeof l.bullet === 'string' ? l.bullet : undefined,
      powder: typeof l.powder === 'string' ? l.powder : undefined,
      notes: l.note ?? '',
      waterCapacity: si('measuredWaterCapacity'),
      seating: l.seating && {
        by: l.seating.by,
        value: Number(query.get(l.seating.by)),
      },
      ladder:
        (query.has('ladderSteps') && {
          kind,
          stepCount: Number(query.get('ladderSteps')),
          step: si('ladderStep'),
          direction: query.get('ladderDirection') as 'up',
        }) ||
        undefined,
      measurements,
    }
  }

  it('gives the same load after opening and saving it again', () => {
    const saved = toLoad(full)
    expect(loadSchema.safeParse(saved).success).toBe(true)
    const again = toLoad(reopened(saved))
    expect(canonicalJson(again)).toBe(canonicalJson(saved))
    // and once more: the rounding of stored values settles at the first save
    expect(canonicalJson(toLoad(reopened(again)))).toBe(canonicalJson(again))
  })

  it('opens the typed values and the charge as a link would carry them, in SI', () => {
    const { query, typed } = fromLoad(toLoad(full))
    expect(Number(query.get('bulletMass'))).toBeCloseTo(0.010886, 12)
    expect(Number(query.get('propellantTemperature'))).toBeCloseTo(294.15, 9)
    expect(Number(query.get('charge'))).toBeCloseTo(0.0024, 12)
    expect(Number(query.get('overallLength'))).toBeCloseTo(0.07112, 12)
    expect(Number(query.get('measuredWaterCapacity'))).toBeCloseTo(3.6e-6, 12)
    expect(query.get('ladderKind')).toBe('seating')
    expect(Number(query.get('ladderStep'))).toBeCloseTo(0.0003, 12)
    expect(typed.has('bulletMass')).toBe(true)
    expect(typed.has('charge')).toBe(false)
  })

  it('opens a load of references only with nothing typed', () => {
    const { query, typed } = fromLoad({ origin: 'user', cartridge: 'catalogue:308-win' })
    expect([...query.keys()]).toEqual([])
    expect(typed.size).toBe(0)
  })
})
