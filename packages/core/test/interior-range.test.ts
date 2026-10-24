import { describe, expect, it } from 'vitest'
import {
  type ApplyTolerance,
  type InteriorLoad,
  interior,
  interiorPressureRange,
  type PressureInput,
  type PressureTolerances,
  pressureToleranceDefaults,
  toleranceRange,
} from '../src/index.ts'
import { m3Load } from './fixtures.ts'

type Toy = { q: number; b: number; v: number }
const scale = (key: keyof Toy) => (l: Toy, s: number, t: number) => ({
  ...l,
  [key]: l[key] * (1 + s * t),
})
const same = (l: Toy) => l
const toyApply: Record<PressureInput, ApplyTolerance<Toy>> = {
  chargeFraction: scale('q'),
  volumeFraction: scale('v'),
  massFraction: same,
  burnRateFraction: scale('b'),
  temperatureKelvin: same,
  startPressureFraction: same,
}
const toyTolerances: PressureTolerances = {
  chargeFraction: 0.01,
  volumeFraction: 0.02,
  massFraction: 0,
  burnRateFraction: 0.05,
  temperatureKelvin: 0,
  startPressureFraction: 0,
}
const toy: Toy = { q: 2, b: 3, v: 5 }
/** Monotone closed form: rises with charge and burn rate, falls with volume. */
const closed = (l: Toy) => (7 * l.q ** 2 * l.b) / l.v

describe('toleranceRange', () => {
  it('finds the box extremes of a monotone closed form', () => {
    const p0 = closed(toy)
    const r = toleranceRange(toy, p0, toyApply, closed, toyTolerances)
    const { chargeFraction: q, volumeFraction: v, burnRateFraction: b } = toyTolerances
    expect(r.highPressure / (p0 * (((1 + q) ** 2 * (1 + b)) / (1 - v))) - 1).toBeLessThan(1e-14)
    expect(Math.abs(r.lowPressure / (p0 * (((1 - q) ** 2 * (1 - b)) / (1 + v))) - 1)).toBeLessThan(
      1e-14,
    )
    expect(r.cases).toHaveLength(2 * 3 + 2)
    expect(r.complete).toBe(true)
    expect(r.cases.at(-2)?.sides).toEqual({
      chargeFraction: 1,
      volumeFraction: -1,
      massFraction: 0,
      burnRateFraction: 1,
      temperatureKelvin: 0,
      startPressureFraction: 0,
    })
    expect(r.cases.at(-1)?.sides).toEqual({
      chargeFraction: -1,
      volumeFraction: 1,
      massFraction: 0,
      burnRateFraction: -1,
      temperatureKelvin: 0,
      startPressureFraction: 0,
    })
    expect(
      r.cases.some((c) => c.input === 'temperatureKelvin' || c.input === 'startPressureFraction'),
    ).toBe(false)
  })

  it('keeps an input nominal in the combined runs when its peak lies at the nominal', () => {
    const hill = (l: Toy) => 1 - (l.q - 1) ** 2
    const one = { ...toy, q: 1 }
    const r = toleranceRange(one, 1, toyApply, hill, {
      ...toyTolerances,
      volumeFraction: 0,
      massFraction: 0,
      burnRateFraction: 0,
    })
    expect(r.cases.at(-1)?.sides?.chargeFraction).toBe(0)
    expect(r.cases.at(-1)?.maxPressure).toBe(1)
    expect(r.cases.at(-2)?.maxPressure).toBe(1)
    expect(r.highPressure).toBe(1)
  })

  it('lists failed cases with their reason and marks the range incomplete', () => {
    const p0 = closed(toy)
    const capped = {
      ...toyApply,
      chargeFraction: (l: Toy, s: number, t: number) =>
        s === 1 ? 'outsideModel' : scale('q')(l, s, t),
    }
    const r = toleranceRange(toy, p0, capped, closed, toyTolerances)
    expect(r.cases[0]).toEqual({
      input: 'chargeFraction',
      side: 1,
      maxPressure: null,
      reason: 'outsideModel',
    })
    expect(r.cases.at(-2)?.sides?.chargeFraction).toBe(1)
    expect(r.cases.at(-2)?.reason).toBe('outsideModel')
    expect(r.complete).toBe(false)
    // inputs after the one that left the model are not applied and report 0
    const later = Object.entries(r.cases.at(-2)?.sides ?? {}).filter(
      ([k]) => k !== 'chargeFraction',
    )
    expect(later.length).toBeGreaterThan(0)
    expect(later.every(([, v]) => v === 0)).toBe(true)
    // the result holds a copy of the tolerances, and the defaults cannot change
    expect(r.tolerances).toEqual(toyTolerances)
    expect(r.tolerances).not.toBe(toyTolerances)
    expect(Object.isFrozen(pressureToleranceDefaults)).toBe(true)

    const both = { ...toyApply, chargeFraction: () => 'outsideModel' }
    const r2 = toleranceRange(toy, p0, both, closed, toyTolerances)
    expect(r2.cases.at(-2)?.sides?.chargeFraction).toBe(0)
    expect(r2.complete).toBe(false)

    const none = toleranceRange(toy, p0, toyApply, () => 'stuck', toyTolerances)
    expect(none).toMatchObject({ lowPressure: p0, highPressure: p0, complete: false })
    expect(none.cases.every((c) => c.reason === 'stuck')).toBe(true)
  })

  it('turns a non-finite peak into a nonFinite case', () => {
    const r = toleranceRange(
      toy,
      1,
      toyApply,
      (l) => (l.q > 2 ? Number.POSITIVE_INFINITY : 1),
      toyTolerances,
    )
    expect(r.cases[0]).toMatchObject({
      input: 'chargeFraction',
      side: 1,
      maxPressure: null,
      reason: 'nonFinite',
    })
  })
})

