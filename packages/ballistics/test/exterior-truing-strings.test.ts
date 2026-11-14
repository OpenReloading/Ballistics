import { InputError, nth } from '@rangefoundry/statistics'
import { describe, expect, it } from 'vitest'
import { minIntervalScale } from '../src/exterior/range-strings.ts'
import {
  type Chronograph,
  fitTruingStrings,
  planTruingStrings,
  TruingError,
  trajectory,
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
  strings as stringsOf,
  tight,
  tolerance,
} from './range-strings-fixtures.ts'

const truth = { v: 1.015, k: 0.96, c: 1.02, offset: 0 }
const base = { ...truth, offset: 0.15e-3 }

/** Strings the solver gives for the true parameters, plus noise from `noise` (none: exact). */
const strings = (noise?: () => number, at = { impacts, dials }) =>
  stringsOf(truth, noise ?? (() => 0), at, !noise)

/** Strings of impacts and dials only, without the chronograph. */
const withoutChronograph = (s: ReturnType<typeof strings>) => ({
  shot: nominal,
  clickValue: click,
  entries: s.entries,
})

/** The relative standard uncertainty of the drag factor a plan of these impacts and a chronograph promises. */
const dragSigmaOf = (entries: { range: number; shotCount: number }[]) =>
  nth(
    planTruingStrings({
      shot: nominal,
      clickValue: click,
      dispersion,
      entries: entries.map((e) => ({ kind: 'impact' as const, ...e })),
      chronograph: { shotCount: 10, standardDeviation: 4 },
    }).parameters,
    1,
  ).relativeStandardUncertainty as number

const impactAt300 = { kind: 'impact' as const, range: 300, shotCount: shots }
const dialAt300 = { kind: 'dial' as const, range: 300, shotCount: shots }

/** The plan of `entries` with a chronograph of 10 shots. */
const planWithChronograph = (entries: Parameters<typeof planTruingStrings>[0]['entries']) =>
  planTruingStrings({
    shot: nominal,
    clickValue: click,
    dispersion,
    entries,
    chronograph: { shotCount: 10, standardDeviation: 4 },
  })

/** Noise-free strings at the impacts, dials and chronograph of the fixtures. */
const exactStrings = strings()
/** The fit of the noise-free strings with `change`, to call later. */
const fitWith = (change: Partial<Parameters<typeof fitTruingStrings>[0]>) => () =>
  fitTruingStrings({ ...exactStrings, ...change })
const firstEntry = nth(exactStrings.entries, 0)

/** The plan of `entries`, with `chronograph` when given. */
const refusalPlan = (
  entries: { kind: 'impact' | 'dial'; range: number; shotCount: number; group?: string }[],
  chronograph?: { shotCount: number; standardDeviation: number },
) =>
  planTruingStrings({
    shot: nominal,
    clickValue: click,
    dispersion,
    entries,
    ...(chronograph ? { chronograph } : {}),
  })
const chrono = { shotCount: 10, standardDeviation: 4 }

describe('range string fit', () => {
  it('recovers the three parameters from exact strings', () => {
    const r = fitTruingStrings(strings())
    expect(r.parameters.map((p) => p.status)).toEqual(['identified', 'identified', 'identified'])
    expect(
      Math.abs((find(r, 'muzzleVelocity').value as number) / (790 * truth.v) - 1),
    ).toBeLessThan(1e-6)
    expect(Math.abs((find(r, 'dragFactor').value as number) / truth.k - 1)).toBeLessThan(1e-6)
    expect(Math.abs((find(r, 'clickValue').value as number) / (click * truth.c) - 1)).toBeLessThan(
      1e-6,
    )
    expect(r.held).toEqual([])
    for (const x of r.residuals) expect(Math.abs(x.standardized)).toBeLessThan(1e-5)
    expect(r.degreesOfFreedom).toBe(4)
    expect(r.consistent).toBe(true)
    // the trued shot carries the fitted velocity and drag
    expect(Math.abs(r.shot.muzzleVelocity / (790 * truth.v) - 1)).toBeLessThan(1e-6)
  })

  it('is deterministic', () => {
    const s = strings(normals(7))
    expect(fitTruingStrings(s)).toEqual(fitTruingStrings(s))
  })

  it('has the plan predict the standard errors the fit reports', () => {
    const plan = planTruingStrings({
      shot: nominal,
      clickValue: click,
      dispersion,
      entries: [...impacts, ...dials].map((range, i) => ({
        kind: i < 3 ? ('impact' as const) : ('dial' as const),
        range,
        shotCount: shots,
      })),
      chronograph: { shotCount: 10, standardDeviation: 4 },
    })
    const fit = fitTruingStrings(strings(normals(3)))
    for (const p of plan.parameters) {
      expect(p.status).toBe('identified')
      const f = find(fit, p.name)
      expect(
        Math.abs(
          (p.relativeStandardUncertainty as number) / (f.relativeStandardUncertainty as number) - 1,
        ),
      ).toBeLessThan(0.1)
    }
    expect(plan.observationCount).toBe(7)
  })
})

