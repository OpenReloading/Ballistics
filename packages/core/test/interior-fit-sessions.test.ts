import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  fitPowder,
  fitPowderSessions,
  InputError,
  type InteriorLoad,
  interior,
  type LadderPoint,
  MixedPressureBasisError,
  PowderFitError,
  type PowderSession,
  predictPowder,
} from '../src/index.ts'

/** Synthetic rifle load (apps/docs/docs/models/interior-powder-fit.md): truth B_a 0.45 1/s, 3.9 MJ/kg, factor 1.4. */
const load = (vivacity = 0.45, energy = 3.9e6, tempering = 1): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 6.9e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: energy,
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
    temperatureSensitivity: { reference: 294.15, cold: 0.004 * tempering, hot: 0.003 * tempering },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 30e6,
})
const truth = load(0.45, 3.9e6, 1.4)
const charges = [2.6e-3, 2.8e-3, 3e-3]
const sigma = 3
/** Fixed noise pattern in units of sigma. */
const noise = [1, -1, 0.5, -1.5, 0.8, -0.4, 1.2, -0.7, 0.3]

/** Sessions of `truth` at the given lengths and temperatures, one per pair; `n` scales the noise. */
const sessions = (lengths: number[], temperatures: number[], n = 0): PowderSession[] =>
  lengths.flatMap((barrelLength, i) =>
    temperatures.map((propellantTemperature, j) => ({
      barrelLength,
      propellantTemperature,
      ladder: charges.map((charge, k): LadderPoint => {
        const r = interior({
          ...truth,
          charge,
          barrel: { ...truth.barrel, length: barrelLength },
          propellantTemperature,
        })
        if (!r.valid) throw new Error(r.reason)
        const noisy = n * sigma * nth(noise, (3 * i + 5 * j + k) % noise.length)
        return { charge, muzzleVelocity: r.muzzleVelocity + noisy, velocitySigma: sigma }
      }),
    })),
  )

const points = (list: PowderSession[]): LadderPoint[] =>
  list.flatMap((s) =>
    s.ladder.map((x) => ({
      ...x,
      ...(s.barrelLength === undefined ? {} : { barrelLength: s.barrelLength }),
      ...(s.propellantTemperature === undefined
        ? {}
        : { propellantTemperature: s.propellantTemperature }),
    })),
  )
const lengths = [0.4, 0.5, 0.6]
const temperatures = [273.15, 294.15, 313.15]
const start = load(0.38)

const failure = (f: () => unknown) => {
  try {
    f()
  } catch (e) {
    if (e instanceof PowderFitError) return e
    throw e
  }
  throw new Error('no error')
}
/** Distance of a fitted value from the truth in its standard uncertainties. */
const sigmas = (
  fit: { parameters: { name: string; value: number; standardUncertainty?: number }[] },
  name: string,
  value: number,
) => {
  const p = fit.parameters.find((x) => x.name === name)
  if (!p?.standardUncertainty) throw new Error(`no uncertainty of ${name}`)
  return Math.abs(p.value - value) / p.standardUncertainty
}

describe('powder fit over barrel lengths', () => {
  const parameters = ['burnRate', 'energy'] as const

  it('resolves the energy from three barrel lengths below the condition limit', () => {
    const r = fitPowder(start, points(sessions(lengths, [294.15], 1)), { parameters })
    expect(r.conditionNumber).toBeLessThan(1e3)
    expect(sigmas(r, 'burnRate', 0.45)).toBeLessThan(3)
    expect(sigmas(r, 'energy', 3.9e6)).toBeLessThan(3)
    expect(r.load.propellant.specificEnergy).toBe(nth(r.parameters, 1).value)
    expect(r.load.barrel.length).toBe(0.6)
  })

  it('refuses the energy from one barrel length as unresolved', () => {
    const e = failure(() => fitPowder(start, points(sessions([0.6], [294.15])), { parameters }))
    expect(e.reason).toBe('unresolved')
    expect(e.unresolved).toEqual([1])
    // barrel lengths that differ by less than 5 % do not count as several
    const close = failure(() =>
      fitPowder(start, points(sessions([0.6, 0.62], [294.15])), { parameters }),
    )
    expect(close.reason).toBe('unresolved')
  })

  it('runs a point at its own barrel length and keeps the load at its length', () => {
    const r = fitPowder(start, points(sessions(lengths, [294.15])), { parameters })
    const short = interior({ ...r.load, charge: 2.8e-3, barrel: { ...r.load.barrel, length: 0.4 } })
    const full = interior({ ...r.load, charge: 2.8e-3 })
    if (!short.valid || !full.valid) throw new Error('invalid')
    const observed = points(sessions(lengths, [294.15]))
    const at = (length: number) =>
      r.residuals.find((x, i) => x.charge === 2.8e-3 && observed[i / 1]?.barrelLength === length)
    expect(at(0.4)?.predicted).toBeCloseTo(short.muzzleVelocity, 3)
    expect(at(0.6)?.predicted).toBeCloseTo(full.muzzleVelocity, 3)
    expect(r.runCount % (3 * lengths.length)).toBe(0)
  })
})

