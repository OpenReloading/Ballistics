import { describe, expect, it } from 'vitest'
import { bisect } from '../src/bisect.ts'
import {
  chargeTooSmall,
  chargeTooSmallRatio,
  closedVessel,
  convectiveDefaults,
  type InteriorLoad,
  type InteriorOptions,
  type InteriorPoint,
  interior,
  leakFlowFactor,
} from '../src/index.ts'
import { m3Load } from './fixtures.ts'

const pref = 98066.5

/** Constant-surface vivacity load with eta = 1/rho and a Sebert gradient. */
function constantLoad(o: {
  volume: number
  area: number
  travel: number
  mass: number
  charge: number
  energy: number
  gamma: number
  density: number
  vivacity: number
  sebert: number
  ignitionPressure: number
}): InteriorLoad {
  return {
    chamber: {
      volume: o.volume,
      boreArea: o.area,
      boreDiameter: Math.sqrt((4 * o.area) / Math.PI),
    },
    barrel: { length: o.travel, twist: 0 },
    bullet: { mass: o.mass },
    charge: o.charge,
    propellant: {
      specificEnergy: o.energy,
      gamma: o.gamma,
      density: o.density,
      covolume: 1 / o.density,
      burn: {
        kind: 'vivacity',
        vivacity: o.vivacity,
        exponent: 1,
        referencePressure: pref,
        form: { kind: 'constant' },
      },
    },
    propellantTemperature: 294.15,
    ignitionPressure: o.ignitionPressure,
    startPressure: 0,
    gradient: { energy: o.sebert, breech: o.sebert },
  }
}

/** Closed-form solution of the constant-surface model in relative travel (Rheinmetall 1977, pp. 88 to 94). */
function closedForm(load: InteriorLoad) {
  const burn = load.propellant.burn
  if (burn.kind !== 'vivacity') throw new Error('vivacity form expected')
  const { volume, boreArea: a } = load.chamber
  const { specificEnergy: q, gamma: k, density } = load.propellant
  const mc = load.charge
  const ba = burn.vivacity
  const vStar = volume - mc / density
  const mStar = load.bullet.mass + (load.gradient?.energy ?? 0) * mc
  const theta = (xi: number) => 1 - (1 + xi) ** (-(k - 1) / 2)
  const xiOf = (th: number) => (1 - th) ** (-2 / (k - 1)) - 1
  const c1 = (2 * ba * mc * q) / (pref * a)
  const thetaB = (pref * a) ** 2 / (2 * ba ** 2 * mStar * mc * q)
  const pressure = (xi: number) =>
    ((2 * (k - 1) * mStar * (ba * mc * q) ** 2) / (vStar * pref ** 2 * a ** 2)) *
    ((theta(xi) - theta(xi) ** 2) / (1 + xi))
  const velocity = (xi: number) =>
    theta(xi) <= thetaB
      ? c1 * theta(xi)
      : Math.sqrt(((2 * mc * q) / mStar) * (1 - 1 / ((1 - thetaB) * (1 + xi) ** (k - 1))))
  const thetaM = (k - 1) / (2 * k)
  return {
    xiOf: (x: number) => (a * x) / vStar,
    xiE: (a * load.barrel.length) / vStar,
    thetaB,
    burnoutTravel: (xiOf(thetaB) * vStar) / a,
    peakTravel: (xiOf(thetaM) * vStar) / a,
    peak: pressure(xiOf(thetaM)),
    pressure,
    velocity,
    muzzleVelocity: velocity((a * load.barrel.length) / vStar),
    z: (v: number) => ((ba * mStar) / (pref * a)) * v,
  }
}

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b)

/** Synthetic rifle case, peak before burnout and burnout in the barrel. */
const rifle = (ignitionPressure = 1e3) =>
  constantLoad({
    volume: 3.4e-6,
    area: 3.75e-5,
    travel: 0.6,
    mass: 0.0095,
    charge: 0.0028,
    energy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    vivacity: 0.56,
    sebert: 0.5,
    ignitionPressure,
  })

