import { describe, expect, it } from 'vitest'
import { ellipseProbability, hitProbability, InputError, pointDispersion } from '../src/index.ts'

const sigma = (s: number) => ({ horizontal: s, vertical: s })

describe('ellipse probability', () => {
  it('reduces to the closed form for a circular zone and a circular dispersion', () => {
    for (const [r, s] of [
      [0.01, 0.01],
      [0.05, 0.02],
      [0.003, 0.02],
      [0.2, 0.01],
    ])
      expect(ellipseProbability(r, r, sigma(s))).toBeCloseTo(
        1 - Math.exp(-(r * r) / (2 * s * s)),
        8,
      )
  })

  it('matches the product of the axis probabilities for a very flat ellipse', () => {
    // a thin ellipse of semi-axes (a, b): the probability is below that of its bounding box
    const p = ellipseProbability(0.02, 0.005, { horizontal: 0.01, vertical: 0.01 })
    const box = 2 * 0.4772498680518208 * (2 * 0.19146246127401312)
    expect(p).toBeLessThan(box)
    expect(p).toBeGreaterThan(0.5 * box)
  })
})

describe('hit probability', () => {
  const zones = [
    { halfWidth: 0.1, halfHeight: 0.1, value: 1 },
    { halfWidth: 0.05, halfHeight: 0.05, value: 2 },
    { halfWidth: 0.01, halfHeight: 0.01, value: 3 },
  ]

  it('takes the zones as nested rings and sums the expected score', () => {
    const r = hitProbability(zones, sigma(0.03))
    expect(r.hit).toBeCloseTo(1 - Math.exp(-(0.1 ** 2) / (2 * 0.03 ** 2)), 8)
    expect(r.zones.map((z) => z.value)).toEqual([1, 2, 3])
    expect(r.zones.reduce((s, z) => s + z.probability, 0)).toBeCloseTo(r.hit, 10)
    expect(r.expectedScore).toBeCloseTo(
      r.zones.reduce((s, z) => s + z.value * z.probability, 0),
      12,
    )
  })

  it('falls monotonically with the wind uncertainty', () => {
    const at = (speedSd: number) =>
      hitProbability(
        zones,
        pointDispersion({
          group: sigma(0.0003),
          referenceDistance: 100,
          distance: 300,
          wind: { speed: 4, from: Math.PI / 2, speedSd, directionSd: 0, perCrosswind: 0.05 },
        }),
      )
    let last = 2
    for (const s of [0, 0.5, 1, 2, 4]) {
      const p = at(s).hit
      expect(p).toBeLessThan(last)
      last = p
    }
    expect(at(4).expectedScore).toBeLessThan(at(0).expectedScore)
  })
})

describe('point dispersion', () => {
  it('scales the group linearly with distance and adds no wind or range term without them', () => {
    const d = pointDispersion({ group: sigma(0.01), referenceDistance: 100, distance: 300 })
    expect(d.horizontal).toBeCloseTo(0.03, 12)
    expect(d.vertical).toBeCloseTo(0.03, 12)
    expect(d.parts).toEqual({ group: { horizontal: 0.03, vertical: 0.03 }, wind: 0, range: 0 })
  })

  it('carries the crosswind and range uncertainty on their own axes', () => {
    const d = pointDispersion({
      group: sigma(0.01),
      referenceDistance: 100,
      distance: 100,
      // a full-value crosswind: only the speed uncertainty counts
      wind: { speed: 5, from: Math.PI / 2, speedSd: 1, directionSd: 0.1, perCrosswind: 0.04 },
      range: { sd: 10, verticalPerMetre: 0.002 },
    })
    expect(d.parts.wind).toBeCloseTo(0.04, 12)
    expect(d.horizontal).toBeCloseTo(Math.hypot(0.01, 0.04), 12)
    expect(d.vertical).toBeCloseTo(Math.hypot(0.01, 0.02), 12)
    // a head wind: only the direction uncertainty counts
    const head = pointDispersion({
      group: sigma(0.01),
      referenceDistance: 100,
      distance: 100,
      wind: { speed: 5, from: 0, speedSd: 1, directionSd: 0.1, perCrosswind: 0.04 },
    })
    expect(head.parts.wind).toBeCloseTo(0.04 * 0.5, 12)
  })

  it('rejects a dispersion of zero', () => {
    expect(() =>
      pointDispersion({ group: sigma(0), referenceDistance: 100, distance: 100 }),
    ).toThrow(InputError)
  })
})