describe('range string fit coverage', () => {
  it.each([
    { fit: 'three parameters', options: {}, trueValues: truth },
    { fit: 'with the zero offset', options: { fitZeroOffset: true }, trueValues: base },
  ])(
    'covers the true values with the stated intervals over seeded noise ($fit)',
    ({ options, trueValues }) => {
      const seeds = 300
      const { covered, inconsistent } = coverage(() => trueValues, options, seeds)
      expect(Object.keys(covered)).toEqual([
        'muzzleVelocity',
        'dragFactor',
        'clickValue',
        ...(options.fitZeroOffset ? ['zeroOffset'] : []),
      ])
      // 95 % intervals: 3 binomial standard deviations around 0.95 for 300 seeds
      for (const c of Object.values(covered)) {
        expect(c / seeds).toBeGreaterThan(0.95 - tolerance(seeds))
        expect(c / seeds).toBeLessThan(0.95 + tolerance(seeds))
      }
      // the residual test at 99 % rejects about 1 % of correct fits
      expect(inconsistent / seeds).toBeLessThan(0.01 + 3 * Math.sqrt((0.01 * 0.99) / seeds))
    },
    monteCarloTimeout,
  )
})

describe('intervals conditional on a held parameter', () => {
  // velocity and drag weak, click value identified: the click value is fitted at a nominal velocity
  const layout = { impacts: [300, 600], dials: [450, 750] }
  const wanted = click * truth.c

  it('flags every interval fitted while a weak parameter is held, and no other as conditional', () => {
    const seeds = 200
    let covered = 0
    let coveredChecked = 0
    let checked = 0
    for (let seed = 1; seed <= seeds; seed++) {
      const r = fitTruingStrings(withoutChronograph(strings(normals(seed), layout)))
      const c = find(r, 'clickValue')
      expect(c.status).toBe('identified')
      expect(find(r, 'muzzleVelocity').status).toBe('weak')
      expect(find(r, 'dragFactor').status).toBe('weak')
      expect(c.conditionalOn).toEqual(['muzzleVelocity', 'dragFactor'])
      expect(c.intervalsTrusted).toBe(false)
      expect(r.intervalsTrusted).toBe(false)
      const { lower: low, upper: high } = c.interval as { lower: number; upper: number }
      const hit = low <= wanted && wanted <= high
      if (hit) covered++
      if (r.consistent) {
        checked++
        if (hit) coveredChecked++
      }
    }
    // measured 78 of 200, and 45 of the 108 runs that passed the residual check: far below 95 %
    expect(covered / seeds).toBeLessThan(0.6)
    expect(coveredChecked / checked).toBeLessThan(0.6)
  })

  it('trusts an interval only where nothing with information is held', () => {
    // a chronograph identifies the velocity, and the drag is identified by a far impact
    for (let seed = 1; seed <= 20; seed++) {
      const r = fitTruingStrings(strings(normals(seed)))
      for (const p of r.parameters) {
        expect(p.conditionalOn).toBeUndefined()
        expect(p.intervalsTrusted).toBe(r.consistent !== false)
      }
      expect(r.intervalsTrusted).toBe(r.consistent !== false)
    }
  })

  it('does not count a parameter without information as held', () => {
    // no dial rows: the click value has no information, the other two are identified
    const s = strings(normals(1), { impacts, dials: [] })
    const r = fitTruingStrings(s)
    expect(find(r, 'clickValue').status).toBe('unresolved')
    expect(r.held).toEqual(['clickValue'])
    expect(find(r, 'muzzleVelocity').conditionalOn).toBeUndefined()
    expect(find(r, 'muzzleVelocity').intervalsTrusted).toBe(r.consistent)
  })
})

