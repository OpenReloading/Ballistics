import { describe, expect, it } from 'vitest'
import { interior, type ShotshellLoad, shotshellInterior } from '../src/index.ts'

/** Synthetic 12 gauge load; values are assumed, not a published load. */
const load = (over: Partial<ShotshellLoad> = {}): ShotshellLoad => ({
  chamber: { volume: 3e-6, boreDiameter: 18.42e-3 },
  wadTravel: 0.69,
  shotMass: 0.028,
  wadMass: 0.0025,
  crimpPressure: 2e6,
  charge: 0.00165,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'vivacity',
      vivacity: 2,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'twoStage', a: 0.8, m: 0.5, q: 0.5, z1: 0.8 },
    },
  },
  propellantTemperature: 293.15,
  ignitionPressure: 1e6,
  ...over,
})

const valid = (r: ReturnType<typeof shotshellInterior>) => {
  if (!r.valid) throw new Error(`${r.reason} ${r.field ?? ''}`)
  return r
}

describe('shotshellInterior', () => {
  it('gives the result of interior on the mapped load', () => {
    const { chamber, wadTravel, shotMass, wadMass, crimpPressure, ...rest } = load()
    const m3 = interior({
      ...rest,
      chamber: { ...chamber, boreArea: (Math.PI / 4) * chamber.boreDiameter ** 2 },
      barrel: { length: wadTravel, twist: 0 },
      bullet: { mass: shotMass + wadMass },
      startPressure: crimpPressure,
    })
    if (!m3.valid) throw new Error(m3.reason)
    const r = valid(shotshellInterior(load()))
    expect(r.muzzleVelocity).toBe(m3.muzzleVelocity)
    expect(r.peakBreechPressure).toBe(m3.peakBreechPressure)
    expect(r.shotStartTime).toBe(m3.shotStartTime)
    expect(r.energy.rotation).toBe(0)
  })

  it('holds the column until the crimp opens', () => {
    const low = valid(shotshellInterior(load()))
    const high = valid(shotshellInterior(load({ crimpPressure: 6e6 })))
    expect(high.shotStartTime).toBeGreaterThan(low.shotStartTime)
    expect(high.peakBreechPressure).toBeGreaterThan(low.peakBreechPressure)
  })

  it('labels valid and invalid results experimental', () => {
    expect(shotshellInterior(load()).experimental).toBe(true)
    expect(shotshellInterior(load({ shotMass: 0 }))).toEqual({
      valid: false,
      reason: 'input',
      field: 'shotMass',
      experimental: true,
    })
    expect(shotshellInterior(load({ charge: -1 }))).toMatchObject({
      field: 'charge',
      experimental: true,
    })
  })

  it('names the shotshell fields of invalid inputs', () => {
    const field = (over: Partial<ShotshellLoad>) => {
      const r = shotshellInterior(load(over))
      return r.valid ? undefined : r.field
    }
    expect(field({ wadMass: -0.001 })).toBe('wadMass')
    expect(field({ crimpPressure: Number.NaN })).toBe('crimpPressure')
    expect(field({ wadTravel: 0 })).toBe('wadTravel')
    expect(field({ chamber: { volume: 3e-6, boreDiameter: -1 } })).toBe('chamber.boreDiameter')
    expect(field({ chamber: { volume: 0, boreDiameter: 18.42e-3 } })).toBe('chamber.volume')
    expect(field({ wadMass: 0 })).toBeUndefined()
  })
})
