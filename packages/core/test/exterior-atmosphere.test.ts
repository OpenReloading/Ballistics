import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  airAt,
  airDensity,
  checkAir,
  InputError,
  saturationVapourPressure,
  speedOfSound,
  standardAtmosphere,
} from '../src/index.ts'

const rel = (a: number, b: number) => Math.abs(a / b - 1)

describe('standard atmosphere', () => {
  it('returns the ICAO sea-level values', () => {
    const air = standardAtmosphere(0)
    expect(air).toEqual({ altitude: 0, pressure: 101325, temperature: 288.15, humidity: 0 })
    expect(rel(airDensity(air), 1.225)).toBeLessThan(1e-5)
    expect(rel(speedOfSound(air), 340.294)).toBeLessThan(1e-5)
  })

  it('reaches 216.65 K and 22632.06 Pa at the tropopause', () => {
    const air = standardAtmosphere(11000)
    expect(air.temperature).toBeCloseTo(216.65, 10)
    expect(rel(air.pressure, 22632.06)).toBeLessThan(1e-6)
  })

  it('derives the same air along the path as at the higher altitude', () => {
    for (const altitude of [-2000, 0, 1500, 4000])
      for (const height of [-500, 10, 900, 3000]) {
        const a = airAt(standardAtmosphere(altitude), height)
        const b = standardAtmosphere(altitude + height)
        expect(a.altitude).toBeCloseTo(b.altitude, 9)
        expect(rel(a.temperature, b.temperature)).toBeLessThan(1e-12)
        expect(rel(a.pressure, b.pressure)).toBeLessThan(1e-12)
      }
  })
})

describe('humid air', () => {
  it('lowers density and raises the speed of sound monotonically with humidity', () => {
    let density = Number.POSITIVE_INFINITY
    let sound = 0
    for (const humidity of [0, 0.25, 0.5, 0.75, 1]) {
      const air = { altitude: 0, pressure: 95000, temperature: 303.15, humidity }
      expect(airDensity(air)).toBeLessThan(density)
      expect(speedOfSound(air)).toBeGreaterThan(sound)
      density = airDensity(air)
      sound = speedOfSound(air)
    }
  })

  it('takes the Magnus value at 0 degC', () => {
    expect(saturationVapourPressure(273.15)).toBe(611.2)
  })

  it('gives the ideal-mixture density and speed of sound of humid air', () => {
    const air = { altitude: 0, pressure: 95000, temperature: 303.15, humidity: 0.8 }
    const e = 0.8 * 611.2 * Math.exp((17.62 * 30) / 273.12)
    // dry air with Rd, water vapour with R* / Mv, R* = 8.31432 J/(mol K), Mv = 0.01801528 kg/mol
    const rv = 8.31432 / 0.01801528
    const density = (95000 - e) / (287.05287 * 303.15) + e / (rv * 303.15)
    expect(rel(airDensity(air), density)).toBeLessThan(1e-12)
    // mole fraction x, molar mass ratio Mv / Md, cp / R* = 3.5 (dry) and 4 (vapour)
    const x = e / 95000
    const gas = 287.05287 / (1 - x + (x * 0.01801528 * 287.05287) / 8.31432)
    const cp = 3.5 * (1 - x) + 4 * x
    expect(rel(speedOfSound(air), Math.sqrt((cp / (cp - 1)) * gas * 303.15))).toBeLessThan(1e-12)
  })
})

describe('limits', () => {
  it('rejects air outside the model', () => {
    const ok = standardAtmosphere(0, 0.5)
    expect(() => standardAtmosphere(11001)).toThrow(RangeError)
    expect(() => standardAtmosphere(-5001)).toThrow(RangeError)
    expect(() => checkAir({ ...ok, humidity: 1.2 })).toThrow(RangeError)
    expect(() => checkAir({ ...ok, temperature: 0 })).toThrow(RangeError)
    expect(() => checkAir({ ...ok, pressure: 100 })).toThrow(RangeError)
    expect(() => checkAir({ ...ok, altitude: Number.NaN })).toThrow(RangeError)
    expect(checkAir(ok)).toBe(ok)
  })
})

describe('checkAir on any numbers', () => {
  it('returns the air or throws an InputError', () => {
    const value = fc.oneof(fc.double(), fc.double({ min: -1000, max: 120000, noNaN: true }))
    fc.assert(
      fc.property(
        fc.record({ altitude: value, pressure: value, temperature: value, humidity: value }),
        (air) => {
          try {
            expect(checkAir(air)).toBe(air)
          } catch (e) {
            expect(e).toBeInstanceOf(InputError)
          }
        },
      ),
      { seed: 20261022, numRuns: 500 },
    )
  })
})