describe('weakly identified parameters', () => {
  it('names velocity and drag when the strings have one distance', () => {
    const r = fitTruingStrings(
      withoutChronograph(strings(normals(1), { impacts: [300], dials: [] })),
    )
    const v = find(r, 'muzzleVelocity')
    const k = find(r, 'dragFactor')
    for (const p of [v, k]) {
      expect(p.status).toBe('weak')
      expect(p.reasons).toContain('collinear')
      expect(p.value).toBeUndefined()
      expect(p.interval).toBeUndefined()
    }
    expect(find(r, 'clickValue').status).toBe('unresolved')
    expect(r.confounded).toEqual(['muzzleVelocity', 'dragFactor'])
    expect(r.held).toContain('dragFactor')
    expect(v.relativeStandardUncertainty).toBe(Infinity)
    expect(k.relativeStandardUncertainty).toBe(Infinity)
    // the trued shot keeps the nominal values
    expect(r.shot.muzzleVelocity).toBe(790)
  })

  it('names velocity and drag when two impact distances are alike in effect', () => {
    const r = fitTruingStrings(
      withoutChronograph(strings(normals(2), { impacts: [300, 600], dials: [] })),
    )
    expect(find(r, 'muzzleVelocity').status).toBe('weak')
    expect(find(r, 'dragFactor').status).toBe('weak')
    expect(find(r, 'dragFactor').varianceInflation).toBeGreaterThan(10)
    // weak parameters stay at their nominal values in the reported model
    expect(r.held).toEqual(['muzzleVelocity', 'dragFactor', 'clickValue'])
    expect(r.shot.muzzleVelocity).toBe(790)
    expect(r.degreesOfFreedom).toBe(2)
  })

  it('identifies velocity from the chronograph but not drag from one close distance', () => {
    const r = fitTruingStrings(strings(normals(4), { impacts: [150], dials: [] }))
    expect(find(r, 'muzzleVelocity').status).toBe('identified')
    const k = find(r, 'dragFactor')
    expect(k.status).toBe('weak')
    expect(k.reasons).toEqual(['imprecise'])
    expect(k.value).toBeUndefined()
    // the velocity is fitted with the drag held at its nominal value
    expect(find(r, 'muzzleVelocity').conditionalOn).toEqual(['dragFactor'])
    expect(find(r, 'muzzleVelocity').intervalsTrusted).toBe(false)
    expect(r.intervalsTrusted).toBe(false)
    expect(r.consistent).toBe(true)
  })
})

describe('weakly identified parameters in the reported model', () => {
  it('reports the model whose parameters it names: weak ones at nominal, the rest refitted', () => {
    const s = strings(normals(4), { impacts: [150], dials: [] })
    const r = fitTruingStrings(s)
    expect(r.held).toEqual(['dragFactor', 'clickValue'])
    expect(r.degreesOfFreedom).toBe(1)
    expect(r.shot.muzzleVelocity).toBe(find(r, 'muzzleVelocity').value)
    // the residuals and chi-square are those of the reported shot
    const t = trajectory(r.shot, [150, 0], tight)
    const predicted = [t.points.find((p) => p.range === 150)?.height, nth(t.points, 0).velocity]
    for (const [i, x] of r.residuals.entries())
      expect(Math.abs((x.predicted - (predicted[i] as number)) / x.predicted)).toBeLessThan(1e-9)
    expect(r.chiSquare).toBeCloseTo(
      r.residuals.reduce((sum, x) => sum + x.standardized ** 2, 0),
      12,
    )
  })

  it('returns unresolved parameters with the reason when the iteration fails', () => {
    const r = fitTruingStrings(strings(normals(9)), { maxIterations: 1 })
    expect(r.failures).toEqual([
      { reason: 'not-converged', parameters: ['muzzleVelocity', 'dragFactor', 'clickValue'] },
    ])
    for (const p of r.parameters) {
      expect(p.status).toBe('unresolved')
      expect(p.reasons).toEqual(['fit-failed'])
      expect(p.value).toBeUndefined()
      expect(p.interval).toBeUndefined()
    }
    expect(r.held).toEqual(['muzzleVelocity', 'dragFactor', 'clickValue'])
    expect(r.shot.muzzleVelocity).toBe(790)
    expect(r.degreesOfFreedom).toBe(7)
  })
})

