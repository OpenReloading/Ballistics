import { describe, expect, it } from 'vitest'
import {
  aerodynamicJump,
  airAt,
  airDensity,
  type BallisticCoefficientBand,
  type DragTable,
  dragCoefficient,
  dragTables,
  earthRotation,
  earthRotationRate,
  InputError,
  lbPerSqInToKgPerSqM,
  normalGravity,
  radPerMoa,
  radPerMrad,
  speedOfSound,
  standardAtmosphere,
  type TrajectoryInput,
  trajectory,
  type WindSegment,
  zeroAngles,
} from '../src/index.ts'

const g = 9.80665
const deg = Math.PI / 180
const vacuum = {
  kind: 'curve' as const,
  curve: [
    [0, 0],
    [10, 0],
  ] as const,
}
const g7 = {
  kind: 'bc' as const,
  model: 'G7' as const,
  bands: [{ ballisticCoefficient: 0.3 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
}
const base: TrajectoryInput = {
  projectile: { mass: 0.0113, diameter: 0.00782, length: 0.0315, drag: g7 },
  muzzleVelocity: 850,
  firearm: { sightHeight: 0.05 },
  air: standardAtmosphere(0),
  zero: { elevationAngle: 0, windageAngle: 0 },
}
const flat = { gravity: 0, coriolis: false }
const g1: TrajectoryInput = {
  ...base,
  projectile: {
    mass: 0.01,
    diameter: 0.0078,
    drag: {
      kind: 'bc',
      model: 'G1',
      bands: [{ ballisticCoefficient: 0.25 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
    },
  },
  firearm: { sightHeight: 0.04 },
}
/** Earth rotation rate written out, independent of the code under test, rad/s. */
const omega = 7.292115e-5

describe('vacuum', () => {
  const v0 = 800
  const bore = { elevationAngle: 0.02, windageAngle: 0.003 }
  const hs = 0.05
  const os = 0.01
  for (const look of [0, 30, -30, 60, -60]) {
    it(`matches the parabola at a look angle of ${look} deg`, () => {
      const th = look * deg
      const ranges = [0, 100, 300, 600, 1000]
      const r = trajectory(
        {
          ...base,
          projectile: { ...base.projectile, drag: vacuum },
          muzzleVelocity: v0,
          firearm: { sightHeight: hs, sightOffset: os },
          lookAngle: th,
          zero: bore,
        },
        ranges,
        { coriolis: false, relativeTolerance: 1e-10 },
      )
      const u = [Math.cos(th), Math.sin(th)]
      const n = [-u[1], u[0]]
      const p = [-hs * n[0], -hs * n[1], -os]
      const bu = Math.cos(bore.elevationAngle) * Math.cos(bore.windageAngle)
      const bn = Math.sin(bore.elevationAngle)
      const v = [
        v0 * (bu * u[0] + bn * n[0]),
        v0 * (bu * u[1] + bn * n[1]),
        v0 * Math.cos(bore.elevationAngle) * Math.sin(bore.windageAngle),
      ]
      expect(r.points.map((q) => q.range)).toEqual(ranges)
      for (const q of r.points) {
        const b = v[0] * u[0] + v[1] * u[1]
        const t = (2 * q.range) / (b + Math.sqrt(b * b - 2 * g * u[1] * q.range))
        const x = p[0] + v[0] * t
        const y = p[1] + v[1] * t - (g * t * t) / 2
        expect(Math.abs(q.time - t)).toBeLessThanOrEqual(1e-12 * Math.max(t, 1e-3))
        expect(Math.abs(q.height - (x * n[0] + y * n[1]))).toBeLessThan(1e-9)
        expect(Math.abs(q.windage - (p[2] + v[2] * t))).toBeLessThan(1e-9)
        expect(Math.abs(q.velocity ** 2 - (v0 ** 2 - 2 * g * (y - p[1])))).toBeLessThan(1e-6)
        const energy = 0.5 * base.projectile.mass * (v0 ** 2 - 2 * g * (y - p[1]))
        expect(Math.abs(q.energy / energy - 1)).toBeLessThan(1e-9)
        expect(
          Math.abs(q.pathAngle - Math.atan2(v[1] - g * t, Math.hypot(v[0], v[2]))),
        ).toBeLessThan(1e-9)
        if (q.range === 0) {
          expect(q.elevationHold).toBe(0)
          expect(q.windageHold).toBe(0)
        } else {
          // positive hold when the impact is below or left of the line of sight
          expect(q.elevationHold).toBeCloseTo(-Math.atan2(q.height, q.range), 15)
          expect(q.windageHold).toBeCloseTo(-Math.atan2(q.windage, q.range), 15)
          expect(Math.sign(q.elevationHold)).toBe(-Math.sign(q.height))
          expect(Math.sign(q.windageHold)).toBe(-Math.sign(q.windage))
        }
      }
    })
  }

  it('zeroes at the closed-form angle', () => {
    for (const look of [0, 20, -20]) {
      const th = look * deg
      const range = 500
      const angles = zeroAngles(
        {
          ...base,
          projectile: { ...base.projectile, drag: vacuum },
          muzzleVelocity: v0,
          lookAngle: th,
          zero: { range, lookAngle: th },
        },
        { coriolis: false, relativeTolerance: 1e-10 },
      )
      const dx = range * Math.cos(th) - hs * Math.sin(th)
      const dy = range * Math.sin(th) + hs * Math.cos(th)
      const q = (g * dx * dx) / (2 * v0 * v0)
      const tan = (dx - Math.sqrt(dx * dx - 4 * q * (dy + q))) / (2 * q)
      expect(Math.abs(angles.elevationAngle - (Math.atan(tan) - th))).toBeLessThan(1e-8)
      expect(Math.abs(angles.windageAngle)).toBeLessThan(1e-12)
    }
  })

  it('zeroes under the zero look angle, not the shot look angle', () => {
    const range = 500
    const r = trajectory(
      {
        ...base,
        projectile: { ...base.projectile, drag: vacuum },
        muzzleVelocity: v0,
        lookAngle: 30 * deg,
        zero: { range },
      },
      [range],
      { coriolis: false, relativeTolerance: 1e-10 },
    )
    const q = (g * range * range) / (2 * v0 * v0)
    const tan = (range - Math.sqrt(range * range - 4 * q * (hs + q))) / (2 * q)
    expect(Math.abs(r.bore.elevationAngle - Math.atan(tan))).toBeLessThan(1e-8)
  })

  it('stops a vertical shot at its apex', () => {
    const v0 = 300
    const top = (v0 * v0) / (2 * g)
    const r = trajectory(
      {
        ...base,
        projectile: { ...base.projectile, drag: vacuum },
        muzzleVelocity: v0,
        firearm: { sightHeight: 0 },
        lookAngle: Math.PI / 2,
      },
      [0, 1000, top * (1 - 1e-9), top * (1 + 1e-9)],
      { coriolis: false },
    )
    expect(r.stop).toBe('apex')
    expect(r.points.map((q) => q.range)).toEqual([0, 1000, top * (1 - 1e-9)])
  })
})

describe('drag only, one dimension', () => {
  it('follows the exponential velocity decay of a constant drag coefficient in humid air', () => {
    const cd = 0.3
    const { mass, diameter } = base.projectile
    const humid = { altitude: 0, pressure: 95000, temperature: 303.15, humidity: 0.8 }
    const k = (airDensity(humid) * cd * Math.PI * diameter ** 2) / (8 * mass)
    const r = trajectory(
      {
        ...base,
        air: humid,
        projectile: {
          mass,
          diameter,
          drag: {
            kind: 'curve',
            curve: [
              [0, cd],
              [10, cd],
            ],
          },
        },
        firearm: { sightHeight: 0 },
      },
      [100, 400, 1000],
      { ...flat, relativeTolerance: 1e-10 },
    )
    for (const q of r.points) {
      expect(Math.abs(q.velocity / (850 * Math.exp(-k * q.range)) - 1)).toBeLessThan(1e-8)
      expect(Math.abs(q.time / ((Math.exp(k * q.range) - 1) / (k * 850)) - 1)).toBeLessThan(1e-8)
    }
  })

  it('starts on a table node in the segment below it', () => {
    // the muzzle Mach number is a node; Cd is flat below it and steep above it
    const cd = 0.3
    const { mass, diameter } = base.projectile
    const k = (airDensity(base.air) * cd * Math.PI * diameter ** 2) / (8 * mass)
    const m0 = 850 / speedOfSound(base.air)
    const r = trajectory(
      {
        ...base,
        projectile: {
          mass,
          diameter,
          drag: {
            kind: 'curve',
            curve: [
              [0, cd],
              [m0, cd],
              [m0 + 0.1, 1.3],
            ],
          },
        },
        firearm: { sightHeight: 0 },
      },
      [100, 400],
      { ...flat, relativeTolerance: 1e-10 },
    )
    for (const q of r.points)
      expect(Math.abs(q.velocity / (850 * Math.exp(-k * q.range)) - 1)).toBeLessThan(1e-8)
  })

  it('takes the drag table segment of the new airspeed after a wind boundary', () => {
    // Cd 0.3 up to Mach 1.8 and 0.6 from Mach 1.85; a 150 m/s headwind from 100 m lifts the
    // airspeed onto the upper plateau, where va(t) = va0 / (1 + k va0 t) in one dimension
    const { mass, diameter } = base.projectile
    const k = (airDensity(base.air) * 0.6 * Math.PI * diameter ** 2) / (8 * mass)
    const w = 150
    const r = trajectory(
      {
        ...base,
        projectile: {
          mass,
          diameter,
          drag: {
            kind: 'curve',
            curve: [
              [0, 0.3],
              [1.8, 0.3],
              [1.85, 0.6],
              [10, 0.6],
            ],
          },
        },
        muzzleVelocity: 600,
        firearm: { sightHeight: 0 },
        wind: [
          { endDistance: 100, speed: 0, fromDirection: 0 },
          { endDistance: Infinity, speed: w, fromDirection: 0 },
        ],
      },
      [100, 110, 120, 130],
      { ...flat, relativeTolerance: 1e-10 },
    )
    const [start, ...rest] = r.points
    const va0 = start.velocity + w
    for (const q of rest) {
      const va = va0 / (1 + k * va0 * (q.time - start.time))
      expect(Math.abs((q.velocity + w) / va - 1)).toBeLessThan(1e-8)
    }
  })

  it('keeps the error proportional to the tolerance', () => {
    const cd = 0.3
    const { mass, diameter } = base.projectile
    const k = (airDensity(base.air) * cd * Math.PI * diameter ** 2) / (8 * mass)
    const exact = (Math.exp(k * 1500) - 1) / (k * 850)
    const errors = [1e-4, 1e-6, 1e-8, 1e-10].map((relativeTolerance) => {
      const r = trajectory(
        {
          ...base,
          projectile: {
            mass,
            diameter,
            drag: {
              kind: 'curve',
              curve: [
                [0, cd],
                [10, cd],
              ],
            },
          },
          firearm: { sightHeight: 0 },
        },
        [1500],
        { ...flat, relativeTolerance, absoluteTolerance: relativeTolerance },
      )
      const err = Math.abs(r.points[0].time - exact)
      expect(err).toBeLessThan(10 * relativeTolerance * exact)
      return err
    })
    expect(errors[3]).toBeLessThan(errors[1] / 1000)
  })

  it('keeps the error proportional to the tolerance with tabulated drag (G1)', () => {
    // subsonic and transonic: every node of the table is a kink the integrator must not step over
    for (const [v0, elevation, range] of [
      [300, 0.1178, 1200],
      [450, 0.06, 1000],
    ]) {
      const shot: TrajectoryInput = {
        ...g1,
        muzzleVelocity: v0,
        zero: { elevationAngle: elevation, windageAngle: 0 },
      }
      const at = (tol: number) =>
        trajectory(shot, [range], { relativeTolerance: tol, absoluteTolerance: tol, maxSteps: 1e6 })
          .points[0].height
      const exact = at(1e-13)
      const errors = [1e-6, 1e-8, 1e-10].map((tol) => {
        const err = Math.abs(at(tol) - exact)
        expect(err).toBeLessThan(tol * range)
        return err
      })
      if (v0 === 300) expect(errors[2]).toBeLessThan(errors[0] / 1000)
    }
  })
})

describe('wind', () => {
  const still: TrajectoryInput = { ...base, firearm: { sightHeight: 0 } }
  const ranges = [200, 500, 800]

  it('follows the crosswind lag rule', () => {
    const w = 0.5
    const r = trajectory(
      { ...still, wind: [{ endDistance: Infinity, speed: w, fromDirection: 270 * deg }] },
      ranges,
      { ...flat, relativeTolerance: 1e-10 },
    )
    for (const q of r.points) {
      const lag = w * (q.time - q.distance / 850)
      expect(Math.abs(q.windage / lag - 1)).toBeLessThan(1e-4)
    }
  })

  it('follows the lag rule for a vertical wind', () => {
    const w = 0.5
    const r = trajectory(
      { ...still, wind: [{ endDistance: Infinity, speed: 0, fromDirection: 0, vertical: w }] },
      ranges,
      { ...flat, relativeTolerance: 1e-10 },
    )
    for (const q of r.points) {
      const lag = w * (q.time - q.distance / 850)
      expect(Math.abs(q.height / lag - 1)).toBeLessThan(1e-4)
    }
  })

  it('reports Mach from the airspeed', () => {
    const r = trajectory(
      { ...still, wind: [{ endDistance: Infinity, speed: 20, fromDirection: 0 }] },
      ranges,
      flat,
    )
    for (const q of r.points)
      expect(q.mach).toBeCloseTo(
        (q.velocity + 20) / speedOfSound(airAt(base.air, q.heightAboveFiringPoint)),
        12,
      )
  })

  it('mirrors wind from the left and from the right', () => {
    const left = trajectory(
      { ...base, wind: [{ endDistance: Infinity, speed: 5, fromDirection: 270 * deg }] },
      ranges,
    )
    const right = trajectory(
      { ...base, wind: [{ endDistance: Infinity, speed: 5, fromDirection: 90 * deg }] },
      ranges,
    )
    left.points.forEach((p, k) => {
      expect(p.windage).toBeGreaterThan(0)
      expect(Math.abs(p.windage + right.points[k].windage)).toBeLessThan(1e-12)
    })
  })

  it('reproduces the calm trajectory up to the end of a calm segment', () => {
    const all = [100, 250, 400, 500, 650, 900]
    const calm = trajectory(base, all)
    const gust = trajectory(
      {
        ...base,
        wind: [
          { endDistance: 500, speed: 0, fromDirection: 0 },
          { endDistance: Infinity, speed: 8, fromDirection: 90 * deg },
        ],
      },
      all,
    )
    gust.points.forEach((p, k) => {
      const q = calm.points[k]
      if (p.range <= 500) {
        expect(Math.abs(p.height - q.height)).toBeLessThan(1e-12)
        expect(p.windage).toBe(q.windage)
      } else expect(p.windage).toBeLessThan(q.windage - 1e-3)
    })
  })

  it('switches wind segments at horizontal distance at a look angle', () => {
    const wind = [
      { endDistance: 500, speed: 0, fromDirection: 0 },
      { endDistance: Infinity, speed: 8, fromDirection: 90 * deg },
    ]
    const [inside, beyond] = trajectory({ ...still, lookAngle: 30 * deg, wind }, [560, 600]).points
    expect(inside.distance).toBeLessThan(500)
    expect(inside.windage).toBe(0)
    expect(beyond.distance).toBeGreaterThan(500)
    expect(beyond.windage).toBeLessThan(-1e-4)
  })

  it('returns to the previous segment when the bullet moves back across a boundary', () => {
    // fired straight up with the bore tilted back: the bullet crosses x = -1 m backwards
    const wind = [
      { endDistance: -1, speed: 5, fromDirection: 90 * deg },
      { endDistance: Infinity, speed: 0, fromDirection: 0 },
    ]
    const shot: TrajectoryInput = {
      ...still,
      lookAngle: Math.PI / 2,
      wind,
      zero: { elevationAngle: 0.01, windageAngle: 0 },
    }
    const [q] = trajectory(shot, [1000]).points
    expect(q.distance).toBeLessThan(-1)
    expect(q.windage).toBeLessThan(-1e-4)
  })

  it('keeps wind horizontal at any look angle', () => {
    const up = { ...still, lookAngle: Math.PI / 2 }
    const calm = trajectory(up, [500])
    const head = trajectory(
      { ...up, wind: [{ endDistance: Infinity, speed: 10, fromDirection: 0 }] },
      [500],
    )
    expect(head.points[0].windage).toBe(0)
    expect(head.points[0].height - calm.points[0].height).toBeGreaterThan(0.01)
  })
})

describe('Earth rotation', () => {
  it('resolves the rotation vector in the ground frame', () => {
    const c = Math.cos(45 * deg)
    const s = Math.sin(45 * deg)
    const close = (a: number[], b: number[]) =>
      a.forEach((x, i) => {
        expect(Math.abs(x - b[i])).toBeLessThan(1e-18)
      })
    close(earthRotation(45 * deg, 0), [omega * c, omega * s, 0])
    close(earthRotation(45 * deg, 90 * deg), [0, omega * s, -omega * c])
    close(earthRotation(-45 * deg, 180 * deg), [-omega * c, -omega * s, 0])
  })

  it('matches the first-order perturbation of the vacuum parabola', () => {
    const lat = 45 * deg
    const az = 30 * deg
    const v0 = 800
    const bore = { elevationAngle: 0.05, windageAngle: 0.02 }
    const ox = omega * Math.cos(lat) * Math.cos(az)
    const oy = omega * Math.sin(lat)
    const oz = -omega * Math.cos(lat) * Math.sin(az)
    const shot: TrajectoryInput = {
      ...base,
      projectile: { ...base.projectile, drag: vacuum },
      muzzleVelocity: v0,
      firearm: { sightHeight: 0 },
      site: { latitude: lat, azimuth: az },
      zero: bore,
    }
    const vx = v0 * Math.cos(bore.elevationAngle) * Math.cos(bore.windageAngle)
    const vy = v0 * Math.sin(bore.elevationAngle)
    const vz = v0 * Math.cos(bore.elevationAngle) * Math.sin(bore.windageAngle)
    for (const q of trajectory(shot, [300, 600, 1000], {
      relativeTolerance: 1e-11,
      absoluteTolerance: 1e-10,
    }).points) {
      // a = -2 Omega x v on the vacuum velocity (vx, vy - g t, vz), integrated twice
      const t = q.time
      const rise = vy * t * t - (g * t ** 3) / 3
      const dx = -oy * vz * t * t + oz * rise
      const dy = -(oz * vx - ox * vz) * t * t
      const dz = oy * vx * t * t - ox * rise
      expect(Math.abs((q.windage - vz * t) / dz - 1)).toBeLessThan(1e-3)
      expect(Math.abs((q.height - (vy * t - (g * t * t) / 2)) / dy - 1)).toBeLessThan(1e-3)
      // the downrange part shifts the time at which the slant range is reached
      expect(Math.abs((q.time - q.range / vx) / (-dx / vx) - 1)).toBeLessThan(1e-2)
    }
  })

  it('deflects a vertical shot fired north to the west', () => {
    // a_z = -2 Omega cos(lat) (v0 - g t): z = -2 Omega cos(lat) (v0 t^2 / 2 - g t^3 / 6), which is
    // -(2/3) Omega cos(lat) v0^3 / g^2 at the apex
    const lat = 45 * deg
    const v0 = 300
    const shot: TrajectoryInput = {
      ...base,
      projectile: { ...base.projectile, drag: vacuum },
      muzzleVelocity: v0,
      firearm: { sightHeight: 0 },
      lookAngle: Math.PI / 2,
      site: { latitude: lat, azimuth: 0 },
    }
    const top = (v0 * v0) / (2 * g)
    const r = trajectory(shot, [1000, 3000, top * (1 - 1e-4)], {
      relativeTolerance: 1e-11,
      absoluteTolerance: 1e-10,
    })
    expect(r.points).toHaveLength(3)
    for (const q of r.points) {
      const t = q.time
      const west = -2 * omega * Math.cos(lat) * ((v0 * t * t) / 2 - (g * t ** 3) / 6)
      expect(Math.abs(q.windage / west - 1)).toBeLessThan(1e-4)
    }
  })

  it('matches the first-order deflection with constant drag, damped by the co-rotating air', () => {
    // gravity 0, constant Cd: x(t) = ln(1 + a t) / k with a = k v0; both deflections are
    // 2 Omega_i (T X - integral of x dt) to first order in Omega
    const cd = 0.3
    const { mass, diameter } = base.projectile
    const k = (airDensity(base.air) * cd * Math.PI * diameter ** 2) / (8 * mass)
    const a = k * 850
    const oy = omega * Math.sin(45 * deg)
    const oz = -omega * Math.cos(45 * deg) * Math.sin(60 * deg)
    const shot: TrajectoryInput = {
      ...base,
      projectile: {
        mass,
        diameter,
        drag: {
          kind: 'curve',
          curve: [
            [0, cd],
            [10, cd],
          ],
        },
      },
      firearm: { sightHeight: 0 },
      site: { latitude: 45 * deg, azimuth: 60 * deg },
    }
    for (const q of trajectory(shot, [300, 1000, 2000], { gravity: 0, relativeTolerance: 1e-10 })
      .points) {
      const t = q.time
      const integral = ((1 + a * t) * Math.log(1 + a * t) - a * t) / (a * k)
      const lag = t * q.range - integral
      expect(Math.abs(q.windage / (2 * oy * lag) - 1)).toBeLessThan(1e-3)
      expect(Math.abs(q.height / (-2 * oz * lag) - 1)).toBeLessThan(1e-3)
      // below the vacuum value Omega_y X t
      expect(q.windage).toBeLessThan(oy * q.range * t)
    }
  })

  it('deflects with the signs of the hemisphere and the azimuth', () => {
    const at = (latitude?: number, azimuth?: number) =>
      trajectory({ ...base, site: { latitude, azimuth } }, [1000]).points[0]
    const off = at()
    const north = at(45 * deg, 0)
    expect(north.windage).toBeGreaterThan(off.windage)
    expect(at(-45 * deg, 0).windage).toBeLessThan(off.windage)
    expect(at(45 * deg, 90 * deg).height).toBeGreaterThan(off.height)
    expect(at(45 * deg, 270 * deg).height).toBeLessThan(off.height)
    expect(Math.abs(north.height - off.height)).toBeLessThan(1e-4)
    expect(Math.abs(at(45 * deg, 180 * deg).height - off.height)).toBeLessThan(1e-4)
    // the azimuth enters the lateral deflection only through the horizontal rotation component
    for (const azimuth of [90, 180, 270])
      expect(Math.abs(at(45 * deg, azimuth * deg).windage - north.windage)).toBeLessThan(2e-3)
  })

  it('reports what it leaves out', () => {
    const none = trajectory(base, [500])
    expect(none.omitted).toContain('coriolis')
    expect(trajectory(base, [500], { coriolis: false }).points).toEqual(none.points)
    expect(
      trajectory({ ...base, site: { latitude: 0.8 } }, [500], { coriolis: false }).points,
    ).toEqual(none.points)
    expect(trajectory({ ...base, site: { latitude: 0.8 } }, [500]).omitted).toContain(
      'coriolisVertical',
    )
    expect(earthRotation(0.8)).toEqual([0, earthRotationRate * Math.sin(0.8), 0])
  })

  it('gives the WGS 84 normal gravity at the equator and the poles', () => {
    expect(Math.abs(normalGravity(0) / 9.7803253359 - 1)).toBeLessThan(1e-12)
    expect(Math.abs(normalGravity(Math.PI / 2) / 9.8321849378 - 1)).toBeLessThan(1e-9)
  })
})

describe('convergence', () => {
  const shot: TrajectoryInput = { ...base, zero: { range: 100 } }
  const ranges = [500, 1000, 1500]

  it('agrees with an independent fixed-step Runge-Kutta reference', () => {
    const r = trajectory(shot, ranges, { relativeTolerance: 1e-12, absoluteTolerance: 1e-14 })
    const s = g7.bands[0].ballisticCoefficient
    const f = (y: number[]) => {
      const air = airAt(base.air, y[1])
      const v = Math.hypot(y[3], y[4], y[5])
      const k =
        ((Math.PI / 8) *
          airDensity(air) *
          dragCoefficient(dragTables.G7, v / speedOfSound(air)) *
          v) /
        s
      return [y[3], y[4], y[5], -k * y[3], -k * y[4] - g, -k * y[5]]
    }
    const hs = base.firearm.sightHeight
    const e = r.bore.elevationAngle
    let y = [
      0,
      -hs,
      0,
      850 * Math.cos(e) * Math.cos(r.bore.windageAngle),
      850 * Math.sin(e),
      850 * Math.cos(e) * Math.sin(r.bore.windageAngle),
    ]
    const dt = 1e-5
    const axpy = (a: number[], b: number[], c: number) => a.map((ai, i) => ai + c * b[i])
    let j = 0
    while (j < ranges.length) {
      const k1 = f(y)
      const k2 = f(axpy(y, k1, dt / 2))
      const k3 = f(axpy(y, k2, dt / 2))
      const k4 = f(axpy(y, k3, dt))
      const next = y.map((yi, i) => yi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
      while (j < ranges.length && next[0] >= ranges[j]) {
        const w = (ranges[j] - y[0]) / (next[0] - y[0])
        const height = y[1] + w * (next[1] - y[1])
        expect(Math.abs(height - r.points[j].height)).toBeLessThan(1e-6)
        j++
      }
      y = next
    }
  })
})

describe('zeroing', () => {
  const twisted: TrajectoryInput = {
    ...base,
    firearm: { sightHeight: 0.05, sightOffset: 0.005, twist: 0.254, twistHand: 'right' },
    wind: [{ endDistance: Infinity, speed: 4, fromDirection: 60 * deg }],
    site: { latitude: 48 * deg, azimuth: 100 * deg },
  }

  it('hits the line of sight at the zero range with every correction on', () => {
    const shot: TrajectoryInput = { ...twisted, zero: { range: 300, wind: twisted.wind } }
    const r = trajectory(shot, [300])
    expect(r.omitted).toEqual([])
    expect(r.stability).toBeGreaterThan(1)
    const [q] = r.points
    expect(q.spinDrift).toBeGreaterThan(0)
    // right-hand twist, wind from the right (60 deg): up
    expect(q.jump).toBeGreaterThan(0)
    expect(Math.abs(q.height)).toBeLessThan(1e-6)
    expect(Math.abs(q.windage)).toBeLessThan(1e-6)
  })

  it('keeps the zero air apart from the shot air', () => {
    const cold = { ...standardAtmosphere(0), temperature: 263.15 }
    const warm = { ...standardAtmosphere(0), temperature: 303.15 }
    const r = trajectory({ ...base, air: warm, zero: { range: 300, air: cold } }, [300])
    expect(r.points[0].height).toBeGreaterThan(1e-4)
  })

  it('converges for long zeros with tabulated drag at default and loose tolerances', () => {
    const shot: TrajectoryInput = { ...g1, muzzleVelocity: 600 }
    for (const range of [800, 1000, 1200])
      for (const options of [{}, { relativeTolerance: 1e-4, absoluteTolerance: 1e-4 }]) {
        const bore = zeroAngles({ ...shot, zero: { range } }, options)
        const [q] = trajectory({ ...shot, zero: bore }, [range], {
          relativeTolerance: 1e-12,
          absoluteTolerance: 1e-12,
        }).points
        expect(Math.abs(q.height)).toBeLessThan('relativeTolerance' in options ? 1e-3 : 1e-5)
      }
  })

  it('zeroes without wind unless the zero names one', () => {
    const windy: TrajectoryInput = {
      ...base,
      wind: [{ endDistance: Infinity, speed: 6, fromDirection: 90 * deg }],
      zero: { range: 300 },
    }
    expect(trajectory(windy, [300]).bore).toEqual(zeroAngles({ ...base, zero: { range: 300 } }))
  })

  it('computes spin drift and jump of the zero under the zero air', () => {
    const cold = { ...standardAtmosphere(0), temperature: 263.15 }
    const warm = { ...standardAtmosphere(0), temperature: 303.15 }
    const bore = zeroAngles({
      ...twisted,
      air: warm,
      zero: { range: 300, air: cold, wind: twisted.wind },
    })
    const [q] = trajectory({ ...twisted, air: cold, zero: bore }, [300]).points
    expect(Math.abs(q.height)).toBeLessThan(1e-6)
    expect(Math.abs(q.windage)).toBeLessThan(1e-6)
  })

  it('rejects an unreachable zero range and invalid inputs', () => {
    expect(() => zeroAngles({ ...base, zero: { range: 1e6 } })).toThrow(InputError)
    expect(() => trajectory({ ...base, muzzleVelocity: 0 }, [100])).toThrow(InputError)
    expect(() => trajectory({ ...base, lookAngle: 2 }, [100])).toThrow(InputError)
    expect(() => trajectory(base, [-1])).toThrow(InputError)
  })

  it('adds the steps of the zero search and the run to a shared budget', () => {
    const budget = { used: 0, max: Infinity }
    const t = trajectory({ ...base, zero: { range: 300 } }, [1500], { budget })
    const search = budget.used - t.steps
    expect(search).toBeGreaterThan(0)
    const capped = { used: 0, max: budget.used - 1 }
    expect(() => trajectory({ ...base, zero: { range: 300 } }, [1500], { budget: capped })).toThrow(
      `more than ${budget.used - 1} integration steps in total`,
    )
    expect(capped.used).toBe(capped.max)
    for (const bad of [
      { used: 0, max: Number.NaN },
      { used: Number.NaN, max: 10 },
      { used: 0, max: -1 },
    ])
      expect(() => trajectory(base, [100], { budget: bad })).toThrow('step budget')
  })

  it('reports the user step limit when restarts use it up', () => {
    expect(() => trajectory(base, [1500], { maxSteps: 20 })).toThrow(
      'more than 20 integration steps',
    )
  })
})

describe('spin drift and jump in the trajectory', () => {
  const twist = (hand: 'right' | 'left', from: number): TrajectoryInput => ({
    ...base,
    firearm: { sightHeight: 0.05, twist: 0.254, twistHand: hand },
    wind: [{ endDistance: Infinity, speed: 4, fromDirection: from }],
    zero: { elevationAngle: 0.002, windageAngle: 0 },
  })

  it('adds spin drift to the windage and jump to the height with their signs', () => {
    for (const hand of ['right', 'left'] as const)
      for (const from of [90 * deg, 270 * deg]) {
        const shot = twist(hand, from)
        const [on] = trajectory(shot, [500]).points
        const [noDrift] = trajectory(shot, [500], { spinDrift: false }).points
        const [noJump] = trajectory(shot, [500], { jump: false }).points
        expect(on.windage - noDrift.windage).toBeCloseTo(on.spinDrift, 12)
        expect(on.height - noJump.height).toBeCloseTo(on.jump, 12)
        expect(Math.sign(on.spinDrift)).toBe(hand === 'right' ? 1 : -1)
        // right-hand twist: wind from the left (270 deg) lowers the shot
        expect(Math.sign(on.jump)).toBe((hand === 'right') === from > Math.PI ? -1 : 1)
      }
  })

  it('takes the jump from the crosswind of the first wind segment', () => {
    const wind = [
      { endDistance: 100, speed: 4, fromDirection: 270 * deg },
      { endDistance: Infinity, speed: 10, fromDirection: 90 * deg },
    ]
    const r = trajectory({ ...twist('right', 0), wind }, [500])
    const { length = 0, diameter } = base.projectile
    // wind from 270 deg blows to the right at 4 m/s
    const angle = aerodynamicJump(r.stability ?? 0, length / diameter, 4, 'right')
    expect(r.points[0].jump).toBeCloseTo(500 * Math.tan(angle), 12)
    expect(r.points[0].jump).toBeLessThan(0)
  })

  it('omits spin drift and jump without a twist hand', () => {
    const r = trajectory({ ...base, firearm: { sightHeight: 0.05, twist: 0.254 } }, [300])
    expect(r.omitted).toEqual(expect.arrayContaining(['spinDrift', 'jump']))
    expect(r.stability).toBeGreaterThan(1)
    expect(r.points[0].spinDrift).toBe(0)
  })
})

describe('outputs and stops', () => {
  it('sorts the requested ranges and merges duplicates', () => {
    expect(trajectory(base, [600, 100, 600]).points.map((q) => q.range)).toEqual([100, 600])
  })

  it('flags transonic, subsonic and clamped drag from the Mach number', () => {
    // a custom curve that starts at Mach 1: below it the drag is clamped
    const shot: TrajectoryInput = {
      ...base,
      projectile: {
        mass: 0.0113,
        diameter: 0.00782,
        drag: {
          kind: 'curve',
          curve: [
            [1, 0.5],
            [3, 0.4],
          ],
        },
      },
      muzzleVelocity: 450,
      firearm: { sightHeight: 0 },
    }
    const r = trajectory(
      shot,
      Array.from({ length: 30 }, (_, k) => 50 * k),
      flat,
    )
    for (const q of r.points) {
      expect(q.transonic).toBe(q.mach >= 0.8 && q.mach <= 1.2)
      expect(q.subsonic).toBe(q.mach < 1)
      expect(q.dragClamped).toBe(q.mach < 1)
    }
    for (const key of ['transonic', 'subsonic', 'dragClamped'] as const)
      expect(new Set(r.points.map((q) => q[key])).size).toBe(2)
    expect(r.points.some((q) => q.mach >= 0.8 && q.mach < 0.9)).toBe(true)
  })

  it('follows the drag table while the Mach number rises', () => {
    // dropped straight down at Mach 0.09; Cd steps from 0.1 below Mach 0.2 to 0.3 above Mach 0.25,
    // so the speed stays below the terminal speed of Cd 0.3 in the thinnest air on the path
    const mass = 0.01
    const diameter = 0.0078
    const shot: TrajectoryInput = {
      ...base,
      projectile: {
        mass,
        diameter,
        drag: {
          kind: 'curve',
          curve: [
            [0, 0.1],
            [0.2, 0.1],
            [0.25, 0.3],
            [10, 0.3],
          ],
        },
      },
      muzzleVelocity: 30,
      firearm: { sightHeight: 0 },
      lookAngle: -Math.PI / 2,
    }
    const [q] = trajectory(shot, [1500], { coriolis: false }).points
    const terminal = Math.sqrt(
      (8 * mass * g) / (airDensity(base.air) * 0.3 * Math.PI * diameter ** 2),
    )
    expect(q.mach).toBeGreaterThan(0.25)
    expect(q.velocity).toBeLessThan(terminal)
  })

  it('stops at maxTime and at the altitude limits', () => {
    const timed = trajectory(base, [1500], { maxTime: 0.5 })
    expect(timed.stop).toBe('maxTime')
    expect(timed.points).toEqual([])
    const high = trajectory(
      { ...base, air: standardAtmosphere(10900), lookAngle: 60 * deg },
      [2000],
    )
    expect(high.stop).toBe('atmosphere')
    const low = trajectory(
      { ...base, air: standardAtmosphere(-4900), lookAngle: -60 * deg },
      [2000],
    )
    expect(low.stop).toBe('atmosphere')
  })

  it('exports the angle units', () => {
    expect(radPerMrad).toBe(1e-3)
    expect(radPerMoa).toBe(Math.PI / 10800)
  })
})

describe('boundaries closer than the event resolution', () => {
  /** The next double above a positive x. */
  const next = (x: number) => {
    const b = new Float64Array([x])
    new BigInt64Array(b.buffer)[0]++
    return b[0]
  }
  const mass = 0.01134
  const diameter = 0.00782
  const bc = 0.5 * lbPerSqInToKgPerSqM
  const air = standardAtmosphere(0, 0)
  const o = { coriolis: false, spinDrift: false, jump: false }
  /** The G1 table as the custom curve of the BC (PM 17.1 item 2). */
  const own: DragTable = dragTables.G1.map(([m, c]) => [m, (c * mass) / (bc * diameter ** 2)])
  /** The curve with an extra node, carrying the Cd of node k, at `at` just above it. */
  const extra = (curve: DragTable, k: number, at: number): DragTable => [
    ...curve.slice(0, k + 1),
    [at, curve[k][1]],
    ...curve.slice(k + 1),
  ]
  const g1Shot = (
    drag: TrajectoryInput['projectile']['drag'],
    rest: Partial<TrajectoryInput> = {},
  ): TrajectoryInput => ({
    projectile: { mass, diameter, drag },
    muzzleVelocity: 850,
    firearm: { sightHeight: 0.04 },
    air,
    zero: { range: 100 },
    ...rest,
  })
  const at1000 = (shot: TrajectoryInput, options = {}) =>
    trajectory(shot, [1000], { ...o, ...options }).points[0]

  it('reads the right segment after an extra node one ulp above Mach 2.15', () => {
    const k = own.findIndex(([m]) => m === 2.15)
    expect(2.15 + 2 ** -51).toBe(next(2.15))
    const ref = at1000(g1Shot({ kind: 'curve', curve: own })).velocity
    const v = at1000(g1Shot({ kind: 'curve', curve: extra(own, k, next(2.15)) })).velocity
    expect(Math.abs(ref - 366.65)).toBeLessThan(0.01)
    expect(Math.abs(v / ref - 1)).toBeLessThan(1e-9)
  })

  it('reads the right segment after an extra node at every supersonic node', () => {
    const bore = { zero: { elevationAngle: 0.002, windageAngle: 0 } }
    const ref = at1000(g1Shot({ kind: 'curve', curve: own }, bore)).velocity
    let worst = 0
    own.forEach(([m], k) => {
      if (m <= 1.1 || m >= 2.45) return
      for (const at of [next(m), next(next(m))]) {
        const v = at1000(g1Shot({ kind: 'curve', curve: extra(own, k, at) }, bore)).velocity
        worst = Math.max(worst, Math.abs(v / ref - 1))
      }
    })
    expect(worst).toBeLessThan(1e-9)
  })

  it('reads the right segment when the Mach number falls and rises again', () => {
    const curve: DragTable = [
      [0, 0.5],
      [0.05, 0.48],
      [0.1, 0.47],
      [0.15, 0.46],
      [0.2, 0.45],
      [0.25, 0.43],
      [0.3, 0.42],
      [0.35, 0.4],
      [0.4, 0.39],
      [0.5, 0.37],
      [1, 0.6],
    ]
    const steep = (c: DragTable): TrajectoryInput => ({
      projectile: { mass, diameter, drag: { kind: 'curve', curve: c } },
      muzzleVelocity: 120,
      firearm: { sightHeight: 0 },
      air,
      zero: { elevationAngle: 1.45, windageAngle: 0 },
    })
    const ranges = [50, 100, 150, 200]
    const ref = trajectory(steep(curve), ranges, o).points
    expect(Math.min(...ref.map((p) => p.mach))).toBeLessThan(0.05)
    expect(ref[3].mach).toBeGreaterThan(0.25)
    for (const k of [1, 2]) {
      const t = trajectory(steep(extra(curve, k, next(curve[k][0]))), ranges, o).points
      for (const [i, p] of t.entries())
        expect(Math.abs(p.velocity - ref[i].velocity)).toBeLessThan(1e-6)
    }
  })

  it('reads the right BC band after two thresholds close together', () => {
    const banded = (bands: BallisticCoefficientBand[]) =>
      at1000(
        g1Shot(
          { kind: 'bc', model: 'G1', bands },
          { zero: { elevationAngle: 0.002, windageAngle: 0 } },
        ),
      ).velocity
    let worst = 0
    for (let s = 400; s <= 799; s += 7) {
      const ref = banded([
        { ballisticCoefficient: 0.9 * bc, minVelocity: 0 },
        { ballisticCoefficient: bc, minVelocity: s },
      ])
      for (const w of [1e-12, 1e-10]) {
        const v = banded([
          { ballisticCoefficient: 0.9 * bc, minVelocity: 0 },
          { ballisticCoefficient: bc, minVelocity: s },
          { ballisticCoefficient: bc, minVelocity: s * (1 + w) },
        ])
        worst = Math.max(worst, Math.abs(v / ref - 1))
      }
    }
    expect(worst).toBeLessThan(1e-9)
  })

  it('reads the right wind segment after two ends close together', () => {
    const windage = (wind: WindSegment[]) =>
      at1000(
        g1Shot(
          { kind: 'bc', model: 'G1', bands: [{ ballisticCoefficient: bc, minVelocity: 0 }] },
          { wind, zero: { elevationAngle: 0.002, windageAngle: 0 } },
        ),
      ).windage
    const right = { endDistance: Infinity, speed: 5, fromDirection: Math.PI / 2 }
    let worst = 0
    for (let x = 50; x <= 948; x += 13) {
      const ref = windage([{ endDistance: x, speed: 0, fromDirection: 0 }, right])
      for (const w of [1e-12, 1e-10]) {
        const v = windage([
          { endDistance: x, speed: 0, fromDirection: 0 },
          { endDistance: x * (1 + w), speed: 0, fromDirection: 0 },
          right,
        ])
        worst = Math.max(worst, Math.abs(v - ref))
      }
    }
    expect(worst).toBeLessThan(1e-6)
  })

  it('keeps the BC band when a drag node event restarts on its threshold', () => {
    const a = speedOfSound(air)
    const level = (s: number) =>
      at1000(
        g1Shot(
          {
            kind: 'bc',
            model: 'G1',
            bands: [
              { ballisticCoefficient: 0.9 * bc, minVelocity: 0 },
              { ballisticCoefficient: bc, minVelocity: s },
            ],
          },
          { firearm: { sightHeight: 0 }, zero: { elevationAngle: 0, windageAngle: 0 } },
        ),
        { gravity: 0 },
      ).velocity
    let worst = 0
    for (const [m] of dragTables.G1) {
      if (m <= 1.1 || m >= 2.45) continue
      for (let j = -3; j <= 3; j++) {
        const s = m * a * (1 + j * 1e-12)
        worst = Math.max(worst, Math.abs(level(s) / level(s * (1 + 1e-6)) - 1))
      }
    }
    expect(worst).toBeLessThan(1e-6)
  })

  it('settles the BC band with the airspeed of the new wind', () => {
    const a = speedOfSound(air)
    const s = 650
    const ms = s / a
    const cd = (m: number, b: number) =>
      (dragCoefficient(dragTables.G1, m) * mass) / (b * diameter ** 2)
    const level = (drag: TrajectoryInput['projectile']['drag']) =>
      trajectory(
        g1Shot(drag, {
          muzzleVelocity: 600,
          firearm: { sightHeight: 0 },
          zero: { elevationAngle: 0, windageAngle: 0 },
          wind: [
            { endDistance: 100, speed: 0, fromDirection: 0 },
            { endDistance: Infinity, speed: 150, fromDirection: 0 },
          ],
        }),
        [100, 110, 120, 130, 200],
        { ...o, gravity: 0 },
      ).points
    const banded = level({
      kind: 'bc',
      model: 'G1',
      bands: [
        { ballisticCoefficient: bc, minVelocity: 0 },
        { ballisticCoefficient: 2 * bc, minVelocity: s },
      ],
    })
    // level flight without gravity: airspeed is Mach times a, so the bands are a curve with a step at s / a
    const ref = level({
      kind: 'curve',
      curve: [
        ...dragTables.G1.filter(([m]) => m < ms).map(([m]): [number, number] => [m, cd(m, bc)]),
        [ms, cd(ms, bc)],
        [next(ms), cd(next(ms), 2 * bc)],
        ...dragTables.G1.filter(([m]) => m > next(ms)).map(([m]): [number, number] => [
          m,
          cd(m, 2 * bc),
        ]),
      ],
    })
    for (const [i, p] of banded.entries())
      expect(Math.abs(p.velocity / ref[i].velocity - 1)).toBeLessThan(1e-7)
  })

  describe('steep narrow drag segments', () => {
    /** The curve with the Cd of node k times f from w above that node on: a step of width w. */
    const step = (k: number, w: number, f = 1.2): DragTable => [
      ...own.slice(0, k + 1),
      [own[k][0] + w, own[k][1] * f],
      ...own.slice(k + 1),
    ]
    const bore = { zero: { elevationAngle: 0.002, windageAngle: 0 } }
    const tight = { relativeTolerance: 1e-12, absoluteTolerance: 1e-12 }

    it('reads a 20 % step 1e-9 Mach wide at Mach 1.35 on the right segment', () => {
      const k = own.findIndex(([m]) => m === 1.35)
      const shot = g1Shot({ kind: 'curve', curve: step(k, 1e-9) }, bore)
      const v = at1000(shot).velocity
      expect(Math.abs(v - 365.64)).toBeLessThan(0.01)
      expect(Math.abs(v - at1000(shot, tight).velocity)).toBeLessThan(1e-5)
    })

    it('finishes 20 % steps 1e-9 and 1e-11 Mach wide at every supersonic node', () => {
      let worst = 0
      own.forEach(([m], k) => {
        if (m <= 1.1 || m >= 2.45) return
        for (const w of [1e-9, 1e-11]) {
          const shot = g1Shot({ kind: 'curve', curve: step(k, w) }, bore)
          // absoluteTolerance 1e-10, unheld: at 1e-9, 8 runs exceeded 100000 steps and 4 were wrong or stopped short;
          // at 1e-11, 1 exceeded 100000 steps
          const v = at1000(shot, { absoluteTolerance: 1e-10 }).velocity
          worst = Math.max(worst, Math.abs(v - at1000(shot, tight).velocity))
        }
      })
      expect(worst).toBeLessThan(1e-5)
    })

    it('finishes Cd steps of times 1000 over 2e-6 Mach at every supersonic node', () => {
      let worst = 0
      own.forEach(([m], k) => {
        if (m <= 1.1 || m >= 2.45) return
        const shot = g1Shot({ kind: 'curve', curve: step(k, 2e-6, 1000) }, bore)
        // unheld, 27 of 27 runs exceeded 100000 steps at the default options
        const v = at1000(shot).velocity
        worst = Math.max(worst, Math.abs(v - at1000(shot, tight).velocity))
      })
      expect(worst).toBeLessThan(1e-3)
    })

    it('holds a falling cubic step on a rising Mach number', () => {
      const curve: DragTable = [
        [0, 0.5],
        [0.05, 0.48],
        [0.1, 0.47],
        [0.15, 0.46],
        [0.2, 0.45],
        [0.25, 0.43],
        [0.3, 0.42],
        [0.35, 0.4],
        [0.4, 0.39],
        [0.5, 0.37],
        [1, 0.6],
      ]
      // Cd times 0.1 from 1e-11 above Mach 0.05; unheld, 0.69 m/s off at 200 m
      const stepped: DragTable = [...curve.slice(0, 2), [0.05 + 1e-11, 0.048], ...curve.slice(2)]
      const shot: TrajectoryInput = {
        projectile: {
          mass,
          diameter,
          drag: { kind: 'curve', curve: stepped, interpolation: 'monotone-cubic' },
        },
        muzzleVelocity: 120,
        firearm: { sightHeight: 0 },
        air,
        zero: { elevationAngle: 1.45, windageAngle: 0 },
      }
      const ranges = [50, 100, 150, 200]
      const v = trajectory(shot, ranges, { ...o, absoluteTolerance: 1e-10 }).points
      const ref = trajectory(shot, ranges, { ...o, ...tight }).points
      expect(Math.min(...v.map((p) => p.mach))).toBeLessThan(0.05)
      for (const [i, p] of v.entries())
        expect(Math.abs(p.velocity - ref[i].velocity)).toBeLessThan(1e-5)
    })

    it('finishes 20 % steps 1e-9 Mach wide in the modified point mass', () => {
      const model = { model: 'modified-point-mass' as const }
      let worst = 0
      own.forEach(([m], k) => {
        if (m <= 1.1 || m >= 2.45) return
        const shot: TrajectoryInput = {
          ...g1Shot({ kind: 'curve', curve: step(k, 1e-9) }, bore),
          projectile: {
            mass,
            diameter,
            length: 0.0325,
            drag: { kind: 'curve', curve: step(k, 1e-9) },
            aerodynamics: { liftSlope: 2.5 },
          },
          firearm: { sightHeight: 0.04, twist: 0.254, twistHand: 'right' },
        }
        // unheld, 14 of 27 runs failed with absoluteTolerance 1e-10
        const v = at1000(shot, { ...model, absoluteTolerance: 1e-10 }).velocity
        worst = Math.max(worst, Math.abs(v - at1000(shot, { ...model, ...tight }).velocity))
      })
      expect(worst).toBeLessThan(1e-5)
    })
  })

  it('reads the right grid segment of the modified point mass', () => {
    const shot = (liftSlope: number | DragTable): TrajectoryInput => ({
      ...g1Shot({ kind: 'bc', model: 'G1', bands: [{ ballisticCoefficient: bc, minVelocity: 0 }] }),
      projectile: {
        mass,
        diameter,
        length: 0.0325,
        drag: { kind: 'bc', model: 'G1', bands: [{ ballisticCoefficient: bc, minVelocity: 0 }] },
        aerodynamics: { liftSlope },
      },
      firearm: { sightHeight: 0.04, twist: 0.254, twistHand: 'right' },
    })
    const model = { model: 'modified-point-mass' as const }
    const ref = at1000(shot(2.5), model).velocity
    let worst = 0
    for (const [m] of dragTables.G1) {
      if (m < 1 || m > 2.6) continue
      const lift: DragTable = [
        [next(m), 2.5],
        [m + 0.5, 2.5],
      ]
      worst = Math.max(worst, Math.abs(at1000(shot(lift), model).velocity / ref - 1))
    }
    expect(worst).toBeLessThan(1e-9)
  })
})