describe('closed vessel', () => {
  const withCovolume = (eta: number) => ({
    ...rifle(1e6),
    propellant: { ...rifle().propellant, covolume: eta },
  })

  it.each([0, 1 / 1600, 1e-3])('final pressure (k-1) m_c Q / (V_c - eta m_c), eta = %s', (eta) => {
    const r = closedVessel(withCovolume(eta))
    if (!r.valid) throw new Error(r.reason)
    const want = (0.23 * 0.0028 * 3.9e6) / (3.4e-6 - eta * 0.0028)
    expect(rel(r.finalPressure, want)).toBeLessThan(1e-12)
  })

  it.each([0, 1e-3])('burn time against the closed form, eta = %s', (eta) => {
    const r = closedVessel(withCovolume(eta))
    if (!r.valid) throw new Error(r.reason)
    const a = 0.23 * 0.0028 * 3.9e6
    const b = 3.4e-6 - 0.0028 / 1600
    const c = 0.0028 * (1 / 1600 - eta)
    const z0 = (1e6 * b) / (a - 1e6 * c)
    const t = (pref / (0.56 * a)) * (b * Math.log(1 / z0) + c * (1 - z0))
    expect(rel(r.burnoutTime, t)).toBeLessThan(1e-8)
  })

  // with eta = 1/rho, p = a z / b, so dz/dt = B_a tau_T phi(z) (a z / (b p_ref))^n
  const a = 0.23 * 0.0028 * 3.9e6
  const b = 3.4e-6 - 0.0028 / 1600
  const z0 = (1e6 * b) / a
  const vessel = (burn: InteriorLoad['propellant']['burn'], temperature = 294.15): InteriorLoad => {
    const load = withCovolume(1 / 1600)
    return {
      ...load,
      propellant: {
        ...load.propellant,
        burn,
        temperatureSensitivity: { reference: 294.15, cold: 1e-3, hot: 2e-3 },
      },
      propellantTemperature: temperature,
    }
  }
  const constant = (exponent: number) =>
    ({
      kind: 'vivacity',
      vivacity: 0.56,
      exponent,
      referencePressure: pref,
      form: { kind: 'constant' },
    }) as const

  it('burn time with pressure exponent n = 0.8', () => {
    const r = closedVessel(vessel(constant(0.8)))
    if (!r.valid) throw new Error(r.reason)
    const t = ((b * pref) / a) ** 0.8 * ((1 - z0 ** 0.2) / (0.2 * 0.56))
    expect(rel(r.burnoutTime, t)).toBeLessThan(1e-8)
  })

  it('burn time scales as 1/tau_T with the propellant temperature', () => {
    const ref = closedVessel(vessel(constant(1)))
    const hot = closedVessel(vessel(constant(1), 314.15))
    const cold = closedVessel(vessel(constant(1), 274.15))
    if (!ref.valid || !hot.valid || !cold.valid) throw new Error('invalid')
    expect(rel(hot.burnoutTime * Math.exp(2e-3 * 20), ref.burnoutTime)).toBeLessThan(1e-9)
    expect(rel(cold.burnoutTime * Math.exp(-1e-3 * 20), ref.burnoutTime)).toBeLessThan(1e-9)
  })

  it('burn time of the two-stage form function', () => {
    const [ba, am, m, q, z1] = [0.56, 1.2, 0.4, 0.3, 0.45]
    const r = closedVessel(
      vessel({
        kind: 'vivacity',
        vivacity: ba,
        exponent: 1,
        referencePressure: pref,
        form: { kind: 'twoStage', a: am, m, q, z1 },
      }),
      // phi has an infinite slope at z = 1; the default tolerances leave 5e-7 in the burn time
      { relativeTolerance: 1e-11, absoluteTolerance: 1e-13 },
    )
    if (!r.valid) throw new Error(r.reason)
    // t = b p_ref / (B_a a) * integral of dz / (z phi(z)) from z0 to 1
    // stage 1: Simpson in ln z
    const steps = 4000
    const lo = Math.log(z0)
    const hh = (Math.log(z1) - lo) / steps
    let stage1 = 0
    for (let i = 0; i <= steps; i++) {
      const weight = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2
      stage1 += weight / (1 + am * Math.exp(lo + i * hh)) ** m
    }
    stage1 *= hh / 3
    // stage 2: with u = (1 - z)/(1 - z1), 1/z expands as a geometric series in (1 - z1) u
    let stage2 = 0
    for (let j = 0; j < 200; j++) stage2 += (1 - z1) ** (j + 1) / (j + 1 - q)
    stage2 /= (1 + am * z1) ** m
    const t = ((b * pref) / (ba * a)) * (stage1 + stage2)
    expect(rel(r.burnoutTime, t)).toBeLessThan(1e-7)
  })

  it.each([
    // the third stage runs in a transformed variable, so r near 1 reaches z = 1 at the series time
    [1.2, 0.4, 1.5, 0.45, 0.85, 0.3, {}, 1e-8],
    [1.2, 0.4, 1.5, 0.45, 0.85, 0.9, {}, 1e-8],
    [1.2, 0.4, 1.5, 0.45, 0.85, 0.99, {}, 1e-8],
    [1.2, 0.4, 0.3, 0.45, 0.8, 0, {}, 1e-10],
  ] as const)(
    'burn time of the three-stage form a %s, m %s, q %s, z1 %s, z2 %s, r %s',
    (am, m, q, z1, z2, r, config, limit) => {
      const ba = 0.56
      const run = closedVessel(
        vessel({
          kind: 'vivacity',
          vivacity: ba,
          exponent: 1,
          referencePressure: pref,
          form: { kind: 'threeStage', a: am, m, q, z1, z2, r },
        }),
        config,
      )
      if (!run.valid) throw new Error(run.reason)
      // stage 1: Simpson in ln z
      const steps = 4000
      const lo = Math.log(z0)
      const hh = (Math.log(z1) - lo) / steps
      let stage1 = 0
      for (let i = 0; i <= steps; i++) {
        const weight = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2
        stage1 += weight / (1 + am * Math.exp(lo + i * hh)) ** m
      }
      stage1 *= hh / 3
      // stages 2 and 3: 1/z as a geometric series in (1 - z_k) u, u = (1 - z)/(1 - z_k), integrated term by term
      const phi1 = (1 + am * z1) ** m
      const u2 = (1 - z2) / (1 - z1)
      const phi2 = phi1 * u2 ** q
      let stage2 = 0
      let stage3 = 0
      for (let j = 0; j < 200; j++) {
        stage2 += ((1 - z1) ** (j + 1) * (1 - u2 ** (j + 1 - q))) / (j + 1 - q)
        stage3 += (1 - z2) ** (j + 1) / (j + 1 - r)
      }
      const t = ((b * pref) / (ba * a)) * (stage1 + stage2 / phi1 + stage3 / phi2)
      expect(rel(run.burnoutTime, t)).toBeLessThan(limit)
    },
  )
})

describe('constant-surface closed form', () => {
  const load = rifle(1e2)
  const cf = closedForm(load)
  const r = interior(load)
  if (!r.valid) throw new Error(r.reason)

  it('peak pressure, its travel, burnout travel and muzzle velocity', () => {
    expect(cf.thetaB).toBeGreaterThan(0.23 / 2.46)
    expect(r.maxMeanPressure).toBe(r.peakBreechPressure)
    expect(rel(r.peakBreechPressure, cf.peak)).toBeLessThan(1e-5)
    expect(rel(r.maxPressureTravel, cf.peakTravel)).toBeLessThan(1e-5)
    expect(rel(r.burnout?.travel ?? 0, cf.burnoutTravel)).toBeLessThan(1e-5)
    expect(rel(r.muzzleVelocity, cf.muzzleVelocity)).toBeLessThan(1e-5)
    expect(r.points.at(-1)?.travel).toBeCloseTo(0.6, 12)
  })

  it('velocity and pressure along the barrel, offset by the ignition gas near the start', () => {
    const burnout = r.burnout?.travel ?? 0
    for (const pt of r.points) {
      if (pt.burntFraction < 0.1) continue
      const xi = cf.xiOf(pt.travel)
      // the ignition gas offsets the solution by a multiple of z0/z (z0 = 6.6e-8 here)
      const tol = 2e-6 / pt.burntFraction
      expect(rel(pt.velocity, cf.velocity(xi))).toBeLessThan(tol)
      if (pt.travel <= burnout) expect(rel(pt.meanPressure, cf.pressure(xi))).toBeLessThan(tol)
    }
  })
})