describe('powder fit over temperatures', () => {
  const parameters = ['burnRate', 'temperatureFactor'] as const

  it('recovers the temperature factor within its uncertainty', () => {
    const r = fitPowder(start, points(sessions([0.6], temperatures, 1)), { parameters })
    expect(sigmas(r, 'temperatureFactor', 1.4)).toBeLessThan(3)
    expect(sigmas(r, 'burnRate', 0.45)).toBeLessThan(3)
    const { cold, hot } = r.load.propellant.temperatureSensitivity ?? { cold: 0, hot: 0 }
    expect(cold / hot).toBeCloseTo(0.004 / 0.003, 12)
    expect(hot).toBeCloseTo(0.003 * nth(r.parameters, 1).value, 12)
  })

  it('refuses the temperature factor from one temperature', () => {
    const e = failure(() => fitPowder(start, points(sessions([0.6], [313.15])), { parameters }))
    expect(e.reason).toBe('ill-conditioned')
    const reference = failure(() =>
      fitPowder(start, points(sessions([0.6], [294.15])), { parameters }),
    )
    expect(reference.reason).toBe('unresolved')
  })

  it('needs a load with a temperature sensitivity', () => {
    const bare = {
      ...start,
      propellant: { ...start.propellant, temperatureSensitivity: undefined },
    }
    expect(() => fitPowder(bare, points(sessions([0.6], temperatures)), { parameters })).toThrow(
      InputError,
    )
  })

  it('predicts with the fitted factor', () => {
    const r = fitPowder(start, points(sessions([0.6], temperatures, 1)), { parameters })
    const p = predictPowder(r, 2.8e-3)
    expect(p.velocity.standardUncertainty).toBeGreaterThan(0)
  })
})

