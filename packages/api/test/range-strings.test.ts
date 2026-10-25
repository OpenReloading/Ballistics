import {
  comparePlanCandidates,
  fitTruingStrings,
  lbPerSqInToKgPerSqM,
  type Projectile,
  planTruingStrings,
  type TrajectoryInput,
  trajectory,
} from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { caps } from '../src/compute/schemas.ts'
import { rangeStringsLimits } from '../src/compute/strings-schema.ts'
import { API_PREFIX } from '../src/version.ts'
import { defined } from './defined.ts'
import { withApi } from './setup.ts'

const { post } = withApi()
const json = (value: unknown) => JSON.parse(JSON.stringify(value))

const projectile: Projectile = {
  mass: 0.01134,
  diameter: 0.00782,
  length: 0.0312,
  drag: {
    kind: 'bc',
    model: 'G7',
    bands: [{ ballisticCoefficient: 0.3 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
  },
}
const shot: TrajectoryInput = {
  projectile,
  muzzleVelocity: 790,
  firearm: { sightHeight: 0.05 },
  air: { altitude: 0, pressure: 101325, temperature: 288.15, humidity: 0.5 },
  zero: { range: 100 },
}
const clickValue = 0.1e-3
const dispersion = 0.2e-3
const defaults = {
  maxIterations: caps.truingIterations,
  trajectoryOptions: { maxSteps: caps.truingSteps },
}

const candidates = [
  { name: 'one', entries: [{ kind: 'impact' as const, range: 300, shotCount: 5 }] },
  {
    name: 'three',
    entries: [300, 600, 900].map((range) => ({ kind: 'impact' as const, range, shotCount: 5 })),
    chronograph: { shotCount: 10, standardDeviation: 4 },
  },
]

describe('POST /exterior/range-strings/plan', () => {
  const url = `${API_PREFIX}/exterior/range-strings/plan`

  it('returns the core plans of the candidates, infinite numbers as null', async () => {
    const { status, body } = await post(url, { shot, clickValue, dispersion, candidates })
    expect(status).toBe(200)
    expect(body.units.clickValue).toBe('rad')
    expect(body.result).toEqual(
      json(
        comparePlanCandidates({ shot, clickValue, dispersion }, candidates, defaults),
        // a singular plan holds infinite numbers, which JSON writes as null
      ),
    )
    expect(body.result[0].plan.conditionNumber).toBeNull()
    // the single impact distance is singular: its errors and inflation are infinite, the
    // correlations stay finite numbers
    const [velocity] = body.result[0].plan.parameters
    expect(velocity).toMatchObject({
      relativeStandardUncertainty: null,
      varianceInflation: null,
      standardUncertainty: null,
    })
    expect(Object.keys(body.result[0].plan.correlation)).toEqual(['muzzleVelocity:dragFactor'])
    expect(Object.values(body.result[0].plan.correlation).every(Number.isFinite)).toBe(true)
    const statuses = body.result[1].plan.parameters.map((p: { status: string }) => p.status)
    expect(statuses).toEqual(['identified', 'identified', 'unresolved'])
  })

  it('passes the zero offset and the priors on', async () => {
    const options = { fitZeroOffset: true, priors: { zeroOffset: 2e-4, dragFactor: 0.05 } }
    const { status, body } = await post(url, {
      shot,
      clickValue,
      dispersion,
      candidates: candidates.slice(1),
      options,
    })
    expect(status).toBe(200)
    const want = planTruingStrings(
      { shot, clickValue, dispersion, ...defined(candidates[1]) },
      { ...defaults, ...options },
    )
    expect(body.result[0].plan.parameters.map((p: { name: string }) => p.name)).toContain(
      'zeroOffset',
    )
    expect(body.result[0].plan).toEqual(json(want))
  })

  it('answers 400 with the field path', async () => {
    const bad = await post(url, {
      shot,
      clickValue,
      dispersion,
      candidates: [{ entries: [{ kind: 'impact', range: -1, shotCount: 5 }] }],
    })
    expect(bad.status).toBe(400)
    expect(bad.body.issues[0].path).toEqual(['candidates', 0, 'entries', 0, 'range'])
    const many = await post(url, {
      shot,
      clickValue,
      dispersion,
      candidates: Array.from({ length: rangeStringsLimits.candidates + 1 }, () => candidates[1]),
    })
    expect(many.status).toBe(400)
    expect(many.body.issues[0].path).toEqual(['candidates'])
  })

  it('answers 200 with a null posterior error where a singular design has no prior', async () => {
    // one distance, three parameters: the prior on the velocity bounds only the velocity
    const options = { fitZeroOffset: true, priors: { muzzleVelocity: 0.01 } }
    const { status, body } = await post(url, {
      shot,
      clickValue,
      dispersion,
      candidates: candidates.slice(0, 1),
      options,
    })
    expect(status).toBe(200)
    const byName = (name: string) =>
      body.result[0].plan.parameters.find((p: { name: string }) => p.name === name)
    expect(byName('muzzleVelocity').posteriorSigma).toBeGreaterThan(0)
    expect(byName('dragFactor')).toMatchObject({
      posteriorSigma: null,
      relativeStandardUncertainty: null,
    })
    expect(byName('zeroOffset')).toMatchObject({ posteriorSigma: null, standardUncertainty: null })
  })

  it('answers 400 for a zero-offset prior without the option', async () => {
    const { status, body } = await post(url, {
      shot,
      clickValue,
      dispersion,
      candidates,
      options: { priors: { zeroOffset: 1e-4 } },
    })
    expect(status).toBe(400)
    expect(body.issues[0].path).toEqual(['options', 'priors', 'zeroOffset'])
  })

  it('answers 422 for a candidate without entries or chronograph', async () => {
    const { status, body } = await post(url, {
      shot,
      clickValue,
      dispersion,
      candidates: [{ entries: [] }],
    })
    expect(status).toBe(422)
    expect(body.message).toMatch(/entry/)
  })
})

describe('POST /exterior/range-strings/fit', () => {
  const url = `${API_PREFIX}/exterior/range-strings/fit`
  const truth = trajectory({ ...shot, muzzleVelocity: 800 }, [0, 300, 600, 900], {
    relativeTolerance: 1e-10,
    absoluteTolerance: 1e-9,
    zeroTolerance: 1e-9,
  })
  const at = (r: number) => truth.points.find((p) => p.range === r)
  const entries = [300, 600, 900].map((range) => ({
    kind: 'impact' as const,
    range,
    value: (at(range)?.height as number) + 1e-4 * range,
    shotCount: 5,
    standardDeviation: dispersion * range,
  }))
  const chronograph = { mean: at(0)?.velocity as number, shotCount: 10, standardDeviation: 4 }

  it('returns the core fit with the intervals', async () => {
    const options = { fitZeroOffset: true }
    const { status, body } = await post(url, {
      shot,
      clickValue,
      entries,
      chronograph,
      options,
    })
    expect(status).toBe(200)
    const want = fitTruingStrings(
      { shot, clickValue, entries, chronograph },
      { ...defaults, ...options },
    )
    expect(body.result).toEqual(json(want))
    const offset = body.result.parameters.find((p: { name: string }) => p.name === 'zeroOffset')
    expect(offset.status).toBe('identified')
    expect(offset.value).toBeCloseTo(1e-4, 6)
    expect(offset.interval.lower).toBeLessThan(1e-4)
    expect(offset.interval.upper).toBeGreaterThan(1e-4)
  })

  it('names a parameter the data cannot separate and gives it no value', async () => {
    const { status, body } = await post(url, {
      shot,
      clickValue,
      entries: entries.slice(0, 1),
    })
    expect(status).toBe(200)
    const weak = body.result.parameters.filter((p: { status: string }) => p.status !== 'identified')
    expect(weak.length).toBeGreaterThan(0)
    for (const p of weak) expect(p.value).toBeUndefined()
    // the infinite errors and the condition number of the singular design are null
    expect(body.result.conditionNumber).toBeNull()
    expect(body.result.parameters[0]).toMatchObject({
      relativeStandardUncertainty: null,
      varianceInflation: null,
    })
    expect(Object.keys(body.result.correlation)).toEqual(['muzzleVelocity:dragFactor'])
    expect(Object.values(body.result.correlation).every(Number.isFinite)).toBe(true)
  })

  it('answers 400 with the field path', async () => {
    const { status, body } = await post(url, {
      shot,
      clickValue,
      entries: [{ ...entries[0], standardDeviation: 0 }],
    })
    expect(status).toBe(400)
    expect(body.issues[0].path).toEqual(['entries', 0, 'standardDeviation'])
    const caps400 = await post(url, {
      shot,
      clickValue,
      entries: Array.from({ length: rangeStringsLimits.entries + 1 }, () => entries[0]),
    })
    expect(caps400.status).toBe(400)
    const prior = await post(url, { shot, clickValue, entries, options: { priors: { x: 1 } } })
    expect(prior.status).toBe(400)
  })

  it('answers 422 for an impact and a dial entry of one group', async () => {
    const { status, body } = await post(url, {
      shot,
      clickValue,
      entries: [entries[0], { ...entries[0], kind: 'dial', value: 10, standardDeviation: 2 }],
    })
    expect(status).toBe(422)
    expect(body.message).toMatch(/group/)
  })

  it('answers 400 for a zero-offset prior without the option, 200 with it', async () => {
    const priors = { zeroOffset: 1e-4 }
    const { status, body } = await post(url, { shot, clickValue, entries, options: { priors } })
    expect(status).toBe(400)
    expect(body.issues[0].path).toEqual(['options', 'priors', 'zeroOffset'])
    const off = await post(url, {
      shot,
      clickValue,
      entries,
      chronograph,
      options: { priors, fitZeroOffset: false },
    })
    expect(off.status).toBe(400)
    const on = await post(url, {
      shot,
      clickValue,
      entries,
      chronograph,
      options: { priors, fitZeroOffset: true },
    })
    expect(on.status).toBe(200)
  })
})
