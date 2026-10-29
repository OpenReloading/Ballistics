import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  type ChargedTrace,
  type CurveFitOptions,
  type CurveParameterReport,
  fitPressureCurve,
  fitPressureCurves,
  InputError,
  type InteriorLoad,
  interior,
  PowderFitError,
  type PressureHistory,
  type PressureSensor,
} from '../src/index.ts'
import { normals } from './random.ts'

interface Burn {
  vivacity: number
  exponent: number
  a: number
  z1: number
}

/** Synthetic rifle load (apps/docs/docs/models/interior-curve-fit.md) with a two-stage vivacity law. */
const load = (burn: Burn): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 6.9e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'vivacity',
      vivacity: burn.vivacity,
      exponent: burn.exponent,
      referencePressure: 98066.5,
      form: { kind: 'twoStage', a: burn.a, m: 0.5, q: 0.5, z1: burn.z1 },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 30e6,
})

const truthBurn: Burn = { vivacity: 8, exponent: 0.5, a: 0.8, z1: 0.3 }
const truth = load(truthBurn)

/** The model's pressure at `sensor` sampled every `step` s from 0.3 ms, plus Gaussian noise of `noise` of the peak. */
function trace(
  source: InteriorLoad,
  noise: number,
  sensor: PressureSensor = 'breech',
  seed = 7,
): PressureHistory {
  const run = interior(source)
  if (!run.valid) throw new Error(run.reason)
  const at = (p: (typeof run.points)[number]) =>
    sensor === 'breech' ? p.breechPressure : sensor === 'mean' ? p.meanPressure : p.basePressure
  const peak = Math.max(...run.points.map(at))
  const random = normals(seed)
  const time: number[] = []
  const pressure: number[] = []
  let k = 1
  for (let t = 1e-5; t < run.muzzleTime; t += 1e-5) {
    while (nth(run.points, k).time < t) k++
    const [a, b] = [nth(run.points, k - 1), nth(run.points, k)]
    const f = (t - a.time) / (b.time - a.time)
    time.push(t + 3e-4)
    pressure.push(at(a) + f * (at(b) - at(a)) + noise * peak * random())
  }
  return { sensor, time, pressure, sigma: noise > 0 ? noise * peak : undefined }
}

/** The load with the burn coefficient given at the reference pressure of the fit, as the fit restates it. */
const restated = (burn: Burn, pressure: number) =>
  burn.vivacity * (pressure / 98066.5) ** burn.exponent

const find = (parameters: CurveParameterReport[], name: CurveParameterReport['name']) => {
  const p = parameters.find((x) => x.name === name)
  if (!p) throw new Error(`no ${name}`)
  return p
}

const noisy = trace(truth, 0.005)
const start = (n = 1) => load({ vivacity: 8.24, exponent: 0.5 * n, a: 0.84, z1: 0.315 })
const base: CurveFitOptions = { fallFraction: 0.35 }

/** `p` lies within `k` standard uncertainties of `value`. */
const within = (p: CurveParameterReport, value: number, k = 3) =>
  Math.abs(p.value - value) <= k * (p.standardUncertainty ?? Number.NaN)

