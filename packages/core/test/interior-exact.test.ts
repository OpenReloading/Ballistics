import { describe, expect, it } from 'vitest'
import {
  type InteriorLoad,
  type InteriorOptions,
  type InteriorRun,
  interior,
} from '../src/index.ts'
import { m3Load } from './fixtures.ts'

const pref = 98066.5

const run = (load: InteriorLoad, options?: Partial<InteriorOptions>): InteriorRun => {
  const r = interior(load, options)
  if (!r.valid) throw new Error(r.reason)
  return r
}

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b)

/** A rifle-size constant-surface load with room for a covolume above 1/density. */
const exactLoad = (covolume: number, startPressure: number): InteriorLoad => ({
  ...m3Load,
  chamber: { ...m3Load.chamber, volume: 5e-6 },
  propellant: { ...m3Load.propellant, covolume },
  startPressure,
})

/**
 * Exact solution of the constant-surface model with a Noble-Abel gas, a linear burn law, no
 * resistance and a uniform-density gas column (effective mass m_p + m_c / 3). Written in the
 * symbols of `apps/docs/docs/models/interior-m3.md`: with u = z - z0 the velocity is
 * A u / (m_e B) and the gas volume follows a linear first-order equation in u, which a fixed-step
 * Runge-Kutta rule integrates far below the tolerance of the tests. After burnout the gas energy
 * falls as V^-(k-1).
 */
function exactSolution(load: InteriorLoad, covolume = load.propellant.covolume, steps = 4000) {
  const burn = load.propellant.burn
  if (burn.kind !== 'vivacity') throw new Error('vivacity form expected')
  const { volume: vc, boreArea: a } = load.chamber
  const { specificEnergy: q, gamma: k, density: rho } = load.propellant
  const mc = load.charge
  const me = load.bullet.mass + mc / 3
  const b = burn.vivacity / pref
  const free = vc - mc / rho
  const c0 = mc * (1 / rho - covolume)
  const z0 = (load.startPressure * free) / ((k - 1) * mc * q - load.startPressure * c0)
  const c = (a * a) / (2 * me * b * b)
  const n = (u: number) => mc * q * (z0 + u) - c * u * u
  const slope = (u: number, v: number) => c0 + ((2 * c * u) / ((k - 1) * n(u))) * v
  const volumeAt = (u: number) => {
    let v = free + c0 * z0
    const h = u / steps
    for (let i = 0; i < steps; i++) {
      const x = i * h
      const k1 = slope(x, v)
      const k2 = slope(x + h / 2, v + (h / 2) * k1)
      const k3 = slope(x + h / 2, v + (h / 2) * k2)
      const k4 = slope(x + h, v + h * k3)
      v += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4)
    }
    return v
  }
  const pressure = (u: number) => ((k - 1) * n(u)) / volumeAt(u)
  const ub = 1 - z0
  // golden-section search for the peak of the mean pressure on [0, ub]
  const g = (Math.sqrt(5) - 1) / 2
  let lo = 0
  let hi = ub
  for (let i = 0; i < 80; i++) {
    const m1 = hi - g * (hi - lo)
    const m2 = lo + g * (hi - lo)
    if (pressure(m1) < pressure(m2)) lo = m1
    else hi = m2
  }
  const vb = volumeAt(ub)
  const burnoutTravel = (vb - free - c0) / a
  const vm = vb + a * (load.barrel.length - burnoutTravel)
  const muzzleVelocity = Math.sqrt((2 * (mc * q - n(ub) * (vb / vm) ** (k - 1))) / me)
  return { peak: pressure((lo + hi) / 2), burnoutTravel, muzzleVelocity }
}

