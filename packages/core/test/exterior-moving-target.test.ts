import { describe, expect, it } from 'vitest'
import { InputError, movingTargetLead } from '../src/index.ts'

describe('movingTargetLead', () => {
  it('crossing at 90 degrees: the lateral lead is speed times time of flight, the angle that over the range', () => {
    const r = movingTargetLead({ speed: 2, heading: Math.PI / 2 }, 400, 0.6)
    expect(r.lateral).toBeCloseTo(1.2, 12)
    expect(r.angle).toBeCloseTo(Math.atan(1.2 / 400), 12)
    // small angle: the lead over the range, in mrad
    expect(r.angle * 1e3).toBeCloseTo(3, 2)
  })

  it('a target moving along the line of sight needs no lateral lead', () => {
    for (const heading of [0, Math.PI]) {
      const r = movingTargetLead({ speed: 5, heading }, 300, 0.5)
      expect(Math.abs(r.lateral)).toBeLessThan(1e-12)
      expect(Math.abs(r.angle)).toBeLessThan(1e-12)
    }
  })

  it('leads to the left for a target crossing to the left, and by the sine of other headings', () => {
    expect(movingTargetLead({ speed: 2, heading: -Math.PI / 2 }, 400, 0.6).lateral).toBeCloseTo(
      -1.2,
      12,
    )
    expect(movingTargetLead({ speed: 2, heading: Math.PI / 6 }, 400, 0.6).lateral).toBeCloseTo(
      0.6,
      12,
    )
  })

  it('refuses a negative speed, a range of 0 and a negative time of flight', () => {
    const crossing = { speed: 2, heading: Math.PI / 2 }
    expect(() => movingTargetLead({ ...crossing, speed: -1 }, 400, 0.6)).toThrow(InputError)
    expect(() => movingTargetLead(crossing, 0, 0.6)).toThrow(InputError)
    expect(() => movingTargetLead(crossing, 400, -0.1)).toThrow(InputError)
  })
})
