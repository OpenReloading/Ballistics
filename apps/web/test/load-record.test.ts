import { workbenchValueKeys } from '@openreloading/core'
import {
  checkUserRefs,
  ladderStepKinds,
  load as loadSchema,
  parseRef,
  userId,
  userRecord,
} from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import { interiorFields } from '../src/lib/interior-input.ts'
import {
  capacityOfRecord,
  capacityRecord,
  fromLoad,
  type Givers,
  givenKeys,
  type LoadParts,
  measuredCapacityId,
  measuredCapacityRef,
  overrideKeys,
  savedCapacityRef,
  toLoad,
} from '../src/lib/load-record.ts'
import { waterVolume } from '../src/lib/units.ts'
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
    capacity: measuredCapacityRef('catalogue:308-win', 3.6e-6),
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
      capacity: l.capacity,
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
    expect(query.has('measuredWaterCapacity')).toBe(false)
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

describe('the measured case capacity of a load', () => {
  const cartridge = 'catalogue:308-win'
  const m3 = waterVolume(3.6)

  it('is read from a stored record of the load cartridge only', () => {
    const r = capacityRecord(cartridge, m3, new Date('2026-10-25T10:00:00Z'))
    expect(capacityOfRecord(r, cartridge)).toBe(3.6)
    expect(capacityOfRecord(r, 'catalogue:223-rem')).toBeUndefined()
    expect(capacityOfRecord({ kind: 'powder' }, cartridge)).toBeUndefined()
    expect(capacityOfRecord(undefined, cartridge)).toBeUndefined()
  })

  it('is saved as the measured record, else the request not answered, else the choice', () => {
    const user = measuredCapacityRef(cartridge, m3)
    const catalogue = 'catalogue:308-win-1'
    expect(savedCapacityRef(user, user, catalogue)).toBe(user)
    expect(savedCapacityRef(undefined, 'user:missing', undefined)).toBe('user:missing')
    // a chosen capacity clears the request, so the choice is what is left to save
    expect(savedCapacityRef(undefined, undefined, catalogue)).toBe(catalogue)
    expect(savedCapacityRef(undefined, undefined, undefined)).toBeUndefined()
  })

  it('is a user capacity record named by the load', () => {
    const l = toLoad(
      parts({ capacity: measuredCapacityRef(cartridge, m3), cartridge: 'catalogue:308-win' }),
    )
    expect(loadSchema.safeParse(l).success).toBe(true)
    expect(l.capacity).toBe(`user:${measuredCapacityId(cartridge, m3)}`)
    expect(l.case).toBeUndefined()
  })

  it('has an id of one measurement: same value, same record, another value another one', () => {
    const id = measuredCapacityId(cartridge, m3)
    expect(userId.safeParse(id).success).toBe(true)
    expect(measuredCapacityId(cartridge, m3)).toBe(id)
    // a value read back from the stored grams has the same id
    expect(measuredCapacityId(cartridge, waterVolume(3.6000000000004))).toBe(id)
    expect(measuredCapacityId(cartridge, waterVolume(3.7))).not.toBe(id)
    expect(measuredCapacityId('catalogue:223-rem', m3)).not.toBe(id)
  })

  it('stores the water in g, and gives the volume back when opened', () => {
    const r = capacityRecord(cartridge, m3, new Date('2026-10-25T10:00:00Z'))
    const parsed = userRecord.parse(r)
    expect(parsed.kind === 'caseCapacity' && parsed.data.waterCapacity.value).toBe(3.6)
    expect(
      parsed.kind === 'caseCapacity' && waterVolume(parsed.data.waterCapacity.value),
    ).toBeCloseTo(m3, 15)
    expect(parseRef(measuredCapacityRef(cartridge, m3))?.id).toBe(r.id)
  })

  it('is answered by its record: no reference is left dangling', () => {
    const l = userRecord.parse({
      kind: 'load',
      id: 'l1',
      name: 'Load',
      saved: '2026-10-25T10:00:00.000Z',
      data: toLoad(parts({ capacity: measuredCapacityRef(cartridge, m3) })),
    })
    const r = userRecord.parse(capacityRecord(cartridge, m3, new Date()))
    expect(checkUserRefs([l]).map((d) => d.field)).toEqual(['capacity'])
    expect(checkUserRefs([l, r])).toEqual([])
  })
})
