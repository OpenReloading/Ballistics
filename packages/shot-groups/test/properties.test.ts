import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ringTotal } from '../src/competition-scoring.ts'
import { turnPoint } from '../src/geometry.ts'
import { type ScoringFace, scoreShot } from '../src/ring-scoring.ts'

/** A circular face of ten rings, 10 ring 10 mm wide, each ring 10 mm wider than the next inward. */
const tenRings: ScoringFace = {
  rings: Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    diameter: { value: 100 - 10 * i },
  })),
  events: [{ id: 'test-event' }],
}

const finite = (min: number, max: number) => fc.double({ min, max, noNaN: true })

describe('properties', () => {
  it('turns a point back where it was', () => {
    fc.assert(
      fc.property(finite(-1e3, 1e3), finite(-1e3, 1e3), finite(-10, 10), (x, y, angle) => {
        const c = { x: 3, y: -2 }
        const back = turnPoint(turnPoint({ x, y }, c, angle), c, -angle)
        expect(Math.hypot(back.x - x, back.y - y)).toBeLessThan(1e-9)
      }),
    )
  })

  it('never scores a hole farther from the center higher', () => {
    fc.assert(
      fc.property(finite(0, 0.06), finite(0, 0.06), finite(0, 2 * Math.PI), (a, b, angle) => {
        const [near, far] = a <= b ? [a, b] : [b, a]
        const at = (d: number) => ({ x: d * Math.cos(angle), y: d * Math.sin(angle) })
        const hole = 4.5e-3
        expect(scoreShot(tenRings, at(near), hole).value).toBeGreaterThanOrEqual(
          scoreShot(tenRings, at(far), hole).value,
        )
      }),
    )
  })

  it('totals a series of tenths whatever the order of its shots', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 109 }), { minLength: 1 }), (tenths) => {
        const shots = tenths.map((t) => t / 10)
        expect(ringTotal({ shots: shots.toReversed() })).toBe(ringTotal({ shots }))
      }),
    )
  })
})