describe('exact solution with covolume and shot-start pressure', () => {
  it('converges in the reference quadrature', () => {
    const load = exactLoad(1.2e-3, 40e6)
    const coarse = exactSolution(load)
    const fine = exactSolution(load, undefined, 8000)
    expect(rel(coarse.peak, fine.peak)).toBeLessThan(1e-12)
    expect(rel(coarse.burnoutTravel, fine.burnoutTravel)).toBeLessThan(1e-12)
    expect(rel(coarse.muzzleVelocity, fine.muzzleVelocity)).toBeLessThan(1e-12)
  })

  it.each([
    [0, 25e6],
    [1.0e-3, 25e6],
    [1.2e-3, 25e6],
    [0, 40e6],
    [1.0e-3, 40e6],
    [1.2e-3, 40e6],
  ])('covolume %s m3/kg and start pressure %s Pa', (covolume, startPressure) => {
    const load = exactLoad(covolume, startPressure)
    const r = run(load)
    const exact = exactSolution(load)
    expect(r.burnout).not.toBeNull()
    expect(rel(r.maxMeanPressure, exact.peak)).toBeLessThan(1e-8)
    expect(rel(r.burnout?.travel ?? 0, exact.burnoutTravel)).toBeLessThan(1e-8)
    expect(rel(r.muzzleVelocity, exact.muzzleVelocity)).toBeLessThan(1e-8)
  })

  it('fails when the covolume of the reference is taken as 1/density', () => {
    const load = exactLoad(1.2e-3, 40e6)
    const r = run(load)
    const wrong = exactSolution(load, 1 / load.propellant.density)
    expect(rel(r.maxMeanPressure, wrong.peak)).toBeGreaterThan(1e-6)
    expect(rel(r.muzzleVelocity, wrong.muzzleVelocity)).toBeGreaterThan(1e-6)
  })
})

/** A rifle load with a seven-perforation grain, engraving, friction, twist and a start pressure. */
const grainLoad: InteriorLoad = {
  chamber: { volume: 3.6e-6, boreArea: 3.75e-5, boreDiameter: Math.sqrt((4 * 3.75e-5) / Math.PI) },
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
      coefficient: 2e-8,
      exponent: 0.85,
      grain: { shape: 'sevenPerf', diameter: 2.4e-3, perforationDiameter: 0.2e-3, length: 3e-3 },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 1e6,
  startPressure: 25e6,
  resistance: {
    friction: 2e6,
    engraving: [
      { travel: 0, pressure: 30e6 },
      { travel: 0.004, pressure: 5e6 },
      { travel: 0.01, pressure: 0 },
    ],
  },
}

/** Every length times s, volumes, masses and the charge times s^3, areas times s^2; pressures and material constants kept. */
function scaledLoad(load: InteriorLoad, s: number): InteriorLoad {
  const burn = load.propellant.burn
  if (burn.kind !== 'geometric' || burn.grain.shape !== 'sevenPerf')
    throw new Error('grain expected')
  const grain = burn.grain
  return {
    ...load,
    chamber: {
      volume: load.chamber.volume * s ** 3,
      boreArea: load.chamber.boreArea * s ** 2,
      boreDiameter: load.chamber.boreDiameter * s,
    },
    barrel: { length: load.barrel.length * s, twist: load.barrel.twist * s },
    bullet: { mass: load.bullet.mass * s ** 3 },
    charge: load.charge * s ** 3,
    propellant: {
      ...load.propellant,
      burn: {
        ...burn,
        grain: {
          ...grain,
          diameter: grain.diameter * s,
          perforationDiameter: grain.perforationDiameter * s,
          length: grain.length * s,
        },
      },
    },
    resistance: {
      ...load.resistance,
      engraving: load.resistance?.engraving?.map((p) => ({ ...p, travel: p.travel * s })),
    },
  }
}

/** Options with the times of a run scaled by s. */
const scaledOptions = (s: number): Partial<InteriorOptions> => ({
  outputStep: 2e-6 * s,
  maxTime: 0.1 * s,
})

describe('geometric scaling', () => {
  const base = run(grainLoad)

  it.each([0.5, 2, 5])('peak pressure, muzzle velocity and barrel time at s = %s', (s) => {
    const r = run(scaledLoad(grainLoad, s), scaledOptions(s))
    expect(rel(r.maxMeanPressure, base.maxMeanPressure)).toBeLessThan(1e-6)
    expect(rel(r.muzzleVelocity, base.muzzleVelocity)).toBeLessThan(1e-6)
    expect(rel(r.barrelTime, s * base.barrelTime)).toBeLessThan(1e-6)
  })

  it('is broken by the heat model, the one size-dependent term', () => {
    const heat = { model: 'convective', flameTemperature: 2800 } as const
    const ref = run({ ...grainLoad, heat })
    const r = run({ ...scaledLoad(grainLoad, 5), heat }, scaledOptions(5))
    expect(rel(r.muzzleVelocity, ref.muzzleVelocity)).toBeGreaterThan(1e-3)
  })
})