describe('convergence', () => {
  it('deviation from the closed form falls with the ignition pressure', () => {
    const cf = closedForm(rifle())
    const dev = [1e5, 1e4, 1e3, 1e2].map((pi) => {
      const r = interior(rifle(pi))
      if (!r.valid) throw new Error(r.reason)
      return Math.max(rel(r.peakBreechPressure, cf.peak), rel(r.muzzleVelocity, cf.muzzleVelocity))
    })
    for (let i = 1; i < dev.length; i++) expect(dev[i]).toBeLessThan(dev[i - 1] / 5)
  })

  it('halving the tolerances and the output step changes the results below 1e-7', () => {
    // tenPercentPressureTime is interpolated linearly between output points and is left out
    const a = interior(rifle(1e5))
    const b = interior(rifle(1e5), {
      relativeTolerance: 5e-10,
      absoluteTolerance: 5e-12,
      outputStep: 1e-6,
    })
    if (!a.valid || !b.valid) throw new Error('invalid')
    for (const key of ['peakBreechPressure', 'muzzleVelocity', 'barrelTime'] as const)
      expect(rel(a[key], b[key])).toBeLessThan(1e-7)
  })
})

/** Load with every part switched on: Lagrange, rotation, resistance, heat, seven-perforated grain, shot start. */
const full = (heat = true): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 7e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'geometric',
      coefficient: 7e-9,
      exponent: 0.9,
      grain: { shape: 'sevenPerf', diameter: 1.25e-3, perforationDiameter: 1.5e-4, length: 2e-3 },
    },
    temperatureSensitivity: { reference: 294.15, cold: 1e-3, hot: 2e-3 },
  },
  propellantTemperature: 300,
  ignitionPressure: 5e6,
  startPressure: 25e6,
  resistance: {
    friction: 4e6,
    engraving: [
      { travel: 0.001, pressure: 0 },
      { travel: 0.003, pressure: 50e6 },
      { travel: 0.008, pressure: 10e6 },
    ],
  },
  heat: heat
    ? {
        model: 'convective',
        flameTemperature: 2900,
        wallTemperature: 300,
        viscosity: 8e-5,
        prandtl: 0.7,
      }
    : { model: 'none' },
})

type InteriorPoints = Extract<ReturnType<typeof interior>, { valid: true }>

/** Integral of `flux` over the curve by the trapezoidal rule in time. */
function trapezoid(
  points: InteriorPoints['points'],
  flux: (p: InteriorPoints['points'][number]) => number,
) {
  let sum = 0
  for (let i = 1; i < points.length; i++) {
    const [p0, p1] = [points[i - 1], points[i]]
    sum += ((p1.time - p0.time) * (flux(p0) + flux(p1))) / 2
  }
  return sum
}

/** Before the shot starts the gas is at the flame temperature of 2900 K. */
function expectFlameTemperatureWhileHeld(r: InteriorPoints) {
  for (const p of r.points)
    if (p.time < r.shotStartTime) expect(rel(p.gasTemperature ?? 0, 2900)).toBeLessThan(1e-12)
}

