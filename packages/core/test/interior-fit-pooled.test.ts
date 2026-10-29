import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  calibratePooled,
  fitPowder,
  fitPowderPooled,
  type InteriorLoad,
  interior,
  type LadderPoint,
  type PooledPowderFit,
  type PooledRequest,
  type PooledSession,
  PowderFitError,
  predictPooled,
  predictPowder,
} from '../src/index.ts'

/** Synthetic rifle load as in the single-ladder tests, with its own barrel length. */
const load = (vivacity: number, length = 0.6): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 6.9e-3 },
  barrel: { length, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'vivacity',
      vivacity,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'twoStage', a: 0.8, m: 0.5, q: 0.5, z1: 0.8 },
    },
    temperatureSensitivity: { reference: 294.15, cold: 0.004, hot: 0.003 },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 30e6,
})

/** Standard normal draws from a fixed seed (mulberry32 and Box-Muller). */
const normals = (seed: number) => {
  let a = seed >>> 0
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform())
}

const sigma = 3
/** Truth: burn coefficient per powder, velocity factor per rifle (with its barrel), burn factor per lot. */
const powders = { A: 0.4, B: 0.45, C: 0.55 }
const rifles = {
  r1: { factor: 0.99, length: 0.5 },
  r2: { factor: 1.003, length: 0.6 },
  r3: { factor: 1.007, length: 0.66 },
}
const lots: Record<string, number> = { a1: 1.02, a2: 0.98 }
const charges = [2.5e-3, 2.7e-3, 2.9e-3, 3.1e-3]

type Setup = Omit<PooledSession, 'ladder'>
const setups: Setup[] = Object.keys(powders).flatMap((powder) =>
  Object.entries(rifles).map(([rifle, r], j) => ({
    powder,
    rifle,
    ...(powder === 'A' ? { lot: j < 2 ? 'a1' : 'a2' } : {}),
    // the fit starts away from the truth
    load: load(0.5, r.length),
  })),
)

/** True mean velocity of a setup at a charge. */
const truth = (s: Setup, charge: number) => {
  const vivacity =
    powders[s.powder as keyof typeof powders] * (s.lot === undefined ? 1 : (lots[s.lot] ?? 1))
  const r = interior({ ...load(vivacity, s.load.barrel.length), charge })
  if (!r.valid) throw new Error(r.reason)
  return r.muzzleVelocity * rifles[s.rifle as keyof typeof rifles].factor
}

/** Strings of the setups at `at` charges: measurement noise `sigma` plus relative model error `model`. */
const strings = (draw: () => number, at: number[], model: number, repeat = 1): PooledSession[] =>
  setups.map((s) => ({
    ...s,
    ladder: at.flatMap((charge) => {
      const v = truth(s, charge)
      return Array.from(
        { length: repeat },
        (): LadderPoint => ({
          charge,
          muzzleVelocity: v * (1 + model * draw()) + sigma * draw(),
          velocitySigma: sigma,
        }),
      )
    }),
  }))

const failure = (f: () => unknown) => {
  try {
    f()
  } catch (error) {
    return error
  }
  throw new Error('no failure')
}

const parameter = (fit: PooledPowderFit, kind: string, group: string) => {
  const p = fit.parameters.find((x) => x.kind === kind && x.group === group)
  if (!p) throw new Error(`no ${kind} ${group}`)
  return p
}

