import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  comparePlanCandidates,
  fitTruingStrings,
  planTruingStrings,
  type RangeStringEntry,
  type RangeStringPriors,
} from '../src/index.ts'
import { normals } from './random.ts'
import {
  click,
  coverage,
  dials,
  dispersion,
  find,
  impacts,
  monteCarloTimeout,
  nominal,
  shots,
  strings,
  type Truth,
  tolerance,
} from './range-strings-fixtures.ts'

const base: Truth = { v: 1.015, k: 0.96, c: 1.02, offset: 0.15e-3 }

const planOf = (e: typeof impacts, d: typeof dials) => ({
  shot: nominal,
  clickValue: click,
  dispersion,
  entries: [
    ...e.map((range) => ({ kind: 'impact' as const, range, shotCount: shots })),
    ...d.map((range) => ({ kind: 'dial' as const, range, shotCount: shots })),
  ],
  chronograph: { shotCount: 10, standardDeviation: 4 },
})

describe('zero offset', () => {
  const options = { fitZeroOffset: true }

  it('is left out of a three-parameter fit and plan', () => {
    const r = fitTruingStrings(strings(base, () => 0))
    expect(r.parameters.map((p) => p.name)).toEqual(['muzzleVelocity', 'dragFactor', 'clickValue'])
    expect(planTruingStrings(planOf(impacts, dials)).parameters).toHaveLength(3)
  })

  it('recovers all four parameters from exact strings', () => {
    const r = fitTruingStrings(
      strings(base, () => 0, undefined, true),
      options,
    )
    expect(r.parameters.map((p) => p.status)).toEqual(Array(4).fill('identified'))
    expect(find(r, 'zeroOffset').value).toBeCloseTo(base.offset, 8)
    expect(find(r, 'muzzleVelocity').value as number).toBeCloseTo(790 * base.v, 3)
    expect(find(r, 'dragFactor').value as number).toBeCloseTo(base.k, 6)
    expect(find(r, 'clickValue').value as number).toBeCloseTo(click * base.c, 9)
    expect(r.degreesOfFreedom).toBe(3)
  })

  it('identifies the offset from an impact at the zero range once it is on', () => {
    const at = { impacts: [100, 300, 600, 900], dials: [] }
    const data = strings({ ...base, offset: 0.3e-3 }, () => 0, at, true)
    const r = fitTruingStrings({ ...data, entries: data.entries }, options)
    expect(find(r, 'zeroOffset').status).toBe('identified')
    expect(find(r, 'zeroOffset').value).toBeCloseTo(0.3e-3, 8)
    // without the option the impact at the zero range carries no information
    const plain = planTruingStrings({
      ...planOf([100], []),
      chronograph: undefined,
    })
    expect(nth(plain.parameters, 0).status).toBe('unresolved')
    const on = planTruingStrings({ ...planOf([100], []), chronograph: undefined }, options)
    expect(find(on, 'zeroOffset').status).not.toBe('unresolved')
  })

  it('reports the offset as weak when a single distance cannot separate it from the velocity', () => {
    const plan = planTruingStrings(
      { ...planOf([300], []), chronograph: undefined },
      { fitZeroOffset: true },
    )
    expect(find(plan, 'zeroOffset').status).toBe('weak')
    expect(find(plan, 'muzzleVelocity').status).toBe('weak')
    expect(plan.confounded).toContain('zeroOffset')
    const fit = fitTruingStrings(
      { ...strings(base, normals(1), { impacts: [300], dials: [] }), chronograph: undefined },
      options,
    )
    expect(find(fit, 'zeroOffset').value).toBeUndefined()
    expect(find(fit, 'zeroOffset').interval).toBeUndefined()
  })

  it('names an offset the data cannot place when only the chronograph and dials remain', () => {
    const data = strings(base, normals(2), { impacts: [], dials: [400, 700, 1000] })
    const r = fitTruingStrings(data, options)
    expect(find(r, 'zeroOffset').status).toBe('weak')
    expect(find(r, 'zeroOffset').reasons).toEqual(['collinear', 'imprecise'])
  })

  describe('maxZeroSigma', () => {
    // One impact at the zero range: the offset is the only column that moves, impact = 100 m * e.
    // 4 shots of 1.6e-4 rad * 100 m give a standard uncertainty of 0.008 m, so 8e-5 rad on e.
    const zeroPlan = { ...planOf([100], []), dispersion: 1.6e-4, chronograph: undefined }
    const entries = zeroPlan.entries.map((e) => ({ ...e, shotCount: 4 }))
    const sigma = 8e-5

    it('names an offset above the limit weak and imprecise', () => {
      const plan = planTruingStrings({ ...zeroPlan, entries }, { ...options, maxZeroSigma: 7.9e-5 })
      const p = find(plan, 'zeroOffset')
      expect(p.standardUncertainty).toBeCloseTo(sigma, 9)
      expect(p.status).toBe('weak')
      expect(p.reasons).toEqual(['imprecise'])
      expect(p.interval).toBeUndefined()
      const data = {
        ...strings(base, () => 0),
        entries: [] as RangeStringEntry[],
        chronograph: undefined,
      }
      const fit = fitTruingStrings(
        {
          ...data,
          entries: [
            { kind: 'impact', range: 100, value: 0.02, shotCount: 4, standardDeviation: 0.016 },
          ],
        },
        { ...options, maxZeroSigma: 7.9e-5 },
      )
      expect(find(fit, 'zeroOffset').status).toBe('weak')
      expect(find(fit, 'zeroOffset').reasons).toEqual(['imprecise'])
      expect(find(fit, 'zeroOffset').value).toBeUndefined()
    })

    it('names an offset just below the limit identified', () => {
      const plan = planTruingStrings({ ...zeroPlan, entries }, { ...options, maxZeroSigma: 8.1e-5 })
      expect(find(plan, 'zeroOffset').status).toBe('identified')
      expect(find(plan, 'zeroOffset').reasons).toEqual([])
    })

    it('rejects a limit that is not positive', () => {
      expect(() =>
        planTruingStrings({ ...zeroPlan, entries }, { ...options, maxZeroSigma: 0 }),
      ).toThrow(/maxZeroSigma/)
    })
  })
})