describe('energy and consistency checks', () => {
  // consistency: the gas energy is defined by the same expression as the pressure, so the sum holds by construction
  it('energy terms add up to m_c Q z; resistance work equals its integral over travel', () => {
    const r = interior(full())
    if (!r.valid) throw new Error(r.reason)
    const e = r.energy
    const sum = e.gas + e.translation + e.rotation + e.gasKinetic + e.resistance + e.heat
    expect(rel(sum, 0.0028 * 3.9e6 * r.muzzleBurntFraction)).toBeLessThan(1e-12)
    expect(e.heat).toBeGreaterThan(0)
    expect(e.rotation).toBeGreaterThan(0)
    // A (p_f x_e + area under the engraving profile)
    expect(rel(e.resistance, 3.75e-5 * (4e6 * 0.6 + 0.002 * 25e6 + 0.005 * 30e6))).toBeLessThan(
      1e-6,
    )
  })

  it('p V_f^k is constant after burnout without heat loss (Noble-Abel isentrope)', () => {
    const r = interior(full(false))
    if (!r.valid || !r.burnout) throw new Error('burnout expected')
    const b = r.burnout
    const after = r.points.filter((p) => p.time >= b.time)
    expect(after.length).toBeGreaterThan(100)
    const invariant = after.map(
      (p) => p.meanPressure * (3.4e-6 + 3.75e-5 * p.travel - 1e-3 * 0.0028) ** 1.23,
    )
    for (const v of invariant) expect(rel(v, invariant[0])).toBeLessThan(1e-12)
  })

  // consistency: the ratios follow from the gradient formulas
  it('Lagrange pressure ratios without resistance', () => {
    const load: InteriorLoad = {
      ...rifle(1e5),
      barrel: { length: 0.6, twist: 0.254 },
      gradient: undefined,
    }
    const r = interior(load)
    if (!r.valid) throw new Error(r.reason)
    const d = load.chamber.boreDiameter
    const mpr = 0.0095 * (1 + ((2 * Math.PI * d) / (2 * Math.SQRT2 * 0.254)) ** 2)
    for (const p of r.points.slice(1)) {
      expect(rel(p.breechPressure / p.basePressure, 1 + 0.0028 / (2 * mpr))).toBeLessThan(1e-12)
      expect(rel(p.meanPressure / p.basePressure, 1 + 0.0028 / (3 * mpr))).toBeLessThan(1e-12)
    }
  })

  const fullMpr = 0.0095 * (1 + ((2 * Math.PI * 7e-3) / (2 * Math.SQRT2 * 0.254)) ** 2)
  const engraving = (x: number) => {
    const pr = [
      [0.001, 0],
      [0.003, 50e6],
      [0.008, 10e6],
    ]
    for (let i = 1; i < pr.length; i++)
      if (x >= pr[i - 1][0] && x <= pr[i][0])
        return (
          pr[i - 1][1] +
          ((x - pr[i - 1][0]) * (pr[i][1] - pr[i - 1][1])) / (pr[i][0] - pr[i - 1][0])
        )
    return 0
  }

  it('base and breech pressure with bore resistance', () => {
    const r = interior(full())
    if (!r.valid) throw new Error(r.reason)
    const area = 3.75e-5
    for (const p of r.points) {
      if (p.time <= r.shotStartTime) continue
      const fr = area * (4e6 + engraving(p.travel))
      // base: m_p' a = A p_b - F_r, with m_c a / A = (p_mean - p_b) / delta
      const accel = (area * (p.meanPressure - p.basePressure)) / ((1 / 3) * 0.0028)
      expect(rel(area * p.basePressure - fr, fullMpr * accel)).toBeLessThan(1e-9)
      expect(
        rel(p.breechPressure - p.basePressure, 1.5 * (p.meanPressure - p.basePressure)),
      ).toBeLessThan(1e-9)
    }
  })

  it('heat loss equals the quadrature of the convective flux over the curve', () => {
    const [area, d, vc, mc, k] = [3.75e-5, 7e-3, 3.4e-6, 0.0028, 1.23]
    const gasR = ((k - 1) * 3.9e6) / 2900
    const cp = (k * gasR) / (k - 1)
    const [mu, pr] = [8e-5, 0.7]
    // with leakage the gas mass m_c z - m_l enters T and the gas density
    const leakage = {
      area: [
        { travel: 0, area: 2e-7 },
        { travel: 0.6, area: 2e-7 },
      ],
    }
    for (const [factor, leak] of [
      [1, undefined],
      [0.5, undefined],
      [1, leakage],
    ] as const) {
      const load = full()
      const r = interior({
        ...load,
        heat: { ...load.heat, factor } as InteriorLoad['heat'],
        leakage: leak,
      })
      if (!r.valid) throw new Error(r.reason)
      const flux = (p: (typeof r.points)[number]) => {
        const t = p.gasTemperature ?? 0
        const gas = mc * p.burntFraction - (p.leakedMass ?? 0)
        const free = vc + area * p.travel - (mc / 1600) * (1 - p.burntFraction) - 1e-3 * gas
        expect(rel(t, (p.meanPressure * free) / (gas * gasR))).toBeLessThan(1e-12)
        if (!(p.velocity > 0)) return 0
        const rho = gas / (vc + area * p.travel - (mc / 1600) * (1 - p.burntFraction))
        const re = (rho * (p.velocity / 2) * d) / mu
        const h = ((0.023 * ((mu * cp) / pr)) / d) * re ** 0.8 * pr ** (t > 300 ? 0.3 : 0.4)
        return factor * h * Math.PI * d * (p.travel + vc / area) * (t - 300)
      }
      expect(rel(trapezoid(r.points, flux), r.energy.heat)).toBeLessThan(1e-6)
      // while held without leakage, no heat is lost and the gas is at the flame temperature
      if (!leak) expectFlameTemperatureWhileHeld(r)
    }
  })
})

describe('event location', () => {
  const r = interior(full())
  if (!r.valid) throw new Error(r.reason)

  it('stores points at shot start, profile points, burnout and the muzzle', () => {
    const start = r.points.find((p) => p.time === r.shotStartTime)
    expect(rel(start?.meanPressure ?? 0, 25e6)).toBeLessThan(1e-9)
    // the root tolerance of rk45 is 1e-12 in scaled time
    for (const x of [0.001, 0.003, 0.008])
      expect(r.points.some((p) => Math.abs(p.travel - x) < 1e-9)).toBe(true)
    expect(r.burnout).not.toBeNull()
    expect(r.points.at(-1)?.travel).toBeCloseTo(0.6, 12)
    for (let i = 1; i < r.points.length; i++)
      expect(r.points[i].time).toBeGreaterThanOrEqual(r.points[i - 1].time)
  })

  it('locates the pressure peak and the 10 % time between output points', () => {
    // dense sampling with tight tolerances; the limits cover the global error of the default tolerances
    const fine = interior(full(), {
      outputStep: 2e-8,
      relativeTolerance: 1e-11,
      absoluteTolerance: 1e-13,
    })
    if (!fine.valid) throw new Error(fine.reason)
    const sampled = Math.max(...fine.points.map((p) => p.breechPressure))
    expect(rel(r.peakBreechPressure, sampled)).toBeLessThan(1e-6)
    expect(rel(r.tenPercentPressureTime, fine.tenPercentPressureTime)).toBeLessThan(1e-4)
    expect(r.tenPercentPressureTime).toBeGreaterThan(r.shotStartTime)
    expect(r.tenPercentPressureTime).toBeLessThan(r.maxPressureTime)
  })

  it('an engraving profile that ends at the muzzle travel still stops at the muzzle', () => {
    const load = full()
    const r2 = interior({
      ...load,
      resistance: {
        friction: 4e6,
        engraving: [
          { travel: 0.001, pressure: 0 },
          { travel: 0.6, pressure: 10e6 },
        ],
      },
    })
    if (!r2.valid) throw new Error(r2.reason)
    expect(r2.points.at(-1)?.travel).toBeCloseTo(0.6, 12)
  })

  it('starts from the ignition pressure; shot start waits for the friction force', () => {
    expect(rel(r.points[0].meanPressure, 5e6)).toBeLessThan(1e-9)
    // friction 4 MPa above the start pressure: motion starts at A p = F_r(0)
    const slow = interior({ ...full(), ignitionPressure: 1e6, startPressure: 2e6 })
    if (!slow.valid) throw new Error(slow.reason)
    const start = slow.points.find((p) => p.time === slow.shotStartTime)
    expect(rel(start?.meanPressure ?? 0, 4e6)).toBeLessThan(1e-9)
  })

  it('one stage (z1 = 1) with a = 0 runs as the constant form', () => {
    const load = rifle(1e5)
    const single: InteriorLoad = {
      ...load,
      propellant: {
        ...load.propellant,
        burn: {
          kind: 'vivacity',
          vivacity: 0.56,
          exponent: 1,
          referencePressure: pref,
          form: { kind: 'twoStage', a: 0, m: 1, q: 1, z1: 1 },
        },
      },
    }
    expect(interior(single)).toEqual(interior(load))
    expect(closedVessel(single)).toEqual(closedVessel(load))
  })

  const withForm = (
    form: Extract<InteriorLoad['propellant']['burn'], { kind: 'vivacity' }>['form'],
    config: Partial<InteriorOptions> = {},
  ) => {
    const load = rifle(1e5)
    return interior(
      {
        ...load,
        propellant: {
          ...load.propellant,
          burn: { kind: 'vivacity', vivacity: 0.56, exponent: 1, referencePressure: pref, form },
        },
      },
      config,
    )
  }

  it.each([0.6, 0.8, 0.95])('three stages with r = q and z2 = %s run as two stages', (z2) => {
    const two = withForm({ kind: 'twoStage', a: 1.2, m: 0.4, q: 0.3, z1: 0.45 })
    const three = withForm({ kind: 'threeStage', a: 1.2, m: 0.4, q: 0.3, z1: 0.45, z2, r: 0.3 })
    if (!two.valid || !three.valid) throw new Error('invalid')
    expect(rel(three.peakBreechPressure, two.peakBreechPressure)).toBeLessThan(1e-9)
    expect(rel(three.muzzleVelocity, two.muzzleVelocity)).toBeLessThan(1e-9)
    expect(rel(three.barrelTime, two.barrelTime)).toBeLessThan(1e-9)
    // two stages reach z = 1 along (1 - z)^q, where phi has an infinite slope, so their burnout
    // event needs tight tolerances; the transformed third stage does not
    const tight = { relativeTolerance: 1e-12, absoluteTolerance: 1e-14 }
    const twoTight = withForm({ kind: 'twoStage', a: 1.2, m: 0.4, q: 0.3, z1: 0.45 }, tight)
    if (!twoTight.valid || !twoTight.burnout || !three.burnout) throw new Error('no burnout')
    expect(rel(three.burnout.travel, twoTight.burnout.travel)).toBeLessThan(1e-7)
  })

  const staged: [string, Parameters<typeof withForm>[0], number[]][] = [
    ['two-stage', { kind: 'twoStage', a: 1.2, m: 0.4, q: 0.3, z1: 0.45 }, [0.45]],
    [
      'three-stage',
      { kind: 'threeStage', a: 1.2, m: 0.4, q: 0.3, z1: 0.45, z2: 0.8, r: 0.3 },
      [0.45, 0.8],
    ],
  ]
  it.each(staged)('stores a point at every %s breakpoint', (_, form, breakpoints) => {
    const r = withForm(form)
    if (!r.valid) throw new Error(r.reason)
    // an event state comes from a step to the root found on the dense output, so it lies within the dense-output error
    for (const z of breakpoints)
      expect(r.points.some((p) => Math.abs(p.burntFraction - z) < 1e-7)).toBe(true)
  })
})