describe('curve fit of a synthetic trace', () => {
  const fit = fitPressureCurve(start(), noisy, { ...base, maxInflation: 500 })

  it('recovers the form parameters, the exponent and the burn coefficient within their uncertainty', () => {
    const { parameters } = fit
    expect(parameters.map((p) => p.name)).toEqual([
      'burnRate',
      'formSlope',
      'transition',
      'exponent',
      'timeShift',
    ])
    expect(parameters.every((p) => p.status === 'identified')).toBe(true)
    const peak = Math.max(...noisy.pressure)
    expect(fit.referencePressure).toBe(peak)
    expect(within(find(parameters, 'burnRate'), restated(truthBurn, peak))).toBe(true)
    expect(within(find(parameters, 'formSlope'), 0.8)).toBe(true)
    expect(within(find(parameters, 'transition'), 0.3)).toBe(true)
    expect(within(find(parameters, 'exponent'), 0.5)).toBe(true)
    // the start values were 5 to 10 % off, the uncertainties are not zero
    expect(find(parameters, 'exponent').initial).toBe(0.5)
    expect(find(parameters, 'exponent').standardUncertainty).toBeGreaterThan(0)
  })

  it('fits the noise level: chi2 is about the degrees of freedom', () => {
    expect(fit.weighted).toBe(true)
    expect(fit.chiSquare / fit.degreesOfFreedom).toBeGreaterThan(0.7)
    expect(fit.chiSquare / fit.degreesOfFreedom).toBeLessThan(1.4)
    expect(fit.degreesOfFreedom).toBe(fit.residuals.length - 5)
    // the window starts at the first sample after the 25 % rise
    expect(nth(fit.residuals, 0).time).toBeGreaterThanOrEqual(0)
    expect(nth(fit.residuals, 0).time).toBeLessThan(1e-5)
    expect(fit.correlation).toHaveLength(5)
  })

  it('applies the fitted values to the returned load at the reference pressure', () => {
    const { burn } = fit.load.propellant
    if (burn.kind !== 'vivacity' || burn.form.kind !== 'twoStage') throw new Error('burn kind')
    expect(burn.referencePressure).toBe(fit.referencePressure)
    expect(burn.vivacity).toBe(find(fit.parameters, 'burnRate').value)
    expect(burn.form.a).toBe(find(fit.parameters, 'formSlope').value)
    expect(burn.form.z1).toBe(find(fit.parameters, 'transition').value)
    expect(burn.exponent).toBe(find(fit.parameters, 'exponent').value)
    expect(burn.form.m).toBe(0.5)
    // the restated load is the same model: its velocity equals that of the fit at the load's own reference
    const again = interior(fit.load)
    expect(again.valid).toBe(true)
  })

  it('reaches the same solution from another start', () => {
    const other = fitPressureCurve(
      load({ vivacity: 7.8, exponent: 0.48, a: 0.77, z1: 0.29 }),
      noisy,
      { ...base, maxInflation: 500 },
    )
    for (const name of ['burnRate', 'formSlope', 'transition', 'exponent'] as const) {
      const [a, b] = [find(fit.parameters, name), find(other.parameters, name)]
      expect(Math.abs(a.value - b.value)).toBeLessThan((a.standardUncertainty ?? 0) / 4)
    }
  })
})

describe('curve fit identifiability', () => {
  it('leaves the exponent fixed and says so when the trace does not resolve it', () => {
    const fit = fitPressureCurve(start(), noisy, base)
    const exponent = find(fit.parameters, 'exponent')
    expect(exponent.status).toBe('fixed')
    expect(exponent.reasons).toEqual(['collinear'])
    expect(exponent.value).toBe(exponent.initial)
    expect(exponent.varianceInflation).toBeGreaterThan(10)
    expect(exponent.standardUncertainty).toBeUndefined()
    expect(exponent.relativeStandardUncertainty).toBeUndefined()
    const { burn } = fit.load.propellant
    expect(burn.exponent).toBe(0.5)
    // the others are fitted without it, and the fixed exponent is outside the correlation
    expect(fit.correlation).toHaveLength(4)
    expect(find(fit.parameters, 'transition').status).toBe('identified')
    expect(within(find(fit.parameters, 'transition'), 0.3)).toBe(true)
    expect(find(fit.parameters, 'burnRate').status).toBe('weak')
    expect(find(fit.parameters, 'burnRate').reasons).toEqual(['collinear'])
  })

  it('keeps a parameter the trace has no information on at its start value', () => {
    // a powder that burns 6 % of its charge by the end of the window never reaches a transition at 0.5
    const slow = load({ vivacity: 0.9, exponent: 0.5, a: 0.8, z1: 0.5 })
    const fit = fitPressureCurve(slow, trace(slow, 0.005), { fallFraction: 0.3 })
    const transition = find(fit.parameters, 'transition')
    expect(transition.status).toBe('fixed')
    expect(transition.reasons).toEqual(['unresolved'])
    expect(transition.value).toBe(0.5)
    expect(find(fit.parameters, 'burnRate').status).not.toBe('fixed')
  })

  it('gives up the exponent first when the fit is ill-conditioned', () => {
    const full = fitPressureCurve(start(), noisy, { ...base, maxInflation: 500 })
    const fit = fitPressureCurve(start(), noisy, {
      ...base,
      maxCondition: full.conditionNumber / 2,
      maxInflation: 500,
    })
    const exponent = find(fit.parameters, 'exponent')
    expect(exponent.status).toBe('fixed')
    expect(exponent.reasons).toEqual(['ill-conditioned'])
  })

  it('fails when even the burn coefficient and the shift are ill-conditioned', () => {
    expect(() => fitPressureCurve(start(), noisy, { ...base, maxCondition: 1.0001 })).toThrow(
      PowderFitError,
    )
  })

  it('fits the burn coefficient alone, with the noise estimated from the residuals', () => {
    const { sigma, ...unweighted } = noisy
    expect(sigma).toBeGreaterThan(0)
    const fit = fitPressureCurve(start(), unweighted, { ...base, parameters: ['burnRate'] })
    expect(fit.weighted).toBe(false)
    expect(fit.parameters.map((p) => p.name)).toEqual(['burnRate', 'timeShift'])
    expect(find(fit.parameters, 'burnRate').standardUncertainty).toBeGreaterThan(0)
    expect(find(fit.parameters, 'burnRate').status).toBe('identified')
  })

  it('reports a weak parameter whose relative uncertainty is above the limit', () => {
    const fit = fitPressureCurve(start(), noisy, {
      ...base,
      maxInflation: 1e6,
      maxRelativeStandardUncertainty: 0.02,
    })
    expect(find(fit.parameters, 'formSlope').status).toBe('weak')
    expect(find(fit.parameters, 'formSlope').reasons).toEqual(['imprecise'])
  })
})