/** Central difference of the muzzle velocity against a relative change h of one input. */
function slope(load: (x: number) => InteriorLoad, x: number, h = 0.005): number {
  const lo = run(load(x * (1 - h))).muzzleVelocity
  const hi = run(load(x * (1 + h))).muzzleVelocity
  return (hi - lo) / (2 * h * x)
}

describe('chamber volume against barrel length', () => {
  // d v / d V_c = -(L / V*) d v / d L at fixed everything else, V* the free volume at the start
  // (constant-surface case, eta = 1/density; derived from the reduced variable A x / V*)
  const rifle: InteriorLoad = {
    ...m3Load,
    chamber: { ...m3Load.chamber, volume: 4.2e-6 },
    barrel: { length: 0.8, twist: 0 },
    charge: 0.0035,
    bullet: { mass: 0.012 },
    gradient: { energy: 0.5, breech: 0.5 },
    propellant: {
      ...m3Load.propellant,
      burn: {
        kind: 'vivacity',
        vivacity: 0.4,
        exponent: 1,
        referencePressure: pref,
        form: { kind: 'constant' },
      },
    },
  }

  it.each([
    ['demo powder', m3Load],
    ['rifle', rifle],
  ])('first-order relation, %s', (_name, load) => {
    const free = load.chamber.volume - load.charge / load.propellant.density
    const dL = slope(
      (x) => ({ ...load, barrel: { ...load.barrel, length: x } }),
      load.barrel.length,
    )
    const dV = slope(
      (x) => ({ ...load, chamber: { ...load.chamber, volume: x } }),
      load.chamber.volume,
    )
    expect(rel(dV, (-load.barrel.length / free) * dL)).toBeLessThan(0.05)
  })
})

/** A load of 203 mm bore with a seven-perforation grain, burnout in the first quarter of the travel. */
const proxy203: InteriorLoad = {
  chamber: { volume: 0.0215, boreArea: (Math.PI / 4) * 0.203 ** 2, boreDiameter: 0.203 },
  barrel: { length: 4.1, twist: 0 },
  bullet: { mass: 90 },
  charge: 10,
  propellant: {
    specificEnergy: 3.4e6,
    gamma: 1.24,
    density: 1650,
    covolume: 1e-3,
    burn: {
      kind: 'geometric',
      coefficient: 2e-9,
      exponent: 1,
      grain: { shape: 'sevenPerf', diameter: 15e-3, perforationDiameter: 1.1e-3, length: 22e-3 },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 1e6,
  startPressure: 20e6,
  resistance: { friction: 1e6 },
}

describe('velocity elasticities of a gun-class load', () => {
  // Typical figures for gun-class propellant loads, source unverified: a 1 % increase of the shell
  // mass, the charge, the chamber volume or the shot travel changes the muzzle velocity by
  // -0.4 %, +0.6 to 0.7 %, -0.25 % and +0.2 %. The pressure responses are not asserted.
  const h = 0.005
  const elasticity = (change: (x: number) => InteriorLoad): number => {
    const options = { outputStep: 2e-5 }
    const lo = run(change(1 - h), options).muzzleVelocity
    const hi = run(change(1 + h), options).muzzleVelocity
    return (hi - lo) / (2 * h * run(change(1), options).muzzleVelocity)
  }
  const load = proxy203

  it.each([
    [
      'shell mass',
      -0.4,
      -0.4,
      (x: number) => ({ ...load, bullet: { mass: load.bullet.mass * x } }),
    ],
    ['charge', 0.6, 0.7, (x: number) => ({ ...load, charge: load.charge * x })],
    [
      'chamber volume',
      -0.25,
      -0.25,
      (x: number) => ({ ...load, chamber: { ...load.chamber, volume: load.chamber.volume * x } }),
    ],
    [
      'shot travel',
      0.2,
      0.2,
      (x: number) => ({ ...load, barrel: { ...load.barrel, length: load.barrel.length * x } }),
    ],
  ])('%s', (_name, low, high, change) => {
    const e = elasticity(change)
    expect(e).toBeGreaterThan(low - 0.1)
    expect(e).toBeLessThan(high + 0.1)
  })
})