describe('failure reasons', () => {
  const base = full()
  it.each([
    ['chamberVolume', { ...base, charge: 0.006 }],
    ['chamberVolume', { ...base, propellant: { ...base.propellant, covolume: 2e-3 } }],
    ['noShotStart', { ...base, startPressure: 1e10 }],
    [
      'stuck',
      {
        ...base,
        resistance: {
          engraving: [
            { travel: 0.1, pressure: 0 },
            { travel: 0.11, pressure: 3e9 },
            { travel: 0.6, pressure: 3e9 },
          ],
        },
      },
    ],
  ] as [string, InteriorLoad][])('%s', (reason, load) => {
    expect(interior(load)).toEqual({ valid: false, reason })
  })

  it.each([
    ['bullet.mass', { ...base, bullet: { mass: -1 } }],
    ['propellant.gamma', { ...base, propellant: { ...base.propellant, gamma: 1 } }],
    ['propellantTemperature', { ...base, propellantTemperature: Number.NaN }],
    ['ignitionPressure', { ...base, ignitionPressure: 0 }],
    ['ignitionPressure', { ...base, ignitionPressure: 1e12 }],
    [
      'resistance.engraving',
      {
        ...base,
        resistance: {
          engraving: [
            { travel: 0.01, pressure: 0 },
            { travel: 0.01, pressure: 1e6 },
          ],
        },
      },
    ],
    [
      'propellant.burn.grain.perforationDiameter',
      {
        ...base,
        propellant: {
          ...base.propellant,
          burn: {
            kind: 'geometric',
            coefficient: 1e-9,
            exponent: 1,
            grain: { shape: 'sevenPerf', diameter: 1e-3, perforationDiameter: 4e-4, length: 2e-3 },
          },
        },
      },
    ],
    [
      'heat',
      {
        ...base,
        heat: {
          model: 'convective',
          flameTemperature: 0,
          wallTemperature: 300,
          viscosity: 8e-5,
          prandtl: 0.7,
        },
      },
    ],
  ] as [string, InteriorLoad][])('input: %s', (field, load) => {
    expect(interior(load)).toEqual({ valid: false, reason: 'input', field })
  })

  it.each(['outputStep', 'maxTime', 'maxSteps', 'relativeTolerance', 'absoluteTolerance'])(
    'input: option %s not positive and finite',
    (field) => {
      for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
        expect(interior(base, { [field]: v })).toEqual({ valid: false, reason: 'input', field })
    },
  )

  it('maxTime and integration', () => {
    expect(interior(base, { maxTime: 1e-5 })).toEqual({ valid: false, reason: 'maxTime' })
    expect(interior(base, { maxSteps: 10 })).toEqual({ valid: false, reason: 'integration' })
    expect(closedVessel(base, { maxTime: 1e-6 })).toEqual({ valid: false, reason: 'maxTime' })
  })
})

