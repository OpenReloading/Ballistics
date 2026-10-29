import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  airDensity,
  dynamicStabilityFactor,
  gyroscopicStability,
  isStable,
  lbPerSqInToKgPerSqM,
  standardAtmosphere,
  type TrajectoryInput,
  trajectory,
} from '../src/index.ts'

const g = 9.80665
const deg = Math.PI / 180
const omega = 7.292115e-5
const flat = (cd: number) => ({
  kind: 'curve' as const,
  curve: [
    [0, cd],
    [10, cd],
  ] as const,
})
const off = { coriolis: false, spinDrift: false, jump: false, relativeTolerance: 1e-10 }

describe('flat-fire drop with a constant drag coefficient', () => {
  const air = standardAtmosphere(0)
  const mass = 0.0095
  const diameter = 0.00782
  const v0 = 830
  const cd = 0.4
  const k = (airDensity(air) * Math.PI * diameter ** 2 * cd) / (8 * mass)

  it('relates the decay constant to a G1 ballistic coefficient in lb/in2', () => {
    // K = 0.00068422 c_d / BC at 1.225 kg/m3, the form factor taken as 1
    expect(Math.abs((1.225 * Math.PI) / (8 * lbPerSqInToKgPerSqM) / 0.00068422 - 1)).toBeLessThan(
      1e-5,
    )
  })

  for (const angle of [0, 0.3]) {
    it(`matches the closed-form height and speed at a zero angle of ${angle} deg`, () => {
      const th = angle * deg
      const shot: TrajectoryInput = {
        projectile: { mass, diameter, drag: flat(cd) },
        muzzleVelocity: v0,
        firearm: { sightHeight: 0 },
        air,
        zero: { elevationAngle: th, windageAngle: 0 },
      }
      const ranges = [100, 200, 400, 600, 800, 1000]
      for (const q of trajectory(shot, ranges, off).points) {
        const x = q.range
        const y =
          x * Math.tan(th) -
          (g * (Math.exp(2 * k * x) - 2 * k * x - 1)) / (4 * v0 ** 2 * Math.cos(th) ** 2 * k ** 2)
        expect(Math.abs(q.height / y - 1)).toBeLessThan(1e-3)
        // the form takes all drag along the line of fire; at 1000 m the path is 2 deg steep and
        // the speed differs by 1.04e-3
        expect(Math.abs(q.velocity / (v0 * Math.exp(-k * x)) - 1)).toBeLessThan(1.5e-3)
      }
    })
  }
})

describe('range wind with a constant drag coefficient', () => {
  const air = standardAtmosphere(0)
  const mass = 0.0113
  const diameter = 0.00782
  const v0 = 850
  const cd = 0.3
  const k = (airDensity(air) * Math.PI * diameter ** 2 * cd) / (8 * mass)
  const run = (tailwind: number, ranges: number[]) =>
    trajectory(
      {
        projectile: { mass, diameter, drag: flat(cd) },
        muzzleVelocity: v0,
        firearm: { sightHeight: 0 },
        air,
        wind: [{ endDistance: Infinity, speed: tailwind, fromDirection: Math.PI }],
        zero: { elevationAngle: 0, windageAngle: 0 },
      },
      ranges,
      { ...off, gravity: 0 },
    ).points
  /** Time at which x = W t + ln(1 + k u0 t) / k reaches `range`, by Newton's method. */
  const timeAt = (w: number, range: number) => {
    const u0 = v0 - w
    let t = range / v0
    for (let n = 0; n < 50; n++) {
      const f = w * t + Math.log(1 + k * u0 * t) / k - range
      t -= f / (w + u0 / (1 + k * u0 * t))
    }
    return t
  }

  for (const w of [-10, 10, 50]) {
    it(`follows the closed form in a range wind of ${w} m/s`, () => {
      for (const q of run(w, [200, 600, 1000])) {
        const t = timeAt(w, q.range)
        const u0 = v0 - w
        expect(Math.abs(q.time / t - 1)).toBeLessThan(1e-8)
        expect(Math.abs(q.velocity / (w + u0 / (1 + k * u0 * t)) - 1)).toBeLessThan(1e-8)
      }
    })
  }

  it('shortens the flight time by W k t^2 to first order in a small range wind', () => {
    // d/dW of the closed form at W = 0: the ground distance grows by W t a / (1 + a), a = k v0 t,
    // and the speed there is v0 / (1 + a)
    const w = 0.5
    const still = run(0, [300, 600, 1000])
    run(w, [300, 600, 1000]).forEach((q, i) => {
      const t = nth(still, i).time
      expect(Math.abs((t - q.time) / (w * k * t ** 2) - 1)).toBeLessThan(2e-3)
    })
  })
})