describe('weakly identified parameters by the kind of entry', () => {
  it('leaves the click value out when there are no dialed corrections', () => {
    const plan = planTruingStrings({
      shot: nominal,
      clickValue: click,
      dispersion,
      entries: [300, 600, 900].map((range) => ({
        kind: 'impact' as const,
        range,
        shotCount: shots,
      })),
      chronograph: { shotCount: 10, standardDeviation: 4 },
    })
    expect(plan.parameters.map((p) => p.status)).toEqual(['identified', 'identified', 'unresolved'])
    expect(nth(plan.parameters, 2).reasons).toEqual(['no-information'])
  })

  it('reports an impact at the zero range as carrying no information', () => {
    const plan = planTruingStrings({
      shot: nominal,
      clickValue: click,
      dispersion,
      entries: [{ kind: 'impact', range: 100, shotCount: shots }],
    })
    expect(plan.parameters.map((p) => p.status)).toEqual(['unresolved', 'unresolved', 'unresolved'])
  })

  it('flags dialed corrections alone: the click value trades against the velocity', () => {
    const plan = planTruingStrings({
      shot: nominal,
      clickValue: click,
      dispersion,
      entries: dials.map((range) => ({
        kind: 'dial' as const,
        range,
        shotCount: shots,
        rounding: 1,
      })),
    })
    expect(plan.parameters.find((p) => p.name === 'clickValue')?.status).toBe('weak')
    expect(plan.confounded).toContain('clickValue')
    expect(plan.correlation['muzzleVelocity:clickValue']).toBeLessThan(-0.99)
  })
})

describe('weakly identified parameters and more data', () => {
  it('improves with more distances and shots', () => {
    const few = dragSigmaOf([
      { range: 300, shotCount: 3 },
      { range: 600, shotCount: 3 },
    ])
    expect(
      dragSigmaOf([
        { range: 300, shotCount: 12 },
        { range: 600, shotCount: 12 },
      ]),
    ).toBeLessThan(few / 1.9)
    expect(
      dragSigmaOf([
        { range: 300, shotCount: 3 },
        { range: 600, shotCount: 3 },
        { range: 900, shotCount: 3 },
      ]),
    ).toBeLessThan(few)
  })
})

describe('groups of entries', () => {
  it('rejects an impact and a dial entry of one group', () => {
    expect(() => planWithChronograph([impactAt300, dialAt300])).toThrow(
      expect.objectContaining({ issue: { code: 'rangeGroupSharesShots', params: { range: 300 } } }),
    )
    const s = strings(normals(1), { impacts: [300, 600], dials: [300] })
    expect(() => fitTruingStrings(s)).toThrow('rangeGroupSharesShots')
    expect(() => fitTruingStrings(s)).toThrow(InputError)
  })

  it('accepts them when they are named as two groups, and two entries of a kind at one distance', () => {
    expect(() =>
      planWithChronograph([
        { ...impactAt300, group: 'a' },
        { ...dialAt300, group: 'b' },
      ]),
    ).not.toThrow()
    expect(() =>
      planWithChronograph([impactAt300, { ...impactAt300 }, { ...dialAt300, range: 600 }]),
    ).not.toThrow()
    expect(() =>
      planWithChronograph([
        { ...impactAt300, group: 'a' },
        { ...dialAt300, group: 'a' },
      ]),
    ).toThrow(InputError)
  })
})

