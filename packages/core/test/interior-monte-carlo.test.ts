import { describe, expect, it } from 'vitest'
import {
  type ApplyTolerance,
  interiorPressureRange,
  interiorSampledBand,
  type PressureInput,
  type PressureTolerances,
  pressureToleranceDefaults,
  type SamplingOptions,
  sampledBand,
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
const none: PressureTolerances = {
  chargeFraction: 0,
  volumeFraction: 0,
  massFraction: 0,
  burnRateFraction: 0,
  temperatureKelvin: 0,
  startPressureFraction: 0,
}
const toy: Toy = { q: 2, b: 3, v: 5 }
/** Monotone closed form: rises with the burn rate, falls with the volume. */
const closed = (l: Toy) => ({ pressure: (7 * l.q ** 2 * l.b) / l.v, velocity: l.q * l.b })
const clock = () => {
  let t = 0
  return () => t++
}
const sampling = (over: Partial<SamplingOptions> = {}): SamplingOptions => ({
  samples: 1000,
  seed: 7,
  budgetMs: 1e9,
  now: clock(),
  ...over,
})

describe('sampledBand', () => {
  it('gives the same band for the same seed and another for another seed', () => {
    const t = { ...none, burnRateFraction: 0.05 }
    const a = sampledBand(toy, toyApply, closed, t, sampling())
    expect(sampledBand(toy, toyApply, closed, t, sampling())).toEqual(a)
    expect(sampledBand(toy, toyApply, closed, t, sampling({ seed: 8 }))).not.toEqual(a)
  })

  it('matches the corner cases of one varied input within the sampling error', () => {
    const t = { ...none, burnRateFraction: 0.05 }
    const samples = 4000
    const band = sampledBand(toy, toyApply, closed, t, sampling({ samples }))
    const p0 = closed(toy).pressure
    // a tolerance is the 90 % interval, so the percentiles of a linear response sit at the ends of
    // the tolerance; the 5th and 95th percentile of `samples` draws have a standard error of
    // sqrt(0.05 * 0.95 / samples) / density(1.645 sigma) in sigmas
    const sigma = 1 / 1.6448536269514722
    const density = Math.exp(-(1.6448536269514722 ** 2) / 2) / Math.sqrt(2 * Math.PI)
    const error = (Math.sqrt((0.05 * 0.95) / samples) / density) * sigma * t.burnRateFraction
    expect(band.status).toBe('sampled')
    expect(Math.abs((band.pressure?.p05 ?? 0) / p0 - (1 - t.burnRateFraction))).toBeLessThan(
      4 * error,
    )
    expect(Math.abs((band.pressure?.p95 ?? 0) / p0 - (1 + t.burnRateFraction))).toBeLessThan(
      4 * error,
    )
    expect(Math.abs((band.pressure?.p50 ?? 0) / p0 - 1)).toBeLessThan(4 * error)
    expect(band.velocity?.p05).toBeLessThan(closed(toy).velocity)
    expect(band.failed).toBe(0)
  })

  it('lies inside the corner band of the M3 model when inputs combine', () => {
    const nominal = interiorSampledBand(m3Load, none, sampling({ samples: 1 })).pressure?.p50 ?? 0
    const corners = interiorPressureRange(m3Load, nominal, pressureToleranceDefaults)
    const band = interiorSampledBand(m3Load, pressureToleranceDefaults, sampling({ samples: 60 }))
    expect(band.status).toBe('sampled')
    expect(band.pressure?.p05).toBeGreaterThan(corners.lowPressure)
    expect(band.pressure?.p95).toBeLessThan(corners.highPressure)
    expect(band.pressure?.p05).toBeLessThan(band.pressure?.p95 ?? 0)
  })

  it('returns no band when the clock passes the budget', () => {
    const band = sampledBand(
      toy,
      toyApply,
      closed,
      { ...none, burnRateFraction: 0.05 },
      sampling({ budgetMs: 3 }),
    )
    expect(band).toEqual({ status: 'overBudget', samples: 1000, seed: 7, failed: 0, budgetMs: 3 })
  })

  it('counts draws that leave the model and reports an invalid run', () => {
    const t = { ...none, burnRateFraction: 0.05 }
    const odd = (l: Toy) => (l.b > 3 ? 'outside' : closed(l))
    const band = sampledBand(toy, toyApply, odd, t, sampling({ samples: 200 }))
    expect(band.status).toBe('sampled')
    expect(band.failed).toBeGreaterThan(60)
    expect(band.failed).toBeLessThan(140)
    expect(sampledBand(toy, toyApply, () => 'outside', t, sampling({ samples: 5 }))).toEqual({
      status: 'invalid',
      samples: 5,
      seed: 7,
      failed: 5,
      budgetMs: 1e9,
    })
  })
})
