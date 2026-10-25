import { describe, expect, it } from 'vitest'
import {
  airDensity,
  type CoefficientOverMach,
  coefficientAt,
  cylinderInertia,
  type DragTable,
  gyroscopicStability,
  lbPerSqInToKgPerSqM,
  linearJump,
  millerStability,
  momentSlopeFromStability,
  speedOfSound,
  standardAtmosphere,
  type TrajectoryInput,
  type TrajectoryPoint,
  trajectory,
  yawOfRepose,
} from '../src/index.ts'

const g = 9.80665
const mpm = { model: 'modified-point-mass' as const }
const flat = (cd: number) => ({
  kind: 'curve' as const,
  curve: [
    [0, cd],
    [10, cd],
  ] as const,
})
const g7 = {
  kind: 'bc' as const,
  model: 'G7' as const,
  bands: [{ ballisticCoefficient: 0.3 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
}
const ix = 8.7e-8
const iy = 1.0e-6
const base: TrajectoryInput = {
  projectile: {
    mass: 0.01134,
    diameter: 0.00782,
    length: 0.0312,
    drag: g7,
    aerodynamics: { liftSlope: 2.6, momentSlope: 2.8, axialInertia: ix, transverseInertia: iy },
  },
  muzzleVelocity: 790,
  firearm: { sightHeight: 0.05, twist: 0.254, twistHand: 'right' },
  air: standardAtmosphere(0),
  zero: { elevationAngle: 0.004, windageAngle: 0 },
}
const withAero = (shot: TrajectoryInput, a: object): TrajectoryInput => ({
  ...shot,
  projectile: {
    ...shot.projectile,
    aerodynamics: { liftSlope: 2.6, ...shot.projectile.aerodynamics, ...a },
  },
})
const p0 = (2 * Math.PI * 790) / 0.254

/** Simpson's rule over 2000 intervals of the drift integral of the lift `az` up to time `t`. */
function simpsonDrift(az: (t: number) => number, t: number) {
  const n = 2000
  let sum = 0
  for (let k = 0; k <= n; k++) {
    const tau = (t * k) / n
    const w = k === 0 || k === n ? 1 : k % 2 === 1 ? 4 : 2
    sum += w * (t - tau) * az(tau)
  }
  return (sum * t) / (3 * n)
}

describe('modified point-mass helpers', () => {
  const i = { axialInertia: ix, momentSlope: 2.8, density: 1.2, diameter: 0.00782 }

  it('computes the yaw of repose from the formula, perpendicular to the airspeed', () => {
    const va = [700, 30, -5] as const
    const a = [-400, -12, 3] as const
    const yaw = yawOfRepose(va, a, p0, i)
    const v2 = 700 ** 2 + 30 ** 2 + 5 ** 2
    const area = (Math.PI / 4) * 0.00782 ** 2
    const f = (-2 * ix * p0) / (1.2 * area * 0.00782 * 2.8 * v2 * v2)
    const cross = [30 * 3 - -5 * -12, -5 * -400 - 700 * 3, 700 * -12 - 30 * -400]
    for (let k = 0; k < 3; k++) expect(yaw[k]).toBeCloseTo(f * cross[k], 18)
    expect(Math.abs(yaw[0] * va[0] + yaw[1] * va[1] + yaw[2] * va[2])).toBeLessThan(1e-15)
  })

  it('points the yaw right for right-hand spin and left for left-hand spin in level fire', () => {
    expect(yawOfRepose([800, 0, 0], [-300, -g, 0], p0, i)[2]).toBeGreaterThan(0)
    expect(yawOfRepose([800, 0, 0], [-300, -g, 0], -p0, i)[2]).toBeLessThan(0)
    expect(Math.hypot(...yawOfRepose([0, 800, 0], [0, -300 - g, 0], p0, i))).toBe(0)
    expect(Math.hypot(...yawOfRepose([0, 0, 0], [0, -g, 0], p0, i))).toBe(0)
  })

  it('gives the inertia of a uniform cylinder', () => {
    const c = cylinderInertia(0.01, 0.008, 0.03)
    expect(c.axial).toBeCloseTo((0.01 * 0.008 ** 2) / 8, 18)
    expect(c.transverse).toBeCloseTo(0.01 * (0.008 ** 2 / 16 + 0.03 ** 2 / 12), 18)
  })

  it('inverts the gyroscopic stability factor', () => {
    const s = { axialInertia: ix, transverseInertia: iy, spin: p0, density: 1.1, speed: 790 }
    const sg = gyroscopicStability({ ...s, diameter: 0.00782, momentSlope: 2.8 })
    const cma = momentSlopeFromStability({ ...s, diameter: 0.00782, stability: sg })
    expect(Math.abs(cma / 2.8 - 1)).toBeLessThan(1e-12)
  })

  it('evaluates constant and tabulated coefficients', () => {
    const t = [
      [1, 2],
      [2, 4],
    ] as const
    expect(coefficientAt(3, 0.5)).toBe(3)
    expect(coefficientAt(t, 1.5)).toBe(3)
    expect(coefficientAt(t, 0.5)).toBe(2)
    expect(coefficientAt(t, 9)).toBe(4)
  })
})

describe('modified point mass', () => {
  const tight = { relativeTolerance: 1e-12, absoluteTolerance: 1e-12, coriolis: false }

  it('equals the point mass without lift and Magnus force', () => {
    const shot = withAero(base, { liftSlope: 0, spinDamping: -0.01 })
    const ranges = [100, 500, 1000]
    const a = trajectory(shot, ranges, { ...tight, ...mpm })
    const b = trajectory(shot, ranges, { ...tight, spinDrift: false, jump: false })
    for (let k = 0; k < ranges.length; k++) {
      expect(Math.abs(a.points[k].height - b.points[k].height)).toBeLessThan(1e-8)
      expect(Math.abs(a.points[k].windage - b.points[k].windage)).toBeLessThan(1e-8)
      expect(Math.abs(a.points[k].spinDrift)).toBeLessThan(1e-8)
      expect(a.points[k].yaw).toBeGreaterThan(0)
      expect(a.points[k].spin).toBeLessThan(p0)
    }
    expect(b.points[0].yaw).toBeUndefined()
  })

  it('equals the point mass on a vertical shot', () => {
    const shot = { ...base, lookAngle: Math.PI / 2, zero: { elevationAngle: 0, windageAngle: 0 } }
    const ranges = [200, 800, 1500]
    const a = trajectory(shot, ranges, { ...tight, ...mpm })
    const b = trajectory(shot, ranges, { ...tight, spinDrift: false, jump: false })
    for (let k = 0; k < ranges.length; k++) {
      expect(a.points[k].yaw).toBeLessThan(1e-15)
      expect(Math.abs(a.points[k].time - b.points[k].time)).toBeLessThan(1e-10)
      expect(Math.abs(a.points[k].windage - b.points[k].windage)).toBeLessThan(1e-8)
    }
  })

  it('decays the spin as the closed form of a flat roll damping', () => {
    const air = { pressure: 95000, temperature: 303.15, humidity: 0.8, altitude: 0 }
    const clp = -0.012
    const shot: TrajectoryInput = {
      ...withAero(base, { spinDamping: clp }),
      projectile: { ...withAero(base, { spinDamping: clp }).projectile, drag: flat(0.3) },
      firearm: { ...base.firearm, sightHeight: 0 },
      air,
      zero: { elevationAngle: 0, windageAngle: 0 },
    }
    const ranges = [300, 900, 1500]
    const r = trajectory(shot, ranges, {
      relativeTolerance: 1e-10,
      gravity: 0,
      coriolis: false,
      ...mpm,
    })
    const d = 0.00782
    const rho = airDensity(air)
    for (const q of r.points) {
      const expected =
        p0 * Math.exp((rho * (Math.PI / 4) * d ** 2 * d ** 2 * clp * q.range) / (2 * ix))
      expect(Math.abs((q.spin ?? 0) / expected - 1)).toBeLessThan(1e-8)
    }
  })

  it('drifts by the integral of the first-order lift in vacuum', () => {
    const rho = airDensity(base.air)
    const area = (Math.PI / 4) * 0.00782 ** 2
    const d = 0.00782
    const v0 = 790
    // tailwind W and spin damping: yaw, lift and spin decay use the airspeed
    for (const [tailwind, clp] of [
      [0, 0],
      [150, 0],
      [0, -0.01],
      [150, -0.01],
    ]) {
      const shot: TrajectoryInput = {
        ...withAero(base, { spinDamping: clp }),
        projectile: { ...withAero(base, { spinDamping: clp }).projectile, drag: flat(0) },
        firearm: { ...base.firearm, sightHeight: 0 },
        wind: [{ endDistance: Infinity, speed: tailwind, fromDirection: Math.PI }],
        zero: { elevationAngle: 0, windageAngle: 0 },
      }
      const r = trajectory(shot, [300, 600], { ...tight, ...mpm })
      const u = v0 - tailwind
      // spin from the arc length of the air-relative path, p0 exp(c s)
      const c = (rho * area * d ** 2 * clp) / (2 * ix)
      const spin = (t: number) =>
        p0 *
        Math.exp(
          c * ((t * Math.hypot(u, g * t)) / 2 + (u ** 2 / (2 * g)) * Math.asinh((g * t) / u)),
        )
      // lift along the yaw of repose of the vacuum parabola, written out
      const az = (t: number) => {
        const v2 = u ** 2 + (g * t) ** 2
        const yaw = (2 * ix * spin(t) * g * u) / (rho * area * d * 2.8 * v2 * v2)
        return ((rho * area) / (2 * 0.01134)) * 2.6 * v2 * yaw
      }
      for (const q of r.points) {
        const t = q.time
        const expected = simpsonDrift(az, t)
        expect(Math.abs(q.windage / expected - 1)).toBeLessThan(1e-4)
        expect(Math.abs((q.spin ?? 0) / spin(t) - 1)).toBeLessThan(1e-4)
      }
    }
  })

  it('scales the drift with lift slope times axial inertia over moment slope', () => {
    const run = (a: object) =>
      trajectory(withAero(base, a), [800], { coriolis: false, ...mpm }).points[0].spinDrift
    const d0 = run({})
    expect(d0).toBeGreaterThan(0)
    for (const a of [{ liftSlope: 5.2 }, { axialInertia: 2 * ix }, { momentSlope: 1.4 }])
      expect(Math.abs(run(a) / (2 * d0) - 1)).toBeLessThan(1e-3)
  })

  it('grows the drift with range and mirrors it for left-hand twist', () => {
    for (const magnusForceSlope of [undefined, -0.5]) {
      const right = withAero(base, { magnusForceSlope, spinDamping: -0.01 })
      const left = { ...right, firearm: { ...right.firearm, twistHand: 'left' as const } }
      const ranges = [200, 500, 1000]
      const a = trajectory(right, ranges, { coriolis: false, ...mpm })
      const b = trajectory(left, ranges, { coriolis: false, ...mpm })
      for (let k = 0; k < ranges.length; k++) {
        expect(a.points[k].windage).toBeCloseTo(-b.points[k].windage, 12)
        expect(a.points[k].spinDrift).toBeCloseTo(-b.points[k].spinDrift, 12)
        expect(a.points[k].height).toBeCloseTo(b.points[k].height, 12)
        if (k > 0) expect(a.points[k].spinDrift).toBeGreaterThan(a.points[k - 1].spinDrift)
      }
    }
  })

  it('deflects downward and linearly with a positive Magnus force (ČOS 109001 eq. (27))', () => {
    const ranges = [500, 1000]
    const without = trajectory(withAero(base, { liftSlope: 0 }), ranges, {
      coriolis: false,
      ...mpm,
    })
    const lift = (c: number) =>
      trajectory(withAero(base, { liftSlope: 0, magnusForceSlope: c }), ranges, {
        coriolis: false,
        ...mpm,
      })
    const one = lift(0.5)
    const two = lift(1)
    for (let k = 0; k < ranges.length; k++) {
      const dh = one.points[k].height - without.points[k].height
      expect(dh).toBeLessThan(0)
      expect(one.points[k].windage).toBe(0)
      expect(
        Math.abs((two.points[k].height - without.points[k].height) / (2 * dh) - 1),
      ).toBeLessThan(1e-3)
    }
  })

  it('restarts at the nodes of a coefficient table', () => {
    // a steep lift-slope step and a large axial inertia make the kink visible in the windage
    const shot = withAero(base, {
      axialInertia: 30 * ix,
      liftSlope: [
        [0, 2],
        [1.6, 2],
        [1.6001, 20],
        [5, 20],
      ],
    })
    const run = (tol: number) =>
      trajectory(shot, [1000], {
        relativeTolerance: tol,
        absoluteTolerance: tol,
        coriolis: false,
        ...mpm,
      }).points[0].windage
    const ref = run(1e-13)
    const coarse = Math.abs(run(1e-6) - ref)
    const fine = Math.abs(run(1e-10) - ref)
    expect(fine).toBeLessThan(coarse / 1000)
    expect(fine).toBeLessThan(5e-9)
  })

  it('holds by the slope rule the drag table only, also when a coefficient is the same table', () => {
    // 0.3 to 0.6 over 1e-3 Mach: 500 per Mach, held as drag, extended as a coefficient
    const curve: DragTable = [
      [0, 0.3],
      [1.5, 0.3],
      [1.501, 0.6],
      [5, 0.6],
    ]
    const copy = () => curve.map(([m, c]) => [m, c] as const)
    const run = (a: object) => {
      const s = withAero(base, a)
      const shot = { ...s, projectile: { ...s.projectile, drag: { kind: 'curve', curve } } }
      return trajectory(shot as TrajectoryInput, [500, 1000], {
        relativeTolerance: 1e-6,
        absoluteTolerance: 1e-8,
        coriolis: false,
        ...mpm,
      })
    }
    const lifted = run({ liftSlope: copy() })
    // 27 with the drag hold on the lift slope
    expect(lifted.steps).toBe(24)
    expect(run({ liftSlope: curve })).toEqual(lifted)
    expect(run({ momentSlope: curve })).toEqual(run({ momentSlope: copy() }))
    expect(run({ magnusForceSlope: curve })).toEqual(run({ magnusForceSlope: copy() }))
  })

  it('reads the drag cubic of the enclosing segment between coefficient-table nodes', () => {
    // a constant table whose nodes lie between the G7 nodes adds restarts only
    const cubic: TrajectoryInput = {
      ...base,
      projectile: { ...base.projectile, drag: { ...g7, interpolation: 'monotone-cubic' } },
    }
    const tabled = withAero(cubic, {
      liftSlope: [
        [0, 2.6],
        [0.333, 2.6],
        [1.111, 2.6],
        [2.777, 2.6],
        [5, 2.6],
      ],
    })
    const o = { relativeTolerance: 1e-10, absoluteTolerance: 1e-9, coriolis: false, ...mpm }
    const a = trajectory(cubic, [300, 1000], o)
    const b = trajectory(tabled, [300, 1000], o)
    a.points.forEach((p, k) => {
      expect(Math.abs(b.points[k].height - p.height)).toBeLessThan(1e-6)
      expect(Math.abs(b.points[k].velocity - p.velocity)).toBeLessThan(1e-6)
    })
  })

  it('stops when the yaw of repose exceeds the limit', () => {
    const shot = { ...base, zero: { elevationAngle: 1.2, windageAngle: 0 } }
    const ranges = [100, 300, 1000, 2000, 3000, 4000]
    const r = trajectory(shot, ranges, { ...mpm, maxYaw: 0.01 })
    expect(r.stop).toBe('yaw')
    expect(r.points.length).toBe(3)
    expect(r.points.at(-1)?.pathAngle).toBeGreaterThan(0)
    expect(r.points.at(-1)?.yaw).toBeLessThan(0.01)
  })

  it('stops at the muzzle when the yaw of repose already exceeds the limit', () => {
    const r = trajectory(base, [0, 100, 500], { ...mpm, maxYaw: 1e-5 })
    expect(r.points[0].yaw).toBeGreaterThan(1e-5)
    expect(r.stop).toBe('yaw')
    expect(r.points.length).toBe(1)
  })

  it('reports the windage of the point-mass twin as the difference to the spin drift', () => {
    const wind = [{ endDistance: Infinity, speed: 5, fromDirection: Math.PI / 2 }]
    const ranges = [300, 1000]
    const a = trajectory({ ...base, wind }, ranges, { coriolis: false, ...mpm })
    const b = trajectory({ ...base, wind }, ranges, {
      coriolis: false,
      spinDrift: false,
      jump: false,
    })
    for (let k = 0; k < ranges.length; k++) {
      const q = a.points[k]
      expect(q.spinDrift).toBeCloseTo(q.windage - b.points[k].windage, 12)
      expect(Math.abs(q.spinDrift - q.windage)).toBeGreaterThan(1e-3)
    }
  })

  it('evaluates coefficient tables at the local Mach number', () => {
    // equal to the constant at Mach >= 2.3 (the muzzle), falling to the low value at Mach 1, which
    // spans the flight (Mach 1.09 at 1000 m)
    const cases = [
      ['momentSlope', 2.8, 1.4, (q: TrajectoryPoint) => q.spinDrift],
      ['magnusForceSlope', 0.5, 1.5, (q: TrajectoryPoint) => q.height],
      ['spinDamping', -0.01, -0.03, (q: TrajectoryPoint) => q.spin ?? 0],
    ] as const
    for (const [key, c, lo, measure] of cases) {
      const run = (k: CoefficientOverMach) =>
        measure(
          trajectory(withAero(base, { [key]: k }), [1000], { coriolis: false, ...mpm }).points[0],
        )
      const a = run(c)
      const x =
        (run([
          [1, lo],
          [2.3, c],
          [2.4, c],
        ]) -
          a) /
        (run(lo) - a)
      expect(x).toBeGreaterThan(0.05)
      expect(x).toBeLessThan(0.95)
    }
    // dragClamped covers the coefficient tables: Mach falls below 2 before 1000 m
    const clamped = withAero(base, {
      liftSlope: [
        [2, 2.6],
        [3, 2.6],
      ],
    })
    const r = trajectory(clamped, [100, 1000], mpm)
    expect(r.points.map((q) => q.dragClamped)).toEqual([false, true])
    expect(trajectory(clamped, [1000]).points[0].dragClamped).toBe(false)
  })

  it('reports the linear-theory jump with a crosswind', () => {
    const wind = [{ endDistance: Infinity, speed: 4, fromDirection: -Math.PI / 2 }]
    const r = trajectory({ ...base, wind }, [300], { coriolis: false, ...mpm })
    const angle = linearJump({
      axialInertia: ix,
      spin: p0,
      mass: 0.01134,
      diameter: 0.00782,
      speed: 790,
      liftSlope: 2.6,
      momentSlope: 2.8,
      crosswind: 4,
    })
    expect(angle).toBeLessThan(0)
    expect(r.points[0].jump).toBeCloseTo(300 * Math.tan(angle), 14)
    // with a lift-slope table the jump takes the value at the muzzle Mach number
    const table: CoefficientOverMach = [
      [2, 2.6],
      [3, 3.6],
    ]
    const tabled = trajectory(withAero({ ...base, wind }, { liftSlope: table }), [300], {
      coriolis: false,
      ...mpm,
    })
    const atMuzzle = linearJump({
      axialInertia: ix,
      spin: p0,
      mass: 0.01134,
      diameter: 0.00782,
      speed: 790,
      liftSlope: coefficientAt(table, 790 / speedOfSound(base.air)),
      momentSlope: 2.8,
      crosswind: 4,
    })
    expect(tabled.points[0].jump).toBeCloseTo(300 * Math.tan(atMuzzle), 14)
    const off = trajectory({ ...base, wind }, [300], { coriolis: false, ...mpm, jump: false })
    expect(off.points[0].jump).toBe(0)
    expect(off.omitted).toContain('jump')
  })

  it('jumps in the same direction as the point mass (BRL-MR-3877 eq. (12))', () => {
    for (const twistHand of ['right', 'left'] as const)
      for (const from of [-Math.PI / 2, Math.PI / 2]) {
        const shot: TrajectoryInput = {
          ...base,
          firearm: { ...base.firearm, twistHand },
          wind: [{ endDistance: Infinity, speed: 4, fromDirection: from }],
        }
        const pm = trajectory(shot, [300], { coriolis: false }).points[0].jump
        const m2b = trajectory(shot, [300], { coriolis: false, ...mpm }).points[0].jump
        // right-hand twist, wind from the left: the impact goes low
        const down = (twistHand === 'right') === from < 0
        expect(Math.sign(pm)).toBe(down ? -1 : 1)
        expect(Math.sign(m2b)).toBe(down ? -1 : 1)
      }
  })

  it('zeroes with wind, Coriolis and spin', () => {
    const wind = [{ endDistance: Infinity, speed: 5, fromDirection: 1 }]
    const shot: TrajectoryInput = {
      ...withAero(base, { spinDamping: -0.01, magnusForceSlope: -0.3 }),
      wind,
      site: { latitude: 0.8, azimuth: 0.5 },
      zero: { range: 300, wind },
    }
    const r = trajectory(shot, [300], mpm)
    expect(Math.abs(r.points[0].height)).toBeLessThan(1e-6)
    expect(Math.abs(r.points[0].windage)).toBeLessThan(1e-6)
    expect(r.omitted).toEqual([])
  })

  it('lists estimates and omissions and reports the stability', () => {
    const shot = withAero(base, {
      momentSlope: undefined,
      axialInertia: undefined,
      transverseInertia: undefined,
    })
    const r = trajectory(shot, [100], { coriolis: false, ...mpm })
    expect(r.estimated).toEqual(['axialInertia', 'transverseInertia', 'momentSlope'])
    expect(r.omitted).toEqual(['coriolis', 'spinDecay', 'magnus'])
    const miller = millerStability({
      mass: 0.01134,
      diameter: 0.00782,
      length: 0.0312,
      twist: 0.254,
      velocity: 790,
      air: base.air,
    })
    expect(Math.abs((r.stability ?? 0) / miller - 1)).toBeLessThan(1e-12)
    expect(trajectory(base, [100], mpm).estimated).toEqual([])
    expect(trajectory(base, [100]).estimated).toBeUndefined()
  })

  it('takes the stability from the coefficients at the muzzle', () => {
    const r = trajectory(base, [100], mpm)
    const sg = gyroscopicStability({
      axialInertia: ix,
      transverseInertia: iy,
      spin: p0,
      density: airDensity(base.air),
      speed: 790,
      diameter: 0.00782,
      momentSlope: 2.8,
    })
    expect(r.stability).toBeCloseTo(sg, 12)
    expect(790 / speedOfSound(base.air)).toBeGreaterThan(2)
  })

  it('ignores the coefficients in the point mass', () => {
    const plain = { ...base, projectile: { ...base.projectile, aerodynamics: undefined } }
    expect(trajectory(base, [500])).toEqual(trajectory(plain, [500]))
  })

  it('rejects incomplete or invalid inputs', () => {
    const bad = (shot: TrajectoryInput) =>
      expect(() => trajectory(shot, [100], mpm)).toThrow(RangeError)
    bad({ ...base, projectile: { ...base.projectile, aerodynamics: undefined } })
    bad({ ...base, firearm: { sightHeight: 0.05, twist: 0.254 } })
    bad({ ...base, firearm: { sightHeight: 0.05, twistHand: 'right' } })
    bad(withAero(base, { momentSlope: -1 }))
    bad(withAero(base, { axialInertia: 0 }))
    bad(withAero(base, { liftSlope: [[1, 2]] }))
    bad(
      withAero(base, {
        liftSlope: [
          [2, 2],
          [1, 2],
        ],
      }),
    )
    const noLength = { ...base, projectile: { ...base.projectile, length: undefined } }
    bad(withAero(noLength, { momentSlope: undefined }))
    bad(withAero(noLength, { axialInertia: undefined }))
    expect(() => trajectory(base, [100], { ...mpm, maxYaw: 0 })).toThrow(RangeError)
  })
})

describe('BRL-MR-3877 formulas', () => {
  it('equals the crosswind jump of BRL-MR-3877 eq. (12) in all four sign cases and at twice the wind', () => {
    const c = {
      ix: 2.1e-9,
      m: 0.00259,
      d: 0.00569,
      v0: 332,
      cla: 2.2,
      cma: 1.6,
      w: 4.4704,
      range: 50,
    }
    const n = 0.4064 / c.d
    const jumpOf = (hand: number, w: number) =>
      linearJump({
        axialInertia: c.ix,
        spin: (hand * 2 * Math.PI * c.v0) / (n * c.d),
        mass: c.m,
        diameter: c.d,
        speed: c.v0,
        liftSlope: c.cla,
        momentSlope: c.cma,
        crosswind: w,
      })
    expect(Math.abs(jumpOf(1, 0))).toBe(0)
    for (const hand of [1, -1])
      for (const w of [c.w, -c.w, 2 * c.w]) {
        const jump = jumpOf(hand, w)
        const eq12 =
          -(c.ix / (c.m * c.d ** 2)) *
          (c.cla / c.cma) *
          ((2 * Math.PI) / (hand * n)) *
          (w / c.v0) *
          c.range
        expect(Math.abs((c.range * jump) / eq12 - 1)).toBeLessThan(1e-12)
        if (hand === 1 && w > 0) expect(jump).toBeLessThan(0)
      }
  })

  it('equals P^2 / (4 M) of BRL-MR-3877 eq. (2)', () => {
    const i = {
      axialInertia: 8.7e-8,
      transverseInertia: 1.0e-6,
      spin: 19000,
      density: 1.18,
      speed: 790,
      diameter: 0.00782,
      momentSlope: 2.8,
    }
    const p = (i.axialInertia / i.transverseInertia) * ((i.spin * i.diameter) / i.speed)
    const m =
      (i.density * (Math.PI / 4) * i.diameter ** 2 * i.diameter ** 3 * i.momentSlope) /
      (2 * i.transverseInertia)
    expect(Math.abs(gyroscopicStability(i) / (p ** 2 / (4 * m)) - 1)).toBeLessThan(1e-12)
  })
})