describe('rounding of dials', () => {
  it('rounds a dial to whole clicks unless told otherwise', () => {
    const entries = [impactAt300, { ...impactAt300, range: 600 }, { ...impactAt300, range: 900 }]
    const clickSigma = (rounding?: number) =>
      nth(
        planWithChronograph([
          ...entries,
          { ...dialAt300, range: 450, rounding },
          { ...dialAt300, range: 800, rounding },
        ]).parameters,
        2,
      ).relativeStandardUncertainty as number
    expect(clickSigma()).toBe(clickSigma(1))
    expect(clickSigma(0)).toBeLessThan(clickSigma())
    expect(clickSigma(2)).toBeGreaterThan(clickSigma())
  })

  it('weights a fitted dial entry with the click rounding by default', () => {
    const s = strings(normals(3))
    const explicit = (rounding: number) => ({
      ...s,
      entries: s.entries.map((e) => (e.kind === 'dial' ? { ...e, rounding } : e)),
    })
    const byDefault = fitTruingStrings(s)
    expect(byDefault).toEqual(fitTruingStrings(explicit(1)))
    expect(
      find(fitTruingStrings(explicit(0)), 'clickValue').relativeStandardUncertainty,
    ).toBeLessThan(find(byDefault, 'clickValue').relativeStandardUncertainty as number)
  })
})

describe('residual check', () => {
  it('rejects strings that disagree with the stated uncertainties', () => {
    const s = strings(normals(5))
    s.entries[1] = {
      ...nth(s.entries, 1),
      value:
        nth(s.entries, 1).value + 20 * (nth(s.entries, 1).standardDeviation / Math.sqrt(shots)),
    }
    const r = fitTruingStrings(s)
    expect(r.consistent).toBe(false)
    expect(r.pValue).toBeLessThan(0.01)
    // the upper tail keeps its size where 1 minus the distribution function is 0
    expect(r.pValue).toBeGreaterThan(0)
    expect(Math.max(...r.residuals.map((x) => Math.abs(x.standardized)))).toBeGreaterThan(3)
  })

  it('marks the intervals as not trusted when the check fails, and scales them on request', () => {
    const s = strings(normals(5))
    s.entries[1] = {
      ...nth(s.entries, 1),
      value:
        nth(s.entries, 1).value + 20 * (nth(s.entries, 1).standardDeviation / Math.sqrt(shots)),
    }
    const r = fitTruingStrings(s)
    expect(r.intervalsTrusted).toBe(false)
    expect(r.intervalScale).toBe(1)
    for (const p of r.parameters) expect(p.intervalsTrusted).toBe(false)
    expect(find(r, 'muzzleVelocity').status).toBe('identified')

    const scaled = fitTruingStrings(s, { scaleByResidual: true })
    expect(scaled.intervalScale).toBeCloseTo(Math.sqrt(r.chiSquare / r.degreesOfFreedom), 12)
    expect(scaled.intervalScale).toBeGreaterThan(2)
    const width = (f: typeof r) => {
      const { lower: low, upper: high } = find(f, 'dragFactor').interval as {
        lower: number
        upper: number
      }
      return Math.log(high / low)
    }
    // Student's t at 4 degrees of freedom: 2.7764 against 1.9600 of the normal
    expect(width(scaled) / width(r)).toBeCloseTo((scaled.intervalScale * 2.77645) / 1.95996, 3)
    expect(scaled.intervalsTrusted).toBe(false)
  })
})