describe('gas leakage (apps/docs/docs/models/interior-leakage-heat.md)', () => {
  it.each([
    ['rifle', rifle(1e5)],
    ['full', full()],
  ])('a zero leak area gives the %s result of no leakage, up to the error norm', (_, load) => {
    const a = interior(load)
    const b = interior({ ...load, leakage: { area: [{ travel: 0, area: 0 }] } })
    if (!a.valid || !b.valid) throw new Error('invalid')
    for (const key of ['muzzleVelocity', 'peakBreechPressure', 'barrelTime'] as const)
      expect(rel(b[key], a[key])).toBeLessThan(1e-6)
    expect(a.energy.leakage).toBe(0)
    expect(a.points.every((p) => !('leakedMass' in p))).toBe(true)
  })

  /** full() with a constant leak area from travel 0 to the muzzle. */
  const leaky = (area: number, extra = {}): InteriorLoad => ({
    ...full(),
    leakage: {
      area: [
        { travel: 0, area },
        { travel: 0.6, area },
      ],
      ...extra,
    },
  })

  it('a leak beyond the muzzle loses nothing and changes the results only through the error norm', () => {
    const a = interior(full())
    const b = interior({ ...full(), leakage: { area: [{ travel: 1, area: 1e-6 }] } })
    if (!a.valid || !b.valid) throw new Error('invalid')
    expect(b.energy.leakage).toBe(0)
    for (const p of b.points) expect(p.leakedMass).toBe(0)
    expect(rel(b.peakBreechPressure, a.peakBreechPressure)).toBeLessThan(1e-6)
    expect(rel(b.muzzleVelocity, a.muzzleVelocity)).toBeLessThan(1e-6)
  })

  it('flow factor: choked plateau, maximum of the subsonic branch at the critical ratio', () => {
    const subsonic = (k: number, r: number) =>
      Math.sqrt(((2 * k) / (k - 1)) * (r ** (2 / k) - r ** ((k + 1) / k)))
    for (const k of [1.23, 1.25]) {
      const psi = leakFlowFactor(k, 0)
      const critical = (2 / (k + 1)) ** (k / (k - 1))
      expect(rel(psi, 0.66)).toBeLessThan(0.01)
      expect(leakFlowFactor(k, critical)).toBe(psi)
      expect(rel(subsonic(k, critical), psi)).toBeLessThan(1e-12)
      expect(subsonic(k, critical - 1e-3)).toBeLessThan(psi)
      expect(leakFlowFactor(k, critical - 1e-3)).toBe(psi)
      expect(leakFlowFactor(k, critical + 1e-3)).toBeLessThan(psi)
      expect(leakFlowFactor(k, 1)).toBe(0)
      expect(leakFlowFactor(k, 1.5)).toBe(0)
      // the subsonic branch of the code meets psi at r* and equals the formula above it
      expect(rel(leakFlowFactor(k, critical * (1 + 1e-9)), psi)).toBeLessThan(1e-8)
      for (const r of [0.6, 0.8, 0.99])
        expect(rel(leakFlowFactor(k, r), subsonic(k, r))).toBeLessThan(1e-12)
    }
  })

  it('leaked mass and enthalpy equal the quadrature of the orifice flow over the curve', () => {
    const [vc, area, mc, k, eta, solid] = [3.4e-6, 3.75e-5, 0.0028, 1.23, 1e-3, 0.0028 / 1600]
    const constant = { area: leaky(2e-7).leakage?.area ?? [] }
    const worn = {
      area: [
        { travel: 0, area: 2e-7 },
        { travel: 0.008, area: 2e-7 },
        { travel: 0.012, area: 0 },
      ],
    }
    const cases: NonNullable<InteriorLoad['leakage']>[] = [
      worn,
      constant,
      { ...constant, backPressure: 3e6 },
    ]
    for (const leakage of cases) {
      // trapezoid error in the worn case: 3.1e-7 at outputStep 1e-7 s, 8.3e-5 at 2e-6 s
      const r = interior({ ...full(), leakage }, { outputStep: 1e-7 })
      if (!r.valid) throw new Error(r.reason)
      // leak-area kinks are events, like engraving points
      if (leakage === worn)
        expect(r.points.some((p) => Math.abs(p.travel - 0.012) < 1e-9)).toBe(true)
      const pa = leakage.backPressure ?? 101325
      const pts = leakage.area
      const leakArea = (x: number) => {
        for (let i = 1; i < pts.length; i++)
          if (x >= pts[i - 1].travel && x <= pts[i].travel)
            return (
              pts[i - 1].area +
              ((x - pts[i - 1].travel) * (pts[i].area - pts[i - 1].area)) /
                (pts[i].travel - pts[i - 1].travel)
            )
        return 0
      }
      /** Mass and enthalpy flow; `held` takes the mean pressure as the base pressure. */
      const flow = (p: InteriorPoint, held: boolean) => {
        const pb = held ? p.meanPressure : p.basePressure
        const gas = mc * p.burntFraction - (p.leakedMass ?? 0)
        const free = vc + area * p.travel - solid * (1 - p.burntFraction) - eta * gas
        const rt = (p.meanPressure * free) / gas
        const m = (leakArea(p.travel) * pb * leakFlowFactor(k, pa / pb)) / Math.sqrt(rt)
        return [m, m * ((k * rt) / (k - 1) + eta * p.meanPressure)]
      }
      let mass = 0
      let enthalpy = 0
      for (let i = 1; i < r.points.length; i++) {
        const [p0, p1] = [r.points[i - 1], r.points[i]]
        // the point at shot start holds the moving state; the interval before it ends held
        const a = flow(p0, p0.time < r.shotStartTime)
        const b = flow(p1, p1.time <= r.shotStartTime)
        mass += ((p1.time - p0.time) * (a[0] + b[0])) / 2
        enthalpy += ((p1.time - p0.time) * (a[1] + b[1])) / 2
      }
      expect(rel(mass, r.points.at(-1)?.leakedMass ?? 0)).toBeLessThan(1e-6)
      expect(rel(enthalpy, r.energy.leakage)).toBeLessThan(1e-6)
      // consistency: the gas energy is defined by the same expression as the pressure
      const e = r.energy
      const sum =
        e.gas + e.translation + e.rotation + e.gasKinetic + e.resistance + e.heat + e.leakage
      expect(rel(sum, 0.0028 * 3.9e6 * r.muzzleBurntFraction)).toBeLessThan(1e-12)
    }
  })

  it('p (V/m_g - eta)^k is constant after burnout with leakage and without heat loss', () => {
    const r = interior({ ...leaky(2e-7), heat: { model: 'none' } })
    if (!r.valid || !r.burnout) throw new Error('burnout expected')
    const b = r.burnout
    const after = r.points.filter((p) => p.time >= b.time)
    expect(after.length).toBeGreaterThan(100)
    expect(after.at(-1)?.leakedMass ?? 0).toBeGreaterThan(1.5 * (after[0].leakedMass ?? 0))
    const invariant = after.map(
      (p) =>
        p.meanPressure *
        ((3.4e-6 + 3.75e-5 * p.travel) / (0.0028 - (p.leakedMass ?? 0)) - 1e-3) ** 1.23,
    )
    for (const v of invariant) expect(rel(v, invariant[0])).toBeLessThan(1e-12)
  })

  it('choked blowdown of a fixed vessel follows the isentropic closed form', () => {
    // eta = 0, burnt to z0 = 1 - 1e-9, the rest burns at a constant rate until 1 ms
    const [vc, mc, q, k, rho, al] = [3.4e-6, 0.0028, 3.9e6, 1.23, 1600, 3e-6]
    const z0 = 1 - 1e-9
    const load: InteriorLoad = {
      ...rifle(),
      propellant: {
        specificEnergy: q,
        gamma: k,
        density: rho,
        covolume: 0,
        burn: {
          kind: 'vivacity',
          vivacity: (1 - z0) / 1e-3,
          exponent: 0,
          referencePressure: pref,
          form: { kind: 'constant' },
        },
      },
      ignitionPressure: ((k - 1) * mc * q * z0) / (vc - (mc / rho) * (1 - z0)),
      leakage: { area: [{ travel: 0, area: al }], backPressure: 0 },
    }
    const r = closedVessel(load)
    if (!r.valid) throw new Error(r.reason)
    const first = r.points[0]
    const [p0, m0] = [first.meanPressure, mc * first.burntFraction]
    const volume = vc - (mc / rho) * (1 - first.burntFraction)
    // m/m0 = (1 + (k-1)/2 C_d A psi sqrt(R T0) t / V)^(-2/(k-1)), p/p0 = (m/m0)^k
    const c = (((k - 1) / 2) * al * leakFlowFactor(k, 0) * Math.sqrt((p0 * volume) / m0)) / volume
    expect(r.finalPressure / p0).toBeLessThan(0.6)
    for (const p of r.points) {
      const u = (1 + c * p.time) ** (-2 / (k - 1))
      expect(rel(p.meanPressure, p0 * u ** k)).toBeLessThan(1e-8)
      expect(Math.abs((p.leakedMass ?? 0) - m0 * (1 - u))).toBeLessThan(1e-8 * m0)
    }
  })

  it('a larger leak area lowers peak pressure and muzzle velocity', () => {
    const runs = [0, 1e-7, 2e-7, 4e-7].map((a) => interior(leaky(a)))
    for (let i = 1; i < runs.length; i++) {
      const [a, b] = [runs[i - 1], runs[i]]
      if (!a.valid || !b.valid) throw new Error('invalid')
      expect(b.peakBreechPressure).toBeLessThan(a.peakBreechPressure)
      expect(b.muzzleVelocity).toBeLessThan(a.muzzleVelocity)
      expect(b.points.at(-1)?.leakedMass).toBeGreaterThan(a.points.at(-1)?.leakedMass ?? 0)
    }
  })

  const expectFlowStartsAt = (pa: number, load: InteriorLoad) => {
    const r = interior(load)
    if (!r.valid) throw new Error(r.reason)
    for (const p of r.points) if (p.basePressure <= pa) expect(p.leakedMass).toBe(0)
    expect(r.points.some((p) => rel(p.basePressure, pa) < 1e-9)).toBe(true)
    expect(r.points.at(-1)?.leakedMass).toBeGreaterThan(0)
  }

  it('flow starts when the base pressure rises through the back pressure', () => {
    const runs: [number, InteriorLoad][] = [
      [101325, { ...leaky(1e-7), ignitionPressure: 5e4 }],
      [2e6, { ...leaky(1e-7, { backPressure: 2e6 }), ignitionPressure: 1e6 }],
    ]
    for (const [pa, load] of runs) expectFlowStartsAt(pa, load)
    // back pressure equal to the initial pressure: no onset event can fire, the flow still starts
    const start = interior(full())
    if (!start.valid) throw new Error(start.reason)
    const r = interior(leaky(2e-7, { backPressure: start.points[0].meanPressure }))
    if (!r.valid) throw new Error(r.reason)
    expect(r.points.at(-1)?.leakedMass).toBeGreaterThan(3e-5)
    // engraving that starts at 50 MPa: p_b steps through p_a at 0.001 m, on a restart
    const step = interior({
      ...leaky(2e-7, { backPressure: 1.173e8 }),
      resistance: {
        friction: 4e6,
        engraving: [
          { travel: 0.001, pressure: 50e6 },
          { travel: 0.003, pressure: 50e6 },
          { travel: 0.008, pressure: 10e6 },
        ],
      },
    })
    if (!step.valid) throw new Error(step.reason)
    expect(step.points.at(-1)?.leakedMass).toBeGreaterThan(3e-5)
  })

  it('the discharge coefficient multiplies the leak area', () => {
    expect(interior(leaky(2e-7, { discharge: 0.5 }))).toEqual(interior(leaky(1e-7)))
  })

  it('input errors and noShotStart', () => {
    const area = (pts: { travel: number; area: number }[]) => ({
      ...full(),
      leakage: { area: pts },
    })
    const cases: [string, InteriorLoad][] = [
      ['leakage.area', area([])],
      [
        'leakage.area',
        area([
          { travel: 0.01, area: 1e-7 },
          { travel: 0.005, area: 1e-7 },
        ]),
      ],
      [
        'leakage.area',
        area([
          { travel: 0.01, area: 1e-7 },
          { travel: 0.01, area: 1e-7 },
        ]),
      ],
      ['leakage.area', area([{ travel: 0, area: -1e-7 }])],
      ['leakage.backPressure', leaky(1e-7, { backPressure: -1 })],
      ['leakage.discharge', leaky(1e-7, { discharge: -1 })],
    ]
    for (const [field, load] of cases)
      expect(interior(load)).toEqual({ valid: false, reason: 'input', field })
    // constant form, n = 0.5: gas generation grows more slowly than outflow with pressure, so they
    // balance below the start pressure
    const base = full()
    const slow: InteriorLoad = {
      ...base,
      propellant: {
        ...base.propellant,
        burn: {
          kind: 'vivacity',
          vivacity: 5,
          exponent: 0.5,
          referencePressure: pref,
          form: { kind: 'constant' },
        },
      },
    }
    expect(interior(slow).valid).toBe(true)
    expect(interior({ ...slow, leakage: { area: [{ travel: 0, area: 3e-5 }] } })).toEqual({
      valid: false,
      reason: 'noShotStart',
    })
  })
})

