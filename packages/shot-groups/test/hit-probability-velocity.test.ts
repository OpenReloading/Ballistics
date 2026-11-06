import { describe, expect, it } from 'vitest'
import { pointDispersion } from '../src/index.ts'
import { issueOf } from './issue.ts'

// the velocity term against trajectories of sampled muzzle speeds: packages/core/test/hit-probability-velocity.test.ts

const group = { horizontal: 0.006, vertical: 0.006 }
const base = { group, referenceDistance: 100, distance: 600 }

describe('point dispersion with a muzzle speed spread', () => {
  const velocity = { sd: 8, verticalPerSpeed: 0.0071, referenceVerticalPerSpeed: 0.00017 }

  it('takes the reference speed part out before the scaling and adds the part at the distance', () => {
    const d = pointDispersion({ ...base, velocity })
    const atReference = 0.00017 * 8
    const intrinsic = Math.sqrt(0.006 ** 2 - atReference ** 2)
    expect(d.parts.group.vertical).toBeCloseTo(intrinsic * 6, 12)
    expect(d.parts.group.horizontal).toBeCloseTo(0.036, 12)
    expect(d.parts.velocity).toBeCloseTo(0.0071 * 8, 12)
    expect(d.vertical).toBeCloseTo(Math.hypot(intrinsic * 6, 0.0071 * 8), 12)
    expect(d.horizontal).toBeCloseTo(0.036, 12)
  })

  it('exceeds the linear scaling of the whole group at a distance where the speed part grows faster', () => {
    expect(pointDispersion({ ...base, velocity }).vertical).toBeGreaterThan(
      pointDispersion(base).vertical,
    )
  })

  it('leaves the result as it was for no spread, a zero spread and no input', () => {
    const plain = pointDispersion(base)
    const zero = pointDispersion({ ...base, velocity: { ...velocity, sd: 0 } })
    expect(zero.vertical).toBe(plain.vertical)
    expect(zero.horizontal).toBe(plain.horizontal)
    expect(plain.parts.velocity).toBeUndefined()
    expect(zero.parts.velocity).toBe(0)
  })

  it('gives back the group at the reference distance', () => {
    const atReference = { ...velocity, verticalPerSpeed: velocity.referenceVerticalPerSpeed }
    const d = pointDispersion({ ...base, distance: 100, velocity: atReference })
    expect(d.vertical).toBeCloseTo(0.006, 12)
  })

  it('refuses a speed part at the reference distance that the group cannot hold, and a negative spread', () => {
    expect(
      issueOf(() =>
        pointDispersion({ ...base, velocity: { ...velocity, referenceVerticalPerSpeed: 0.001 } }),
      ),
    ).toEqual({ code: 'speed-height', params: {} })
    expect(issueOf(() => pointDispersion({ ...base, velocity: { ...velocity, sd: -1 } }))).toEqual({
      code: 'speed-spread',
      params: {},
    })
  })
})
