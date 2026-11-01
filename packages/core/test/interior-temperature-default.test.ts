import { describe, expect, it } from 'vitest'
import { type InteriorLoad, interior } from '../src/interior/model.ts'
import {
  coldPeakInterval,
  defaultSensitivity,
  sensitivityReferenceDefault,
} from '../src/interior/temperature-default.ts'

/** A stand-in rifle load at about 380 MPa: 2.8 g of a seven-perforated grain behind 10.9 g. */
const load: InteriorLoad = {
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 7e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0109 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'geometric',
      coefficient: 1.6e-9,
      exponent: 0.9,
      grain: { shape: 'sevenPerf', diameter: 1.25e-3, perforationDiameter: 1.5e-4, length: 2e-3 },
    },
  },
  propellantTemperature: sensitivityReferenceDefault,
  ignitionPressure: 5e6,
  startPressure: 25e6,
}

describe('defaultSensitivity', () => {
  it('gives ball the measured burn-rate sensitivity and its interval', () => {
    const d = defaultSensitivity('ball')
    expect(d).toMatchObject({ hot: 0.0027, hotInterval: [0.0023, 0.0031], cold: 0.0012 })
    expect(d?.source).toMatch(/Boulkadid/)
  })
  it('gives extruded and flake the value derived from the maker table, other none', () => {
    expect(defaultSensitivity('extruded')).toBe(defaultSensitivity('flake'))
    expect(defaultSensitivity('extruded')?.hotInterval).toEqual([0.0001, 0.0029])
    expect(defaultSensitivity('other')).toBeUndefined()
    expect(defaultSensitivity(undefined)).toBeUndefined()
  })
  it('keeps every value inside its interval and the cold interval from 0 to 0.0030', () => {
    for (const form of ['ball', 'extruded'])
      for (const d of [defaultSensitivity(form)]) {
        if (!d) throw new Error(form)
        expect(d.hot).toBeGreaterThanOrEqual(d.hotInterval[0])
        expect(d.hot).toBeLessThanOrEqual(d.hotInterval[1])
        expect(d.coldInterval).toEqual([0, 0.003])
        expect(d.cold).toBeGreaterThanOrEqual(0)
        expect(d.cold).toBeLessThanOrEqual(0.003)
      }
  })
})

describe('coldPeakInterval', () => {
  const sensitivity = { reference: sensitivityReferenceDefault, cold: 0.0012, hot: 0.0027 }
  const at = (kelvin: number): InteriorLoad => ({
    ...load,
    propellantTemperature: kelvin,
    propellant: { ...load.propellant, temperatureSensitivity: sensitivity },
  })
  it('spans the peak at no cold change and at 0.0030 per K, below the reference only', () => {
    const cold = at(sensitivityReferenceDefault - 30)
    const range = coldPeakInterval(cold, [0, 0.003])
    if (!range) throw new Error('no interval')
    const reference = interior(load)
    if (!reference.valid) throw new Error('invalid')
    // at a cold coefficient of 0 the peak is that of the reference temperature
    expect(range[1]).toBeCloseTo(reference.peakBreechPressure, -4)
    expect(range[0]).toBeLessThan(range[1])
    const point = interior(cold)
    if (!point.valid) throw new Error('invalid')
    expect(point.peakBreechPressure).toBeGreaterThan(range[0])
    expect(point.peakBreechPressure).toBeLessThan(range[1])
    expect(coldPeakInterval(at(sensitivityReferenceDefault + 10), [0, 0.003])).toBeUndefined()
    expect(coldPeakInterval(load, [0, 0.003])).toBeUndefined()
  })
})