describe('powder fit over sessions', () => {
  it('fits energy and temperature factor together and lists them as resolved', () => {
    const r = fitPowderSessions(start, sessions(lengths, temperatures, 1), {
      parameters: ['burnRate', 'energy', 'temperatureFactor'],
    })
    expect(r.resolved).toEqual(['burnRate', 'energy', 'temperatureFactor'])
    expect(r.held).toEqual([])
    expect(sigmas(r, 'energy', 3.9e6)).toBeLessThan(3)
    expect(sigmas(r, 'temperatureFactor', 1.4)).toBeLessThan(3)
  })

  it('holds the energy and the temperature factor that one length and one temperature leave open', () => {
    const r = fitPowderSessions(load(0.38, 3.9e6), sessions([0.6], [313.15], 1), {
      parameters: ['burnRate', 'energy', 'temperatureFactor'],
    })
    expect(r.resolved).toEqual(['burnRate'])
    expect(r.held.map((h) => h.name).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'energy',
      'temperatureFactor',
    ])
    expect(r.load.propellant.specificEnergy).toBe(3.9e6)
    expect(r.load.propellant.temperatureSensitivity).toEqual(
      start.propellant.temperatureSensitivity,
    )
  })

  it('holds only the parameter the sessions leave open', () => {
    const r = fitPowderSessions(start, sessions(lengths, [294.15], 1), {
      parameters: ['burnRate', 'energy', 'temperatureFactor'],
    })
    expect(r.resolved).toEqual(['burnRate', 'energy'])
    expect(r.held.map((h) => h.name)).toEqual(['temperatureFactor'])
  })

  it('drops the prior of a held parameter and fits like fitPowder otherwise', () => {
    const list = sessions([0.6], [294.15, 313.15], 1)
    // one length: a prior does not make the energy a result of the sessions
    const r = fitPowderSessions(start, list, {
      parameters: ['burnRate', 'energy'],
      priors: { energy: { value: 3.9e6, sigma: 0.05 } },
    })
    expect(r.resolved).toEqual(['burnRate'])
    expect(r.held).toEqual([{ name: 'energy', reason: 'unresolved' }])
    const direct = fitPowder(start, points(list))
    expect(nth(r.parameters, 0).value).toBe(nth(direct.parameters, 0).value)
  })

  it('refuses a prior on a parameter that was not requested', () => {
    expect(() =>
      fitPowderSessions(start, sessions([0.6], [294.15]), {
        priors: { energy: { value: 3.9e6, sigma: 0.05 } },
      }),
    ).toThrow(InputError)
  })

  it('keeps the barrel length and temperature a point states itself', () => {
    const list = sessions(lengths, [294.15], 1)
    // session lengths wrong, point lengths right: the points win
    const mislabelled = list.map((s) => ({
      ...s,
      barrelLength: 0.6,
      ladder: s.ladder.map((x) => ({ ...x, barrelLength: s.barrelLength ?? 0.6 })),
    }))
    const parameters = ['burnRate', 'energy'] as const
    const direct = fitPowder(start, points(list), { parameters })
    const r = fitPowderSessions(start, mislabelled, { parameters })
    expect(r.resolved).toEqual(parameters)
    expect(nth(r.parameters, 1).value).toBe(nth(direct.parameters, 1).value)
  })

  it('holds the temperature factor that one hot temperature leaves ill-conditioned', () => {
    const list = sessions([0.6], [313.15], 1)
    const r = fitPowderSessions(start, list, { parameters: ['burnRate', 'temperatureFactor'] })
    expect(r.held).toEqual([{ name: 'temperatureFactor', reason: 'ill-conditioned' }])
    expect(r.resolved).toEqual(['burnRate'])
    expect(nth(r.parameters, 0).value).toBe(nth(fitPowder(start, points(list)).parameters, 0).value)
  })

  it('gives up the parameter the ill-conditioned direction lies on most', () => {
    const r = fitPowderSessions(start, sessions(lengths, [313.15], 1), {
      parameters: ['burnRate', 'energy', 'temperatureFactor'],
    })
    expect(r.held).toEqual([{ name: 'temperatureFactor', reason: 'ill-conditioned' }])
    expect(r.resolved).toEqual(['burnRate', 'energy'])
  })

  it('gives up the last parameter when the points are fewer than the parameters', () => {
    const [one] = sessions([0.6], [294.15], 1)
    const r = fitPowderSessions(start, [{ ...one, ladder: (one?.ladder ?? []).slice(0, 1) }], {
      parameters: ['burnRate', 'temperatureFactor'],
    })
    expect(r.held).toEqual([{ name: 'temperatureFactor', reason: 'underdetermined' }])
    expect(r.resolved).toEqual(['burnRate'])
  })

  it('keeps the temperature a point states itself over its session', () => {
    const list = sessions([0.6], temperatures, 1)
    // one session labelled at the reference temperature, its points at their own
    const mislabelled = [
      {
        propellantTemperature: 294.15,
        ladder: points(list),
      },
    ]
    const parameters = ['burnRate', 'temperatureFactor'] as const
    const r = fitPowderSessions(start, mislabelled, { parameters })
    expect(r.resolved).toEqual(parameters)
    expect(nth(r.parameters, 1).value).toBe(
      nth(fitPowder(start, points(list), { parameters }).parameters, 1).value,
    )
  })

  it('holds the last open parameter when the sessions have fewer points than parameters', () => {
    const [one] = sessions([0.6], [294.15])
    const ladder = (one?.ladder ?? []).slice(0, 1)
    const r = fitPowderSessions(start, [{ ...one, ladder }], {
      parameters: ['burnRate', 'volumeFactor'],
    })
    expect(r.resolved).toEqual(['burnRate'])
    expect(r.held).toEqual([{ name: 'volumeFactor', reason: 'underdetermined' }])
  })

  it('holds the parameter two close temperatures leave parallel and fits the others', () => {
    const r = fitPowderSessions(start, sessions([0.5, 0.6], [300, 300.01]), {
      parameters: ['burnRate', 'energy', 'temperatureFactor'],
    })
    expect(r.resolved).toEqual(['burnRate', 'energy'])
    expect(r.held).toEqual([{ name: 'temperatureFactor', reason: 'ill-conditioned' }])
  })

  it('runs a session without a temperature at the temperature of the load', () => {
    const list = sessions(lengths, [294.15]).map(({ propellantTemperature: _, ...s }) => s)
    const parameters = ['burnRate', 'energy'] as const
    const direct = fitPowder(load(0.38), points(list), { parameters })
    const r = fitPowderSessions(load(0.38), list, { parameters })
    expect(nth(r.parameters, 1).value).toBe(nth(direct.parameters, 1).value)
  })

  it('keeps the burn coefficient and refuses empty input', () => {
    expect(() => fitPowderSessions(start, [])).toThrow(InputError)
    expect(() =>
      fitPowderSessions(start, sessions([0.6], [294.15]), { parameters: ['energy'] }),
    ).toThrow(InputError)
  })

  it('throws a failure that names no parameter to give up', () => {
    expect(() => fitPowderSessions(start, sessions([0.6], [294.15]), { maxIterations: 1 })).toThrow(
      PowderFitError,
    )
  })

  it('refuses pressures on different bases in different sessions', () => {
    const [a, b] = sessions([0.6], [294.15, 313.15])
    const onBasis = (session: PowderSession | undefined, pressureBasis: 'piezo' | 'crusher') => ({
      ...session,
      ladder: (session?.ladder ?? []).map((x) => ({
        ...x,
        peakPressure: 3e8,
        pressureSigma: 1e7,
        pressureBasis,
      })),
    })
    expect(() => fitPowderSessions(start, [onBasis(a, 'piezo'), onBasis(b, 'crusher')])).toThrow(
      MixedPressureBasisError,
    )
  })
})