describe('heat-loss defaults (apps/docs/docs/models/interior-leakage-heat.md, Convective heat loss)', () => {
  it('omitted fields take convectiveDefaults; flameTemperature is required', () => {
    const short = interior({ ...full(), heat: { model: 'convective', flameTemperature: 2900 } })
    const long = interior({
      ...full(),
      heat: { model: 'convective', flameTemperature: 2900, ...convectiveDefaults },
    })
    expect(short).toEqual(long)
    expect(convectiveDefaults).toEqual({ wallTemperature: 300, viscosity: 6e-5, prandtl: 0.69 })
    const missing = { ...full(), heat: { model: 'convective' } } as InteriorLoad
    expect(interior(missing)).toEqual({ valid: false, reason: 'input', field: 'heat' })
    for (const bad of [{ viscosity: -1 }, { wallTemperature: -1 }, { prandtl: 0 }]) {
      const load: InteriorLoad = {
        ...full(),
        heat: { model: 'convective', flameTemperature: 2900, ...bad },
      }
      expect(interior(load)).toEqual({ valid: false, reason: 'input', field: 'heat' })
    }
    const hot = full()
    if (hot.heat?.model !== 'convective') throw new Error('convective heat expected')
    const a = interior(full())
    const b = interior({ ...hot, heat: { ...hot.heat, wallTemperature: 500 } })
    if (!a.valid || !b.valid) throw new Error('invalid')
    expect(b.energy.heat).toBeLessThan(a.energy.heat)
  })
})