describe('priors', () => {
  const priors = {
    muzzleVelocity: 0.01,
    dragFactor: 0.05,
    clickValue: 0.02,
    zeroOffset: 0.2e-3,
  } satisfies RangeStringPriors
  const options = { fitZeroOffset: true, priors }

  it('narrow the intervals and report the posterior against the prior', () => {
    const data = strings(base, normals(5))
    const without = fitTruingStrings(data, { fitZeroOffset: true })
    const withPriors = fitTruingStrings(data, options)
    for (const name of ['muzzleVelocity', 'dragFactor', 'clickValue', 'zeroOffset'] as const) {
      const a = find(without, name)
      const b = find(withPriors, name)
      const width = (p: typeof a) =>
        Math.log((p.interval?.upper as number) / (p.interval?.lower as number))
      if (name !== 'zeroOffset') expect(width(b)).toBeLessThan(width(a))
      else
        expect((b.interval?.upper as number) - (b.interval?.lower as number)).toBeLessThan(
          (a.interval?.upper as number) - (a.interval?.lower as number),
        )
      expect(b.prior?.ratio).toBeGreaterThan(0)
      expect(b.prior?.ratio).toBeLessThanOrEqual(1)
      expect(b.relativeStandardUncertainty ?? b.standardUncertainty).toBeDefined()
    }
  })

  describe('maximum a posteriori centre', () => {
    // One impact at the zero range: the offset e is the only live column and the model is linear,
    // impact = 100 m * e. 4 shots of 0.016 m make the standard uncertainty of the row 0.008 m, so
    // the data say e = y / 100 with sigma_d = 8e-5 rad. With the prior e ~ N(0, s^2) the posterior
    // is Gaussian with precision 1 / sigma_d^2 + 1 / s^2, centred on
    //   e* = (y / 100) * s^2 / (s^2 + sigma_d^2)
    // and with standard deviation sigma_d * s / sqrt(sigma_d^2 + s^2).
    const sigmaD = 8e-5
    const one = (y: number) => ({
      shot: nominal,
      clickValue: click,
      entries: [
        { kind: 'impact' as const, range: 100, value: y, shotCount: 4, standardDeviation: 0.016 },
      ],
    })
    const map = (y: number, s: number) =>
      fitTruingStrings(one(y), { fitZeroOffset: true, priors: { zeroOffset: s } })

    it.each([
      // s = sigma_d: factor 1/2, e* = 0.15e-3, posterior sigma 8e-5 / sqrt(2)
      [8e-5, 0.5, sigmaD / Math.SQRT2],
      // s = sigma_d / 2: factor (1/4) / (1/4 + 1) = 0.2, e* = 0.06e-3, posterior sigma 8e-5 / sqrt(5)
      [4e-5, 0.2, sigmaD / Math.sqrt(5)],
    ])('shrinks the data value toward the prior nominal (s = %d)', (s, factor, post) => {
      const e = 0.3e-3
      const fit = map(100 * e, s)
      const p = find(fit, 'zeroOffset')
      expect(p.status).toBe('identified')
      expect(p.value as number).toBeCloseTo(factor * e, 10)
      expect(p.posteriorSigma as number).toBeCloseTo(post, 12)
      expect(p.prior?.ratio as number).toBeCloseTo(post / s, 9)
      // the data alone give the data value, and the prior moves the fit toward the nominal 0
      const plain = find(fitTruingStrings(one(100 * e), { fitZeroOffset: true }), 'zeroOffset')
      expect(plain.value as number).toBeCloseTo(e, 10)
      expect(Math.abs(p.value as number)).toBeLessThan(Math.abs(plain.value as number))
      expect(p.value as number).toBeGreaterThan(0)
    })

    it('covers the truth with the posterior centre and width, the data value does not', () => {
      // truth drawn from the prior with s = sigma_d: the data value y / 100 has an error of
      // sigma_d, the posterior centre one of sigma_d / sqrt(2), the posterior half-width is
      // 1.96 sigma_d / sqrt(2): about 0.95 for the centre, about 0.83 for the data value.
      const seeds = 300
      let centre = 0
      let dataValue = 0
      for (let seed = 1; seed <= seeds; seed++) {
        const draw = normals(20_000 + seed)
        const truth = sigmaD * draw()
        const y = 100 * truth + 100 * sigmaD * draw()
        const { lower: low, upper: high } = find(map(y, sigmaD), 'zeroOffset').interval as {
          lower: number
          upper: number
        }
        if (low <= truth && truth <= high) centre++
        if (Math.abs(y / 100 - truth) <= (high - low) / 2) dataValue++
      }
      expect(centre / seeds).toBeGreaterThan(0.95 - tolerance(seeds))
      expect(centre / seeds).toBeLessThan(0.95 + tolerance(seeds))
      expect(dataValue / seeds).toBeLessThan(0.95 - tolerance(seeds))
    })
  })

  it('raise the chi-square of the residual check above the one without priors', () => {
    // the data-only fit minimizes the chi-square, so at the posterior mode it is at least as large
    // at the same degrees of freedom: the check flags a fit with priors no less often
    const data = strings(base, normals(5))
    const plain = fitTruingStrings(data, { fitZeroOffset: true })
    const withPriors = fitTruingStrings(data, options)
    expect(withPriors.degreesOfFreedom).toBe(plain.degreesOfFreedom)
    expect(withPriors.chiSquare).toBeGreaterThan(plain.chiSquare)
  })

  it('scale the posterior standard error, prior included, with scaleByResidual', () => {
    const data = strings(base, normals(5))
    const fit = fitTruingStrings(data, { ...options, scaleByResidual: true })
    expect(fit.degreesOfFreedom).toBe(3)
    // Student t, 3 degrees of freedom, two-sided 95 %
    const t = 3.182446305
    for (const p of fit.parameters) {
      const { lower: low, upper: high } = p.interval as { lower: number; upper: number }
      const half = p.name === 'zeroOffset' ? (high - low) / 2 : Math.log(high / low) / 2
      expect(half / (t * fit.intervalScale * (p.posteriorSigma as number))).toBeCloseTo(1, 6)
    }
  })

  it('leave the statuses to the data: a prior does not identify a weak parameter', () => {
    const at = { impacts: [300], dials: [] as number[] }
    const data = { ...strings(base, normals(9), at), chronograph: undefined }
    const fit = fitTruingStrings(data, { priors: { muzzleVelocity: 0.01, dragFactor: 0.05 } })
    const plain = fitTruingStrings(data)
    expect(fit.parameters.map((p) => p.status)).toEqual(plain.parameters.map((p) => p.status))
    expect(find(fit, 'dragFactor').value).toBeUndefined()
    expect(find(fit, 'muzzleVelocity').value).toBeUndefined()
    const plan = planTruingStrings(
      { ...planOf([300], []), chronograph: undefined },
      { priors: { muzzleVelocity: 0.01, dragFactor: 0.05 } },
    )
    expect(plan.parameters.map((p) => p.status)).toEqual(
      planTruingStrings({ ...planOf([300], []), chronograph: undefined }).parameters.map(
        (p) => p.status,
      ),
    )
  })

  it(
    'cover the true values when the truth is drawn from the prior',
    () => {
      const seeds = 300
      const { covered } = coverage(
        (seed) => {
          const draw = normals(10_000 + seed)
          return {
            v: Math.exp(priors.muzzleVelocity * draw()),
            k: Math.exp(priors.dragFactor * draw()),
            c: Math.exp(priors.clickValue * draw()),
            offset: priors.zeroOffset * draw(),
          }
        },
        options,
        seeds,
      )
      expect(Object.keys(covered)).toEqual([
        'muzzleVelocity',
        'dragFactor',
        'clickValue',
        'zeroOffset',
      ])
      for (const c of Object.values(covered)) {
        expect(c / seeds).toBeGreaterThan(0.95 - tolerance(seeds))
        expect(c / seeds).toBeLessThan(0.95 + tolerance(seeds))
      }
    },
    monteCarloTimeout,
  )

  it('are rejected when malformed', () => {
    const data = strings(base, () => 0)
    expect(() => fitTruingStrings(data, { priors: { dragFactor: 0 } })).toThrow(/positive/)
    expect(() => fitTruingStrings(data, { priors: { zeroOffset: 1e-4 } })).toThrow(/zeroOffset/)
  })
})