describe('residual check of consistent fits', () => {
  it('trusts the intervals of a consistent fit and leaves them unscaled by default', () => {
    const r = fitTruingStrings(strings(normals(11)))
    expect(r.consistent).toBe(true)
    expect(r.intervalsTrusted).toBe(true)
    expect(r.intervalScale).toBe(1)
    const exact = fitTruingStrings(strings(undefined, { impacts: [900], dials: [] }), {
      scaleByResidual: true,
    })
    expect(exact.degreesOfFreedom).toBe(0)
    expect(exact.intervalScale).toBe(1)
  })

  it('keeps the scaled interval open when the residuals vanish', () => {
    // exact strings leave chi-square at rounding level, far below the clamp
    const r = fitTruingStrings(strings(), { scaleByResidual: true })
    expect(r.degreesOfFreedom).toBe(4)
    expect(r.intervalScale).toBe(minIntervalScale)
    for (const p of r.parameters) {
      const { lower: low, upper: high } = p.interval as { lower: number; upper: number }
      expect(low).toBeLessThan(p.value as number)
      expect(high).toBeGreaterThan(p.value as number)
    }
  })

  it('has no test without degrees of freedom', () => {
    const r = fitTruingStrings(strings(undefined, { impacts: [900], dials: [] }))
    expect(r.degreesOfFreedom).toBe(0)
    expect(r.pValue).toBeUndefined()
    expect(r.consistent).toBeUndefined()
  })
})

describe('errors in the input', () => {
  it('rejects malformed input before any trajectory runs', () => {
    expect(fitWith({ entries: [], chronograph: undefined })).toThrow(InputError)
    expect(fitWith({ entries: [{ ...firstEntry, shotCount: 0 }] })).toThrow(InputError)
    expect(fitWith({ entries: [{ ...firstEntry, shotCount: 2.5 }] })).toThrow(InputError)
    expect(fitWith({ entries: [{ ...firstEntry, range: 0 }] })).toThrow(InputError)
    expect(fitWith({ entries: [{ ...firstEntry, standardDeviation: 0 }] })).toThrow(InputError)
    expect(fitWith({ entries: [{ ...firstEntry, value: Number.NaN }] })).toThrow(InputError)
    expect(fitWith({ entries: [{ ...firstEntry, rounding: -1 }] })).toThrow(InputError)
    expect(fitWith({ clickValue: 0 })).toThrow(InputError)
    expect(fitWith({ chronograph: { mean: 790, shotCount: 5, standardDeviation: -1 } })).toThrow(
      InputError,
    )
    const chronograph: Chronograph = { mean: 790, shotCount: 5, standardDeviation: 4, rounding: -1 }
    expect(fitWith({ chronograph })).toThrow(InputError)
  })

  it('lets the error of an invalid nominal shot through with its message', () => {
    const shot = { ...nominal, projectile: { ...nominal.projectile, mass: -1 } }
    const run = [
      () => fitTruingStrings({ ...exactStrings, shot }),
      () =>
        planTruingStrings({
          shot,
          clickValue: click,
          dispersion,
          entries: [{ kind: 'impact', range: 300, shotCount: shots }],
        }),
    ]
    for (const f of run) {
      expect(f).toThrow('massNotPositive')
      expect(f).not.toThrow(TruingError)
    }
  })

  it('throws TruingError for a range the shot does not reach', () => {
    const vertical = { ...nominal, zero: { elevationAngle: 1.5, windageAngle: 0 } }
    expect(() =>
      fitTruingStrings({
        ...exactStrings,
        shot: vertical,
        entries: [{ ...firstEntry, range: 5000 }],
        chronograph: undefined,
      }),
    ).toThrow(
      expect.objectContaining({
        reason: 'unreachable',
        detail: { code: 'rangeNotReached', params: { range: 5000 } },
      }),
    )
  })
})