describe('fitPowderPooled', () => {
  it('recovers the burn coefficient per powder and the factor per rifle within 3 standard uncertainties', () => {
    const fit = fitPowderPooled(strings(normals(1), charges, 0))
    expect(fit.parameters.map((p) => p.kind)).toEqual([
      'burnRate',
      'burnRate',
      'burnRate',
      'rifle',
      'rifle',
      'rifle',
      'lot',
      'lot',
    ])
    for (const [powder, value] of Object.entries(powders)) {
      const p = parameter(fit, 'burnRate', powder)
      expect(Math.abs(p.value - value)).toBeLessThan(3 * p.standardUncertainty)
    }
    for (const [rifle, { factor }] of Object.entries(rifles)) {
      const p = parameter(fit, 'rifle', rifle)
      expect(Math.abs(p.value - factor)).toBeLessThan(3 * p.standardUncertainty)
    }
    expect(fit.modelError).toBe(0)
    expect(fit.degreesOfFreedom).toBe(36 - 8)
  })

  it('covers 85 to 95 % of held-out strings with a nominal 90 % interval after calibration', () => {
    const draw = normals(7)
    const model = 0.004
    const fit = fitPowderPooled(strings(draw, charges, model))
    const untested = [2.6e-3, 2.8e-3, 3e-3]
    const calibrated = calibratePooled(fit, strings(draw, untested, model, 4))
    expect(calibrated.calibrationStrings).toBe(9 * 3 * 4)
    expect(calibrated.modelError).toBeGreaterThan(0.002)
    expect(calibrated.modelError).toBeLessThan(0.006)
    const test = strings(draw, untested, model, 10)
    let inside = 0
    let count = 0
    for (const s of test)
      for (const charge of untested) {
        const p = predictPooled(calibrated, s, charge, { velocitySigma: sigma })
        for (const x of s.ladder.filter((y) => y.charge === charge)) {
          count++
          if (x.muzzleVelocity >= p.lower && x.muzzleVelocity <= p.upper) inside++
        }
      }
    expect(count).toBe(270)
    expect(inside / count).toBeGreaterThanOrEqual(0.85)
    expect(inside / count).toBeLessThanOrEqual(0.95)
    // without the model-error term the interval is too narrow
    const raw = predictPooled(fit, nth(test, 0), 2.8e-3, { velocitySigma: sigma })
    const wide = predictPooled(calibrated, nth(test, 0), 2.8e-3, { velocitySigma: sigma })
    expect(wide.standardUncertainty).toBeGreaterThan(raw.standardUncertainty)
  })

  it('fits one session as fitPowder does', () => {
    const draw = normals(3)
    const session: PooledSession = {
      powder: 'B',
      rifle: 'r2',
      load: load(0.38),
      ladder: [2.6e-3, 2.8e-3, 3e-3].map((charge) => {
        const r = interior({ ...load(0.45), charge })
        if (!r.valid) throw new Error(r.reason)
        return { charge, muzzleVelocity: r.muzzleVelocity + sigma * draw(), velocitySigma: sigma }
      }),
    }
    const pooled = fitPowderPooled([session])
    const single = fitPowder(session.load, session.ladder)
    const burn = nth(pooled.parameters, 0)
    const reference = nth(single.parameters, 0)
    // tolerance 1e-9 relative: the same rows, priors and solver, other run stacking
    expect(burn.value).toBeCloseTo(reference.value, 9)
    expect(burn.standardUncertainty / (reference.standardUncertainty as number)).toBeCloseTo(1, 9)
    const a = predictPooled(pooled, session, 2.9e-3)
    const b = predictPowder(single, 2.9e-3)
    expect(a.value).toBeCloseTo(b.velocity.value, 6)
    expect(a.parameterUncertainty / b.velocity.standardUncertainty).toBeCloseTo(1, 4)
  })

  it('adds the spread of a rifle it has not seen', () => {
    const fit = fitPowderPooled(strings(normals(1), charges, 0))
    const known = predictPooled(fit, nth(setups, 3), 2.8e-3)
    const unseen = predictPooled(fit, { ...nth(setups, 3), rifle: 'r9' }, 2.8e-3)
    expect(unseen.parameterUncertainty).toBeGreaterThan(0.9 * fit.rifleSigma * unseen.value)
    expect(known.parameterUncertainty).toBeLessThan(unseen.parameterUncertainty)
  })

  it('fits a temperature factor per powder only where its sessions span two temperatures', () => {
    const at = (t: number): PooledSession => {
      const ladder = charges.map((charge) => {
        const r = interior({ ...load(0.45), charge, propellantTemperature: t })
        if (!r.valid) throw new Error(r.reason)
        return { charge, muzzleVelocity: r.muzzleVelocity, velocitySigma: sigma }
      })
      return { powder: 'B', rifle: 'r2', load: load(0.4), propellantTemperature: t, ladder }
    }
    const fit = fitPowderPooled([at(273.15), at(313.15), { ...at(294.15), powder: 'C' }], {
      parameters: ['burnRate', 'temperatureFactor'],
    })
    expect(fit.parameters.map((p) => `${p.kind} ${p.group}`)).toEqual([
      'burnRate B',
      'temperatureFactor B',
      'burnRate C',
    ])
    expect(fit.held).toEqual([{ powder: 'C', name: 'temperatureFactor' }])
    expect(parameter(fit, 'temperatureFactor', 'B').value).toBeCloseTo(1, 3)
  })

  describe('refusals', () => {
    const data = strings(normals(1), charges, 0)

    it.each(['exponent', 'form'])('refuses the %s from velocities', (name) => {
      const error = failure(() =>
        fitPowderPooled(data, { parameters: ['burnRate', name as PooledRequest] }),
      )
      expect(error).toBeInstanceOf(PowderFitError)
      expect((error as PowderFitError).reason).toBe('unresolved')
    })

    it('refuses a powder with a single charge level', () => {
      const one = data.map((s) =>
        s.powder === 'C' ? { ...s, ladder: s.ladder.filter((x) => x.charge === 2.9e-3) } : s,
      )
      const error = failure(() => fitPowderPooled(one))
      expect(error).toBeInstanceOf(PowderFitError)
      expect((error as PowderFitError).reason).toBe('unresolved')
      expect((error as PowderFitError).unresolved).toEqual([2])
    })

    it('refuses temperature factors that two close temperatures leave parallel to the burn coefficient', () => {
      const close = data
        .filter((s) => s.powder === 'B')
        .map((s, k) => ({ ...s, propellantTemperature: k === 0 ? 300 : 300.01 }))
      const error = failure(() =>
        fitPowderPooled(close, { parameters: ['burnRate', 'temperatureFactor'] }),
      )
      expect(error).toBeInstanceOf(PowderFitError)
      expect((error as PowderFitError).reason).toBe('ill-conditioned')
    })

    it('refuses pressures and points without a velocity sigma', () => {
      const s = nth(data, 0)
      const point = nth(s.ladder, 0)
      expect(() =>
        fitPowderPooled([
          {
            ...s,
            ladder: [{ ...point, peakPressure: 3e8, pressureSigma: 1e7, pressureBasis: 'piezo' }],
          },
        ]),
      ).toThrow('velocities only')
      const { velocitySigma: _, ...bare } = point
      expect(() => fitPowderPooled([{ ...s, ladder: [bare] }])).toThrow('velocitySigma')
    })
  })
})
