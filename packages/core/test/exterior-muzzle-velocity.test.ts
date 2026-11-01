import { describe, expect, it } from 'vitest'
import {
  airDensity,
  type DragInput,
  InputError,
  lbPerSqInToKgPerSqM,
  muzzleVelocityFromDownrange,
  type Projectile,
  standardAtmosphere,
  trajectory,
} from '../src/index.ts'
import { uniforms } from './random.ts'

const air = standardAtmosphere(0)
const grain = 0.00006479891
const inch = 0.0254

/** Speed the point-mass run reaches at `distance` from a known muzzle velocity, m/s. */
function flown(projectile: Projectile, muzzleVelocity: number, distance: number): number {
  const t = trajectory(
    {
      projectile,
      muzzleVelocity,
      firearm: { sightHeight: 0 },
      air,
      zero: { elevationAngle: 0, windageAngle: 0 },
    },
    [distance],
    { coriolis: false },
  )
  return t.points[0]?.velocity ?? Number.NaN
}

const g7 = (bc: number): DragInput => ({
  kind: 'bc',
  model: 'G7',
  bands: [{ ballisticCoefficient: bc * lbPerSqInToKgPerSqM, minVelocity: 0 }],
})
const constantCd = (cd: number): DragInput => ({
  kind: 'curve',
  curve: [
    [0, cd],
    [10, cd],
  ],
})

describe('muzzle velocity from a speed measured downrange', () => {
  it('matches the exponential loss of a constant drag coefficient', () => {
    const projectile: Projectile = { mass: 68 * grain, diameter: 6.17e-3, drag: constantCd(0.3) }
    const distance = 2.44
    const k = (airDensity(air) * 0.3 * Math.PI * projectile.diameter ** 2) / (8 * projectile.mass)
    const v0 = 975
    const measured = v0 * Math.exp(-k * distance)
    expect(v0 - measured).toBeGreaterThan(2.9)
    expect(v0 - measured).toBeLessThan(3.0)
    const got = muzzleVelocityFromDownrange({ projectile, air, distance, velocity: measured })
    expect(Math.abs(got - v0)).toBeLessThan(0.01)
  })

  it('returns the speed flown at 2.4 m for a 68 gr bullet and at 4.0 m for a 175 gr bullet within 0.3 m/s', () => {
    const light: Projectile = { mass: 68 * grain, diameter: 0.243 * inch, drag: g7(0.15) }
    const heavy: Projectile = { mass: 175 * grain, diameter: 0.308 * inch, drag: g7(0.27) }
    for (const [projectile, distance, v0] of [
      [light, 2.44, 975],
      [heavy, 4.0, 800],
    ] as const) {
      const measured = flown(projectile, v0, distance)
      expect(v0 - measured).toBeGreaterThan(1)
      const got = muzzleVelocityFromDownrange({ projectile, air, distance, velocity: measured })
      expect(Math.abs(got - v0)).toBeLessThan(0.3)
    }
  })

  it('has no mean bias over seeded shots across calibres, bullets and speeds through the transonic range', () => {
    const next = uniforms(371)
    const calibres = [5.7, 6.17, 7.23, 7.85, 9.12, 10.57, 11.63]
    const bullets: [number, 'G1' | 'G7', number][] = [
      [0.16, 'G1', 0.55],
      [0.22, 'G7', 1],
      [0.28, 'G7', 1],
    ]
    let sum = 0
    let worst = 0
    const shots = 150
    for (let i = 0; i < shots; i++) {
      const d = (calibres[i % calibres.length] ?? 0) * 1e-3
      const [sd, model, form] = bullets[i % bullets.length] ?? [0, 'G7', 1]
      const projectile: Projectile = {
        mass: sd * lbPerSqInToKgPerSqM * d * d,
        diameter: d,
        drag: {
          kind: 'bc',
          model,
          bands: [{ ballisticCoefficient: (sd / form) * lbPerSqInToKgPerSqM, minVelocity: 0 }],
        },
      }
      const v0 = 250 + 800 * next()
      const distance = 1 + 9 * next()
      const velocity = flown(projectile, v0, distance)
      const error = muzzleVelocityFromDownrange({ projectile, air, distance, velocity }) - v0
      sum += error
      worst = Math.max(worst, Math.abs(error))
    }
    expect(Math.abs(sum / shots)).toBeLessThan(0.1)
    expect(worst).toBeLessThan(0.01)
  })

  it('returns the reading at distance zero and rejects inputs outside the model', () => {
    const projectile: Projectile = { mass: 0.0113, diameter: 0.00782, drag: g7(0.27) }
    expect(muzzleVelocityFromDownrange({ projectile, air, distance: 0, velocity: 850 })).toBe(850)
    for (const [distance, velocity] of [
      [-1, 850],
      [Number.NaN, 850],
      [3, 0],
      [3, Number.POSITIVE_INFINITY],
    ] as const)
      expect(() => muzzleVelocityFromDownrange({ projectile, air, distance, velocity })).toThrow(
        InputError,
      )
  })

  it('rejects a reading the bullet cannot reach over the distance', () => {
    const projectile: Projectile = { mass: 0.0113, diameter: 0.00782, drag: g7(0.27) }
    expect(() =>
      muzzleVelocityFromDownrange({ projectile, air, distance: 1e6, velocity: 5 }),
    ).toThrow(InputError)
  })
})