describe('errors in the options and plans', () => {
  it('rejects malformed options and plans before any trajectory runs', () => {
    expect(() => fitTruingStrings(exactStrings, { confidenceLevel: 1 })).toThrow(InputError)
    expect(() => fitTruingStrings(exactStrings, { maxInflation: 1 })).toThrow(InputError)
    for (const [name, value] of [
      ['maxCondition', Number.NaN],
      ['maxCondition', Infinity],
      ['maxCondition', 0.5],
      ['maxIterations', 0],
      ['maxIterations', Number.NaN],
      ['maxIterations', Infinity],
      ['maxIterations', 2.5],
      ['residualConfidenceLevel', Number.NaN],
      ['confidenceLevel', Number.NaN],
    ] as const)
      expect(() => fitTruingStrings(exactStrings, { [name]: value })).toThrow(new RegExp(name))
    expect(() =>
      planTruingStrings(
        {
          shot: nominal,
          clickValue: click,
          dispersion,
          entries: [],
          chronograph: { shotCount: 5, standardDeviation: 4, rounding: -1 },
        },
        {},
      ),
    ).toThrow(
      expect.objectContaining({
        issue: { code: 'entryRoundingNegative', params: { kind: 'velocity' } },
      }),
    )
    expect(() =>
      planTruingStrings({
        shot: nominal,
        clickValue: click,
        dispersion: 0,
        entries: [{ kind: 'impact', range: 300, shotCount: shots }],
      }),
    ).toThrow(InputError)
    expect(() =>
      planTruingStrings({ shot: nominal, clickValue: click, dispersion, entries: [] }),
    ).toThrow(InputError)
  })
})

describe('refusals of a plan', () => {
  it('single-range: entries at one distance and no chronograph', () => {
    const p = refusalPlan([
      { kind: 'impact', range: 500, shotCount: 5, group: 'a' },
      { kind: 'dial', range: 500, shotCount: 5, group: 'b' },
    ])
    expect(p.refusals.map((r) => r.id)).toEqual(['single-range'])
    expect(p.refusals.every((r) => r.advice.length > 0)).toBe(true)
    // the statuses agree: the drop leaves velocity and drag factor apart from nothing
    expect(find(p, 'muzzleVelocity').status).not.toBe('identified')
    expect(find(p, 'dragFactor').status).not.toBe('identified')
  })

  it('velocity-only: a chronograph and no entry', () => {
    const p = refusalPlan([], chrono)
    expect(p.refusals.map((r) => r.id)).toEqual(['velocity-only'])
    expect(find(p, 'dragFactor').status).not.toBe('identified')
  })

  it('has no refusal for a string that separates the parameters', () => {
    const two = [
      { kind: 'impact' as const, range: 300, shotCount: 5 },
      { kind: 'impact' as const, range: 900, shotCount: 5 },
    ]
    expect(refusalPlan(two).refusals).toEqual([])
    // a chronograph fixes the velocity, so one distance is enough
    expect(refusalPlan([two[0] as (typeof two)[number]], chrono).refusals).toEqual([])
    expect(
      find(refusalPlan([two[0] as (typeof two)[number]], chrono), 'dragFactor').reasons,
    ).not.toContain('collinear')
  })
})

describe('refusals of a plan and the statuses', () => {
  it('a chronograph with dial entries at one distance leaves drag factor and click value confounded', () => {
    const p = refusalPlan([{ kind: 'dial', range: 500, shotCount: 5 }], chrono)
    expect(p.refusals).toEqual([])
    expect(find(p, 'dragFactor').reasons).toContain('collinear')
    expect(find(p, 'clickValue').reasons).toContain('collinear')
  })

  it('a chronograph at the muzzle alone cannot identify drag factor', () => {
    const p = refusalPlan([], chrono)
    expect(find(p, 'dragFactor').status).toBe('unresolved')
    expect(find(p, 'muzzleVelocity').status).toBe('identified')
  })

  it('two dial entries at two distances pass without refusal and the statuses show what is open', () => {
    const p = refusalPlan([
      { kind: 'dial', range: 300, shotCount: 5 },
      { kind: 'dial', range: 900, shotCount: 5 },
    ])
    expect(p.refusals).toEqual([])
    expect(p.parameters.some((q) => q.status !== 'identified')).toBe(true)
  })

  it('a chronograph and one impact entry leave drag factor and zero offset confounded', () => {
    const p = planTruingStrings(
      {
        shot: nominal,
        clickValue: click,
        dispersion,
        entries: [{ kind: 'impact', range: 500, shotCount: 5 }],
        chronograph: chrono,
      },
      { fitZeroOffset: true },
    )
    expect(p.refusals).toEqual([])
    expect(find(p, 'dragFactor').status).not.toBe('identified')
    expect(find(p, 'zeroOffset').status).not.toBe('identified')
  })
})