describe('MK 20 Rh 202 worked example', () => {
  // Rheinmetall 1977, sheet 1 (printed p. 98): input block
  const area = (Math.PI / 4) * 0.02 ** 2 + 15 * 2.5e-3 * 4.25e-4
  const load = constantLoad({
    volume: 5.515e-5,
    area,
    travel: 1.7275,
    mass: 0.12,
    charge: 0.0505,
    energy: 3.517e6,
    gamma: 1.3,
    density: 1600,
    vivacity: 0.262,
    sebert: 0.5,
    ignitionPressure: 1e3,
  })
  it('reproduces the values of sheets 1 to 3', () => {
    const r = interior(load)
    if (!r.valid) throw new Error(r.reason)
    const cf = closedForm(load)
    // sheet 1: xi_e, theta_b; sheet 2: C, p_m, v_e; sheet 3 last row: burnout velocity and travel
    expect(rel(cf.xiE, 24.17)).toBeLessThan(1e-3)
    expect(rel(cf.thetaB, 0.2958)).toBeLessThan(1e-3)
    expect(rel(1 / (1 - cf.thetaB), 1.42)).toBeLessThan(1e-3)
    expect(rel(r.peakBreechPressure, 3442e5)).toBeLessThan(1e-3)
    expect(rel(r.muzzleVelocity, 1061)).toBeLessThan(1e-3)
    const b = r.burnout
    if (!b) throw new Error('no burnout')
    const vb = r.points.find((p) => p.time === b.time)?.velocity ?? 0
    expect(rel(vb, 850.4)).toBeLessThan(1e-3)
    expect(rel(b.travel, 0.6689)).toBeLessThan(2e-3)
  })
})

describe('chargeTooSmall', () => {
  it('holds below 2.2 times the larger of the start and the ignition pressure', () => {
    expect(chargeTooSmall(chargeTooSmallRatio * 2e7, 2e7, 1e6)).toBe(false)
    expect(chargeTooSmall(4.39e7, 2e7, 1e6)).toBe(true)
    expect(chargeTooSmall(chargeTooSmallRatio * 5e6, 0, 5e6)).toBe(false)
    expect(chargeTooSmall(1.09e7, 0, 5e6)).toBe(true)
    expect(chargeTooSmall(Number.NaN, 2e7, 1e6)).toBe(true)
  })

  it('sits where half of a change of the start pressure reaches the peak mean pressure', () => {
    const load = { ...m3Load, startPressure: 3e7 }
    const peak = (charge: number, startPressure = load.startPressure) => {
      const r = interior({ ...load, charge, startPressure })
      if (!r.valid) throw new Error(r.reason)
      return r.maxMeanPressure
    }
    const target = chargeTooSmallRatio * load.startPressure
    const charge = bisect((c) => peak(c) < target, 1e-4, m3Load.charge, 60, true)
    const elasticity = Math.log(peak(charge, 3.15e7) / peak(charge, 2.85e7)) / Math.log(1.05 / 0.95)
    expect(elasticity).toBeGreaterThan(0.45)
    expect(elasticity).toBeLessThan(0.55)
  })
})

describe('propellant temperature', () => {
  it('peak pressure and muzzle velocity rise with it for positive sensitivities', () => {
    const run = (propellantTemperature: number) => {
      const r = interior({ ...full(), propellantTemperature })
      if (!r.valid) throw new Error(r.reason)
      return r
    }
    const [cold, mid, hot] = [250, 294.15, 330].map(run)
    expect(cold.peakBreechPressure).toBeLessThan(mid.peakBreechPressure)
    expect(mid.peakBreechPressure).toBeLessThan(hot.peakBreechPressure)
    expect(cold.muzzleVelocity).toBeLessThan(mid.muzzleVelocity)
    expect(mid.muzzleVelocity).toBeLessThan(hot.muzzleVelocity)
  })
})