describe('flat-fire spin drift of the modified point mass', () => {
  // 7.82 mm, 11.34 g, CD 0.30, CLa 2.6, CMa 3.0, Ix 7.2e-8 kg m2, 790 m/s, 254 mm twist
  const air = standardAtmosphere(0)
  const mass = 0.01134
  const d = 0.00782
  const v0 = 790
  const ix = 7.2e-8
  const cd = 0.3
  const cla = 2.6
  const cma = 3.0
  const area = (Math.PI / 4) * d ** 2
  const rho = airDensity(air)
  const k = (rho * area * cd) / (2 * mass)
  const p0 = (2 * Math.PI * v0) / 0.254
  const kk = (cla * ix * p0 * g) / (mass * d * cma)
  /** z(x) = K (e^(a x) - a x - 1) / (a^2 V0^3), a = 3k - lambda, spin decaying as e^(-lambda x). */
  const closed = (x: number, lambda: number) => {
    const a = 3 * k - lambda
    return (kk * (Math.exp(a * x) - a * x - 1)) / (a ** 2 * v0 ** 3)
  }
  const drift = (spinDamping: number) =>
    trajectory(
      {
        projectile: {
          mass,
          diameter: d,
          length: 0.0312,
          drag: flat(cd),
          aerodynamics: {
            liftSlope: cla,
            momentSlope: cma,
            spinDamping,
            axialInertia: ix,
            transverseInertia: 6.8e-7,
          },
        },
        muzzleVelocity: v0,
        firearm: { sightHeight: 0, twist: 0.254, twistHand: 'right' },
        air,
        zero: { elevationAngle: 0, windageAngle: 0 },
      },
      [100, 200, 300, 400],
      { ...off, model: 'modified-point-mass' },
    ).points

  it('matches the closed form with constant spin', () => {
    for (const q of drift(0))
      expect(Math.abs(q.windage / closed(q.range, 0) - 1)).toBeLessThan(1e-3)
  })

  it('matches the closed form with spin decaying as the speed', () => {
    // dp/dx = (rho A d^2 C_lp / (2 Ix)) p, so C_lp = -CD Ix / (m d^2) gives lambda = k
    const points = drift((-cd * ix) / (mass * d ** 2))
    for (const q of points) expect(Math.abs(q.windage / closed(q.range, k) - 1)).toBeLessThan(1e-3)
    // spin decay lowers the drift at 400 m by 11 percent, 0.0272 against 0.0306 m
    const far = nth(points, points.length - 1).windage
    expect(far).toBeCloseTo(0.0272, 4)
    expect(closed(400, 0)).toBeCloseTo(0.0306, 4)
  })
})

describe('earth rotation', () => {
  it('deflects a body dropped 10,000 ft at 45 degrees north by 8.57 ft to the east', () => {
    // vacuum free fall: east = Omega g cos(lat) t^3 / 3 with t = sqrt(2 h / g)
    const lat = 45 * deg
    const h = 10000 * 0.3048
    const shot: TrajectoryInput = {
      projectile: { mass: 0.01, diameter: 0.0078, drag: flat(0) },
      muzzleVelocity: 1e-3,
      firearm: { sightHeight: 0 },
      air: standardAtmosphere(0),
      // looking straight down, fired north: the right of the line of fire is east
      lookAngle: -Math.PI / 2,
      site: { latitude: lat, azimuth: 0 },
      zero: { elevationAngle: 0, windageAngle: 0 },
    }
    const q = nth(
      trajectory(shot, [h], {
        gravity: g,
        spinDrift: false,
        jump: false,
        relativeTolerance: 1e-11,
        absoluteTolerance: 1e-10,
      }).points,
      0,
    )
    const t = Math.sqrt((2 * h) / g)
    const east = (omega * g * Math.cos(lat) * t ** 3) / 3
    expect(Math.abs(q.windage / east - 1)).toBeLessThan(5e-3)
    expect(q.windage / 0.3048).toBeCloseTo(8.57, 2)
  })
})

describe('linear-theory stability', () => {
  it('gives the dynamic factor of the 168 gr launch coefficients and flags the slow mode', () => {
    // k_x^-2 = m d^2 / Ix = 9.224, k_y^-2 = m d^2 / Iy = 1.238
    const sd = dynamicStabilityFactor({
      liftSlope: 2.75,
      drag: 0.331,
      magnusMoment: -0.22,
      pitchDamping: -8.2,
      mass: 1,
      diameter: 1,
      axialInertia: 1 / 9.224,
      transverseInertia: 1 / 1.238,
    })
    // 0.1148 from the unrounded inertia ratios
    expect(sd).toBeCloseTo(0.1148, 3)
    expect(isStable(1.7035, sd)).toBe(false)
  })

  describe('yaw modes of the rifle-scale case', () => {
    // 11.34 g, 7.82 mm, Ix 7.2e-8, Iy 6.8e-7 kg m2, CMa 3.0, 1.225 kg/m3, 790 m/s, 254 mm twist
    const d = 0.00782
    const v = 790
    const i = {
      axialInertia: 7.2e-8,
      transverseInertia: 6.8e-7,
      spin: (2 * Math.PI * v) / 0.254,
      density: 1.225,
      speed: v,
      diameter: d,
      momentSlope: 3.0,
    }
    // turning rates in rad per calibre of travel
    const pp = (i.axialInertia / i.transverseInertia) * ((i.spin * d) / v)
    const m =
      (i.density * (Math.PI / 4) * d ** 2 * d ** 3 * i.momentSlope) / (2 * i.transverseInertia)
    const root = Math.sqrt(pp ** 2 - 4 * m)
    const fast = (pp + root) / 2
    const slow = (pp - root) / 2
    const hz = (rate: number) => (rate * v) / d / (2 * Math.PI)

    it('splits the spin into two modes whose sum is P and product is M', () => {
      expect(Math.abs((fast + slow) / pp - 1)).toBeLessThan(1e-12)
      expect(Math.abs((fast * slow) / m - 1)).toBeLessThan(1e-12)
      expect(gyroscopicStability(i)).toBeCloseTo(1.69, 2)
      expect(hz(fast)).toBeCloseTo(269.9, 1)
      expect(hz(slow)).toBeCloseTo(59.5, 1)
    })

    it('scales the spin for a target factor by the root of the factor ratio', () => {
      const known = gyroscopicStability(i)
      for (const s of [1, 1.5, 2.5]) {
        const spin = i.spin * Math.sqrt(s / known)
        expect(Math.abs(gyroscopicStability({ ...i, spin }) / s - 1)).toBeLessThan(1e-12)
      }
      // the factor is 1 at a twist of 330 mm
      expect((0.254 * Math.sqrt(known)) / 0.001).toBeCloseTo(330, -1)
    })
  })
})
