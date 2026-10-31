import { describe, expect, it } from 'vitest'
import { InputError, ladderImpactResiduals } from '../src/index.ts'
import { normals } from './random.ts'

const IN = 0.0254
const SLOPE = (0.04 * IN) / (30 * 0.3048)

/** Nine charges of `shots` shots; the height follows the velocity and an oscillation of `amplitude` m. */
function ladder(amplitude: number, seed: number, shots = 15) {
  const normal = normals(seed)
  const phase = 1.3
  return Array.from({ length: 9 }, (_, i) => {
    const velocities = Array.from(
      { length: shots },
      () => (2800 + 12.5 * i) * 0.3048 + 2.4 * normal(),
    )
    const heights = velocities.map(
      (v) =>
        SLOPE * (v - 2850 * 0.3048) +
        amplitude * Math.sin((2 * Math.PI * i) / 8 + phase) +
        0.06 * IN * normal(),
    )
    return { charge: 0.002 + i * 0.0001, heights, velocities }
  })
}

describe('ladderImpactResiduals', () => {
  it('shows a note for an oscillation of 0.1 in and for a flat residual about 1 % of the time', () => {
    let shown = 0
    let falseShown = 0
    for (let s = 0; s < 400; s++) {
      if (ladderImpactResiduals(ladder(0.1 * IN, 1_000 + s), SLOPE).varies) shown++
      if (ladderImpactResiduals(ladder(0, 5_000 + s), SLOPE).varies) falseShown++
    }
    expect(shown / 400).toBeGreaterThan(0.99)
    expect(falseShown / 400).toBeLessThan(0.05)
  })

  it('removes the velocity effect: with the true slope the residual of a pure drop ladder is flat', () => {
    const r = ladderImpactResiduals(ladder(0, 3), SLOPE)
    expect(r.degrees).toBe(8)
    expect(r.steps.map((s) => s.count)).toEqual(Array(9).fill(15))
    expect(Math.max(...r.steps.map((s) => Math.abs(s.mean)))).toBeLessThan(0.06 * IN)
  })

  it('orders the charges and gives the steps the shape ladderFlatSpots reads', () => {
    const r = ladderImpactResiduals([...ladder(0, 4)].reverse(), SLOPE)
    expect(r.steps.map((s) => s.charge)).toEqual(
      [...r.steps.map((s) => s.charge)].sort((a, b) => a - b),
    )
  })

  it('handles heights without scatter', () => {
    const flat = ladder(0, 5, 3).map((c) => ({ ...c, heights: c.velocities.map(() => 0) }))
    expect(ladderImpactResiduals(flat, 0).statistic).toBe(0)
    const stepped = flat.map((c, i) => ({ ...c, heights: c.heights.map(() => i) }))
    expect(ladderImpactResiduals(stepped, 0).statistic).toBe(Number.POSITIVE_INFINITY)
  })

  it('rejects too few charges, shots, a bad slope, level, charge or a non-finite value', () => {
    const l = ladder(0, 6, 3)
    expect(() => ladderImpactResiduals(l.slice(0, 2), SLOPE)).toThrow(InputError)
    expect(() => ladderImpactResiduals(l, Number.NaN)).toThrow(InputError)
    expect(() => ladderImpactResiduals(l, SLOPE, 1)).toThrow(InputError)
    expect(() =>
      ladderImpactResiduals(
        l.map((c) => ({ ...c, charge: 0 })),
        SLOPE,
      ),
    ).toThrow(InputError)
    expect(() =>
      ladderImpactResiduals(
        l.map((c) => ({ ...c, heights: c.heights.slice(1), velocities: c.velocities.slice(1, 2) })),
        SLOPE,
      ),
    ).toThrow(InputError)
    expect(() =>
      ladderImpactResiduals(
        l.map((c) => ({
          ...c,
          heights: c.heights.slice(0, 1),
          velocities: c.velocities.slice(0, 1),
        })),
        SLOPE,
      ),
    ).toThrow(InputError)
    expect(() =>
      ladderImpactResiduals(
        l.map((c) => ({ ...c, heights: [Number.NaN, 0, 0] })),
        SLOPE,
      ),
    ).toThrow(InputError)
  })
})
