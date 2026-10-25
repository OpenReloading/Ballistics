import type { TrajectoryPoint } from '@open-reloading/core'
import type { TargetFace } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { faceZones, impactSensitivity } from '../src/lib/hit-probability.ts'
import { defined } from './defined.ts'

const mm = (value: number) => ({ value })
const face = {
  rings: [
    { value: 1, diameter: mm(100) },
    { value: 2, diameter: mm(60) },
    { value: 3, diameter: mm(20), height: mm(30) },
  ],
} as unknown as TargetFace

describe('faceZones', () => {
  it('grows each ring by the radius of the hole and keeps an oval ring tall', () => {
    const zones = faceZones(face, 0.008)
    const expected = [
      [0.054, 0.054, 1],
      [0.034, 0.034, 2],
      [0.014, 0.019, 3],
    ]
    zones.forEach((z, i) => {
      expect(z.halfWidth).toBeCloseTo(defined(defined(expected[i])[0]), 12)
      expect(z.halfHeight).toBeCloseTo(defined(defined(expected[i])[1]), 12)
      expect(z.value).toBe(defined(expected[i])[2])
    })
    expect(defined(faceZones(face, 0)[0]).halfWidth).toBe(0.05)
  })
})

describe('impactSensitivity', () => {
  const points = [
    { range: 100, height: 0 },
    { range: 200, height: -0.1 },
    { range: 300, height: -0.4 },
  ] as TrajectoryPoint[]

  it('takes the displacement from the windage hold and the slope from the neighbours', () => {
    const s = impactSensitivity(points, [0.00001, 0.00002, 0.00003], 1)
    expect(s?.perCrosswind).toBeCloseTo(0.004, 12)
    expect(s?.verticalPerMetre).toBeCloseTo(-0.002, 12)
    // one-sided at the ends
    expect(impactSensitivity(points, [0.00001, 0, 0], 0)?.verticalPerMetre).toBeCloseTo(-0.001, 12)
  })

  it('has none for a single point', () => {
    expect(impactSensitivity(points.slice(0, 1), [0], 0)).toBeUndefined()
  })
})
