import { describe, expect, it } from 'vitest'
import {
  InputError,
  lbPerSqInToKgPerSqM,
  pointDispersion,
  standardAtmosphere,
  type TrajectoryInput,
  trajectory,
  zeroAngles,
} from '../src/index.ts'
import { normals } from './normals.ts'

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
    expect(() =>
      pointDispersion({ ...base, velocity: { ...velocity, referenceVerticalPerSpeed: 0.001 } }),
    ).toThrow(InputError)
    expect(() => pointDispersion({ ...base, velocity: { ...velocity, sd: -1 } })).toThrow(
      InputError,
    )
  })
})

describe('velocity term against sampled muzzle speeds', () => {
  const distances = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
  const options = { coriolis: false }
  const sd = (xs: number[]) => {
    const m = xs.reduce((s, x) => s + x, 0) / xs.length
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
  }

  // synthetic loads: muzzle speed m/s, G7 coefficient lb/in^2, speed standard deviation m/s
  for (const [v0, bc, speedSd, seed] of [
    [850, 0.3, 8, 1],
    [700, 0.2, 10, 2],
  ] as const) {
    it(`agrees within 5 percent at 100 to 1000 m where the linear scaling does not (${v0} m/s)`, () => {
      const shot = (v: number, zero: TrajectoryInput['zero']): TrajectoryInput => ({
        projectile: {
          mass: 0.0113,
          diameter: 0.00782,
          length: 0.0315,
          drag: {
            kind: 'bc',
            model: 'G7',
            bands: [{ ballisticCoefficient: bc * lbPerSqInToKgPerSqM, minVelocity: 0 }],
          },
        },
        muzzleVelocity: v,
        firearm: { sightHeight: 0.05 },
        air: standardAtmosphere(0),
        zero,
      })
      const bore = zeroAngles(shot(v0, { range: 100 }), options)
      const heights = (v: number) =>
        trajectory(shot(v, bore), distances, options).points.map((p) => p.height)
      const nominal = heights(v0)
      const slope = heights(v0 + 1).map((h, i) => h - (nominal[i] ?? 0))
      const draw = normals(seed)
      const intrinsic = 0.006
      const columns = distances.map(() => [] as number[])
      for (let n = 0; n < 4000; n++) {
        const a = intrinsic * draw()
        heights(v0 + speedSd * draw()).forEach((h, i) => {
          columns[i]?.push(h + (a * (distances[i] ?? 1)) / 100)
        })
      }
      const simulated = columns.map(sd)
      const reference = simulated[0] ?? 0
      let linearMisses = 0
      distances.forEach((distance, i) => {
        const d = pointDispersion({
          group: { horizontal: reference, vertical: reference },
          referenceDistance: 100,
          distance,
          velocity: {
            sd: speedSd,
            verticalPerSpeed: slope[i] ?? 0,
            referenceVerticalPerSpeed: slope[0] ?? 0,
          },
        })
        const linear = pointDispersion({
          group: { horizontal: reference, vertical: reference },
          referenceDistance: 100,
          distance,
        })
        expect(Math.abs(d.vertical / (simulated[i] ?? 1) - 1)).toBeLessThan(0.05)
        if (Math.abs(linear.vertical / (simulated[i] ?? 1) - 1) > 0.05) linearMisses++
      })
      expect(linearMisses).toBeGreaterThan(0)
    })
  }
})