describe('interiorPressureRange', () => {
  const peak = (l: InteriorLoad) => {
    const r = interior(l)
    return r.valid ? r.peakBreechPressure : Number.NaN
  }

  it('lists zero-contribution inputs at the nominal value', () => {
    const p0 = peak(m3Load)
    const r = interiorPressureRange(m3Load, p0)
    for (const input of ['temperatureKelvin', 'startPressureFraction'])
      for (const c of r.cases.filter((c) => c.input === input)) expect(c.maxPressure).toBe(p0)
    expect(r.cases.at(-2)?.sides).toMatchObject({ temperatureKelvin: 0, startPressureFraction: 0 })
    expect(r.lowPressure).toBeLessThan(p0)
    expect(r.highPressure).toBeGreaterThan(p0)
  })

  it('moves the temperature with temperature coefficients', () => {
    const load = {
      ...m3Load,
      propellant: {
        ...m3Load.propellant,
        temperatureSensitivity: { reference: 294.15, cold: 0.003, hot: 0.004 },
      },
    }
    const r = interiorPressureRange(load, peak(load))
    const [up, down] = r.cases.filter((c) => c.input === 'temperatureKelvin')
    expect(up.maxPressure).toBeGreaterThan(down.maxPressure ?? Number.POSITIVE_INFINITY)
  })

  it('runs the combined case as built by hand', () => {
    // temperature coefficients and a start pressure, so every input moves the peak
    const load: InteriorLoad = {
      ...m3Load,
      propellant: {
        ...m3Load.propellant,
        temperatureSensitivity: { reference: 294.15, cold: 0.003, hot: 0.004 },
      },
      startPressure: 3e7,
    }
    const r = interiorPressureRange(load, peak(load))
    const high = r.cases.find((c) => c.input === 'all' && c.side === 1)
    expect(high?.sides).toEqual({
      chargeFraction: 1,
      volumeFraction: -1,
      massFraction: 0,
      burnRateFraction: 1,
      temperatureKelvin: 1,
      startPressureFraction: 1,
    })
    const t = pressureToleranceDefaults
    const byHand: InteriorLoad = {
      ...load,
      chamber: { ...load.chamber, volume: load.chamber.volume * (1 - t.volumeFraction) },
      propellant: {
        ...load.propellant,
        burn: {
          kind: 'vivacity',
          vivacity: 0.56 * (1 + t.burnRateFraction),
          exponent: 1,
          referencePressure: 98066.5,
          form: { kind: 'constant' },
        },
      },
      charge: load.charge * (1 + t.chargeFraction),
      propellantTemperature: load.propellantTemperature + t.temperatureKelvin,
      startPressure: load.startPressure * (1 + t.startPressureFraction),
    }
    expect(high?.maxPressure).toBe(peak(byHand))
    expect(r.highPressure).toBe(high?.maxPressure)
  })

  it('moves the geometric burn coefficient', () => {
    const load: InteriorLoad = {
      ...m3Load,
      propellant: {
        ...m3Load.propellant,
        burn: {
          kind: 'geometric',
          coefficient: 7e-9,
          exponent: 0.9,
          grain: {
            shape: 'sevenPerf',
            diameter: 1.25e-3,
            perforationDiameter: 1.5e-4,
            length: 2e-3,
          },
        },
      },
    }
    const p0 = peak(load)
    expect(Number.isFinite(p0)).toBe(true)
    const r = interiorPressureRange(load, p0)
    const [up, down] = r.cases.filter((c) => c.input === 'burnRateFraction')
    expect(up.maxPressure).toBeGreaterThan(p0)
    expect(down.maxPressure).toBeLessThan(p0)
  })
})
