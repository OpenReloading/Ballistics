import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  lbPerSqInToKgPerSqM,
  standardAtmosphere,
  type TrajectoryInput,
  trajectory,
} from '../src/index.ts'

// A 168 gr, 0.308 in bullet of 3.98 calibres at 2600 ft/s in sea-level standard air, G7 ballistic
// coefficient 0.218 lb/in2. The coefficients are chosen for this comparison, not measured: inertias
// of 0.10 (axial) and 1.0 (transverse) times m d^2, a lift slope of 2.1, and an overturning-moment
// slope of 1.81 at Mach 2.4 (a gyroscopic stability factor of 1.7 at the muzzle for the 12 in
// twist) that rises linearly to 4.0 at Mach 0.8.
const yd = 0.9144
const inch = 0.0254
const mph = 0.44704
const mass = 168 * 6.479891e-5
const diameter = 0.308 * inch
const m = mass * diameter ** 2

const shot = (twist: number, wind = 0): TrajectoryInput => ({
  projectile: {
    mass,
    diameter,
    length: 3.98 * diameter,
    drag: {
      kind: 'bc',
      model: 'G7',
      bands: [{ ballisticCoefficient: 0.218 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
    },
    aerodynamics: {
      liftSlope: 2.1,
      momentSlope: [
        [0.8, 4.0],
        [2.4, 1.81],
      ],
      axialInertia: 0.1 * m,
      transverseInertia: 1.0 * m,
    },
  },
  muzzleVelocity: 2600 * 0.3048,
  firearm: { sightHeight: 0.05, twist: twist * inch, twistHand: 'right' },
  air: standardAtmosphere(0),
  zero: { elevationAngle: 0.004, windageAngle: 0 },
  ...(wind
    ? { wind: [{ endDistance: 1e9, speed: wind * mph, fromDirection: 1.5 * Math.PI }] }
    : {}),
})

const ranges = [100 * yd, 600 * yd, 1000 * yd]
const drift = (twist: number, model: 'point-mass' | 'modified-point-mass') =>
  trajectory(shot(twist), ranges, { model }).points.map((p) => p.spinDrift / inch)
const jump = (twist: number, model: 'point-mass' | 'modified-point-mass') =>
  Math.abs(nth(trajectory(shot(twist, 10), ranges, { model }).points, 0).jump / inch)

// Fit over modified point mass, spin drift at 600 and 1000 yd. The 1000 yd ratios are the ones the
// fit comparison reports (11.56, 14.50 and 9.78 in over 9.32, 11.19 and 7.99 in).
const cases = [
  { twist: 10, fit: 14.5, ratio600: 1.38, ratio1000: 1.3 },
  { twist: 12, fit: 11.56, ratio600: 1.32, ratio1000: 1.24 },
  { twist: 14, fit: 9.78, ratio600: 1.3, ratio1000: 1.22 },
]
const near = (value: number, expected: number) => Math.abs(value / expected - 1) < 0.03

describe('empirical fits against the modified point mass', () => {
  for (const c of cases) {
    it(`spin drift at ${c.twist} in twist runs ${c.ratio1000} times the modified point mass at 1000 yd`, () => {
      const fit = drift(c.twist, 'point-mass')
      const full = drift(c.twist, 'modified-point-mass')
      expect(near(nth(fit, 2), c.fit)).toBe(true)
      expect(near(nth(fit, 2) / nth(full, 2), c.ratio1000)).toBe(true)
      expect(near(nth(fit, 1) / nth(full, 1), c.ratio600)).toBe(true)
    })
  }

  it('jump per 10 mph at 100 yd runs 1.13 times the linear formula', () => {
    const fit = jump(12, 'point-mass')
    expect(near(fit, 0.413)).toBe(true)
    expect(near(fit / jump(12, 'modified-point-mass'), 1.13)).toBe(true)
  })
})