describe('joint curve fit of several traces', () => {
  const charged = (charge: number, seed: number): ChargedTrace => ({
    charge,
    trace: trace({ ...truth, charge }, 0.005, 'breech', seed),
  })
  const set = [charged(0.0024, 11), charged(0.0027, 12), charged(0.003, 13)]
  // the exponent starts 10 % high, the burn coefficient matched near the peaks
  const high = load({
    vivacity: 8.24 * (1.3e8 / 98066.5) ** -0.05,
    exponent: 0.55,
    a: 0.84,
    z1: 0.315,
  })
  const joint = fitPressureCurves(high, set, base)

  it('fits the exponent within its uncertainty at the default limit', () => {
    const exponent = find(joint.parameters, 'exponent')
    expect(exponent.status).toBe('identified')
    expect(exponent.varianceInflation).toBeGreaterThan(10)
    expect(exponent.varianceInflation).toBeLessThan(100)
    expect(within(exponent, 0.5)).toBe(true)
    expect(joint.warnings).toEqual([])
  })

  it('states the burn coefficient at the geometric mean of the peaks, one time shift per trace', () => {
    const peaks = set.map((s) => Math.max(...s.trace.pressure))
    const mean = Math.cbrt(peaks.reduce((a, b) => a * b))
    expect(joint.referencePressure).toBeCloseTo(mean, 0)
    expect(joint.load.charge).toBe(high.charge)
    expect(within(find(joint.parameters, 'burnRate'), restated(truthBurn, mean))).toBe(true)
    expect(joint.parameters.map((p) => p.name)).toEqual([
      'burnRate',
      'formSlope',
      'transition',
      'exponent',
      'timeShift',
      'timeShift',
      'timeShift',
    ])
    expect(joint.traces).toHaveLength(3)
    const samples = joint.traces.reduce((n, t) => n + t.residuals.length, 0)
    expect(joint.degreesOfFreedom).toBe(samples - 7)
    expect(joint.correlation).toHaveLength(7)
  })

  it('holds the exponent with one trace of the same set', () => {
    const one = fitPressureCurves(high, set.slice(2), base)
    expect(find(one.parameters, 'exponent').status).toBe('fixed')
    expect(one.warnings).toEqual([])
  })

  it('equals the fit of one trace with one trace', () => {
    const shot = nth(set, 2)
    const single = fitPressureCurve({ ...high, charge: shot.charge }, shot.trace, base)
    const { traces, warnings, ...rest } = fitPressureCurves(
      { ...high, charge: shot.charge },
      [shot],
      base,
    )
    expect({ ...rest, ...nth(traces, 0) }).toEqual(single)
    expect(warnings).toEqual([])
  })

  it('names repeat shots at one charge and keeps the limit of distinct charges', () => {
    const fit = fitPressureCurves(high, [nth(set, 0), charged(0.0024, 21), nth(set, 2)], base)
    expect(fit.warnings).toEqual([
      { reason: 'sameCharge', traces: [0, 1], message: 'traces 0, 1 have the same charge' },
    ])
    expect(find(fit.parameters, 'exponent').status).not.toBe('fixed')
  })

  it('names a narrow peak range and holds the exponent as with one trace', () => {
    const fit = fitPressureCurves(high, [charged(0.0029, 31), nth(set, 2)], base)
    expect(fit.warnings.map((w) => [w.reason, w.traces])).toEqual([['narrowPeaks', [0, 1]]])
    expect(nth(fit.warnings, 0).message).toMatch(/below 1.2/)
    expect(find(fit.parameters, 'exponent').status).toBe('fixed')
  })

  it('rejects an empty set, a bad charge and sigma on only some traces', () => {
    expect(() => fitPressureCurves(high, [])).toThrow(/at least one trace/)
    expect(() => fitPressureCurves(high, [{ ...nth(set, 0), charge: 0 }])).toThrow(/charge/)
    const { sigma: _, ...bare } = nth(set, 1).trace
    expect(() => fitPressureCurves(high, [nth(set, 0), { charge: 0.0027, trace: bare }])).toThrow(
      /sigma: on every trace or on none/,
    )
  })
})