describe('comparePlanCandidates', () => {
  const candidates = [
    { name: 'short', entries: planOf([200], []).entries },
    { name: 'two', entries: planOf([300, 600], []).entries },
    {
      name: 'full',
      entries: planOf(impacts, dials).entries,
      chronograph: { shotCount: 10, standardDeviation: 4 },
    },
  ]
  const input = { shot: nominal, clickValue: click, dispersion }

  it('returns one plan per candidate with its shots, in order', () => {
    const plans = comparePlanCandidates(input, candidates)
    expect(plans.map((p) => p.name)).toEqual(['short', 'two', 'full'])
    expect(plans.map((p) => p.shotCount)).toEqual([5, 10, 40])
    expect(nth(plans, 0).plan.parameters.some((p) => p.status === 'weak')).toBe(true)
    expect(nth(plans, 2).plan.parameters.every((p) => p.status === 'identified')).toBe(true)
  })

  it('matches planTruingStrings for the same candidate', () => {
    const full = nth(comparePlanCandidates(input, candidates), 2)
    expect(full.plan).toEqual(
      planTruingStrings({
        ...input,
        entries: nth(candidates, 2).entries,
        chronograph: nth(candidates, 2).chronograph,
      }),
    )
  })

  it('rejects an empty list', () => {
    expect(() => comparePlanCandidates(input, [])).toThrow(/candidate/)
  })

  it('predicts the interval widths the fit reports', () => {
    const options = { fitZeroOffset: true, priors: { zeroOffset: 0.3e-3, muzzleVelocity: 0.02 } }
    const full = nth(
      comparePlanCandidates(
        input,
        [
          {
            entries: planOf(impacts, dials).entries,
            chronograph: { shotCount: 10, standardDeviation: 4 },
          },
        ],
        options,
      ),
      0,
    )
    const fit = fitTruingStrings(strings(base, normals(3)), options)
    for (const p of full.plan.parameters) {
      expect(p.status).toBe('identified')
      const f = find(fit, p.name)
      const plan = p.interval as { lower: number; upper: number }
      const got = f.interval as { lower: number; upper: number }
      // the log of the interval ratio for a positive parameter, the width in rad for the offset
      const w = (i: { lower: number; upper: number }) =>
        p.name === 'zeroOffset' ? i.upper - i.lower : Math.log(i.upper / i.lower)
      expect(Math.abs(w(plan) / w(got) - 1)).toBeLessThan(0.15)
    }
  })

  it('orders candidates by the width of the drag factor they promise', () => {
    const plans = comparePlanCandidates(input, [
      { entries: planOf([600], []).entries, chronograph: { shotCount: 10, standardDeviation: 4 } },
      {
        entries: planOf([300, 600, 900], []).entries,
        chronograph: { shotCount: 10, standardDeviation: 4 },
      },
    ])
    const width = (i: number) => {
      const iv = find(nth(plans, i).plan, 'dragFactor').interval as { lower: number; upper: number }
      return Math.log(iv.upper / iv.lower)
    }
    expect(width(1)).toBeLessThan(width(0))
  })
})