describe('curve fit sensors', () => {
  it.each(['mean', 'base'] as const)(
    'compares a %s pressure trace with that pressure',
    (sensor) => {
      const t = trace(truth, 0.005, sensor)
      const fit = fitPressureCurve(start(), t, { ...base, parameters: ['burnRate'] })
      const peak = Math.max(...t.pressure)
      expect(within(find(fit.parameters, 'burnRate'), restated(truthBurn, peak), 4)).toBe(true)
    },
  )
})

describe('curve fit failures', () => {
  const t = noisy
  const rejects = (f: () => unknown, message: string | RegExp, kind = InputError) => {
    expect(f).toThrow(kind)
    expect(f).toThrow(message)
  }

  it('rejects a malformed trace', () => {
    rejects(() => fitPressureCurve(start(), { ...t, time: t.time.slice(1) }), /trace:/)
    rejects(() => fitPressureCurve(start(), { ...t, time: [...t.time].reverse() }), /trace:/)
    rejects(
      () => fitPressureCurve(start(), { ...t, pressure: t.pressure.map(() => Number.NaN) }),
      /trace:/,
    )
    rejects(() => fitPressureCurve(start(), { ...t, sigma: 0 }), /sigma must be positive/)
    rejects(
      () => fitPressureCurve(start(), { ...t, sensor: 'Breech' as PressureSensor }),
      /trace.sensor/,
    )
  })

  it('rejects a trace that does not rise and fall', () => {
    const flat = t.pressure.map((_, i) => i)
    rejects(
      () => fitPressureCurve(start(), { ...t, pressure: flat.map((x) => -x) }),
      /no positive pressure/,
    )
    rejects(() => fitPressureCurve(start(), { ...t, pressure: flat }), /never falls/)
  })

  it('rejects a trace too short for the parameters', () => {
    const peak = t.pressure.indexOf(Math.max(...t.pressure))
    const few = { ...t, time: t.time.slice(0, peak + 3), pressure: t.pressure.slice(0, peak + 3) }
    rejects(() => fitPressureCurve(start(), few, base), /never falls|too few/)
    const tiny = {
      ...t,
      time: [0, 1, 2, 3, 4],
      pressure: [0, 1e8, 3e8, 1e8, 0],
    }
    rejects(() => fitPressureCurve(start(), tiny, base), /too few trace samples/)
  })

  it('fits a lone exponent instead of holding it', () => {
    const fit = fitPressureCurve(start(), noisy, { ...base, parameters: ['exponent'] })
    const exponent = find(fit.parameters, 'exponent')
    expect(exponent.status).not.toBe('fixed')
    expect(exponent.value).not.toBe(exponent.initial)
  })

  it('rejects options and burn laws it cannot fit', () => {
    const o = (options: CurveFitOptions) => () => fitPressureCurve(start(), t, options)
    rejects(o({ parameters: [] }), /parameters:/)
    rejects(o({ parameters: ['burnRate', 'burnRate'] }), /parameters:/)
    rejects(o({ parameters: ['speed' as 'burnRate'] }), /parameters:/)
    rejects(o({ maxIterations: 0 }), /maxIterations/)
    rejects(o({ maxCondition: 0 }), /maxCondition/)
    rejects(o({ fallFraction: 1 }), /fallFraction/)
    const burn = start().propellant.burn
    const withBurn = (b: unknown) => () =>
      fitPressureCurve({ ...start(), propellant: { ...start().propellant, burn: b as never } }, t)
    rejects(withBurn({ ...burn, form: { kind: 'constant' } }), /two-stage/)
    rejects(withBurn({ ...burn, kind: 'geometric' }), /two-stage/)
    const form = (patch: object) => ({
      ...burn,
      form: { ...(burn as { form: object }).form, ...patch },
    })
    rejects(withBurn(form({ a: 0 })), /formSlope needs/)
    rejects(withBurn(form({ z1: 1 })), /transition needs/)
    rejects(withBurn({ ...burn, exponent: 0 }), /exponent needs/)
  })

  it('throws the failure of an invalid start or an exhausted step budget', () => {
    const crowded = { ...start(), chamber: { ...start().chamber, volume: 1e-9 } }
    expect(() => fitPressureCurve(crowded, t, base)).toThrow(PowderFitError)
    try {
      fitPressureCurve(start(), t, { ...base, maxIterations: 1 })
      throw new Error('no error')
    } catch (e) {
      expect(e).toBeInstanceOf(PowderFitError)
      expect((e as PowderFitError).reason).toBe('not-converged')
    }
  })

  it('names the window when the model leaves the barrel before it ends', () => {
    const quick = load({ vivacity: 20, exponent: 0.5, a: 0.8, z1: 0.3 })
    rejects(() => fitPressureCurve(quick, t, base), /leaves the barrel/)
  })
})
