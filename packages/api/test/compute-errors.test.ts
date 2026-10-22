import {
  comparePlanCandidates,
  fitTruingStrings,
  InputError,
  trajectory,
  trueMuzzleVelocity,
} from '@openreloading/core'
import { describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.ts'
import { caps } from '../src/compute/schemas.ts'
import { ComputeBusy, inlineRunner } from '../src/compute/tasks.ts'
import { API_PREFIX } from '../src/version.ts'
import { m3Load, flatShot as shot } from './fixtures.ts'
import { withApi } from './setup.ts'

// millerStability by velocity: 1 throws an engine RangeError, 2 an InputError, 3 returns NaN
vi.mock('@openreloading/core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@openreloading/core')>()
  return {
    ...core,
    millerStability: (input: Parameters<typeof core.millerStability>[0]) => {
      if (input.velocity === 1) throw new RangeError('Invalid array length')
      if (input.velocity === 2) throw new core.InputError('velocity 2')
      if (input.velocity === 3) return Number.NaN
      return core.millerStability(input)
    },
    trajectory: vi.fn(core.trajectory),
    trueMuzzleVelocity: vi.fn(core.trueMuzzleVelocity),
    comparePlanCandidates: vi.fn(core.comparePlanCandidates),
    fitTruingStrings: vi.fn(core.fitTruingStrings),
  }
})

// in-process tasks, so the core mock applies (a worker would load the real core)
const api = withApi({ seed: false, compute: inlineRunner })

const stability = async (velocity: number) => {
  const res = await api.app.inject({
    method: 'GET',
    url: `${API_PREFIX}/exterior/stability?mass=0.01&diameter=0.0078&length=0.031&twist=0.254&muzzleVelocity=${velocity}`,
  })
  return { status: res.statusCode, body: res.json() }
}

describe('compute error mapping', () => {
  it('answers 500 without the error text for a RangeError core did not raise on purpose', async () => {
    const { status, body } = await stability(1)
    expect(status).toBe(500)
    expect(body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'internal server error',
      requestId: expect.any(String),
    })
  })

  it('answers 422 for an InputError', async () => {
    expect(new InputError('x')).toBeInstanceOf(RangeError)
    const { status, body } = await stability(2)
    expect(status).toBe(422)
    expect(body).toEqual({ statusCode: 422, error: 'Unprocessable Entity', message: 'velocity 2' })
  })

  it('answers 422 for a NaN outside the documented NaN fields', async () => {
    const { status, body } = await stability(3)
    expect(status).toBe(422)
    expect(body.message).toBe('result holds a non-finite number at result')
  })
})

describe('truing work bound', () => {
  const truing = (options?: object) =>
    api.app.inject({
      method: 'POST',
      url: `${API_PREFIX}/exterior/truing`,
      payload: {
        shot,
        observations: [{ kind: 'height', range: 300, value: -0.3 }],
        fit: { kind: 'muzzleVelocity' },
        ...(options && { options }),
      },
    })

  it('passes the iteration cap and the step total to core as defaults', async () => {
    const res = await truing()
    expect(res.statusCode).toBe(200)
    expect(vi.mocked(trueMuzzleVelocity).mock.lastCall?.[2]).toEqual({
      maxSteps: caps.truingSteps,
      maxIterations: caps.truingIterations,
      maxTotalSteps: caps.truingTotalSteps,
    })
    expect(res.json().result.steps).toBeGreaterThan(0)
  })

  it('rejects maxIterations above the cap', async () => {
    const res = await truing({ maxIterations: caps.truingIterations + 1 })
    expect(res.statusCode).toBe(400)
    expect(res.json().issues[0].path).toEqual(['options', 'maxIterations'])
  })
})

describe('NaN result fields', () => {
  const { post } = api
  const nanDrift = () => ({ points: [{ range: 100, spinDrift: Number.NaN }] }) as never

  it('writes NaN spinDrift as null for the modified point mass only', async () => {
    vi.mocked(trajectory).mockImplementationOnce(nanDrift)
    const mpm = await post(`${API_PREFIX}/exterior/trajectory`, {
      shot,
      ranges: [100],
      options: { model: 'modified-point-mass' },
    })
    expect(mpm.status).toBe(200)
    expect(mpm.body.result.points[0].spinDrift).toBeNull()
    vi.mocked(trajectory).mockImplementationOnce(nanDrift)
    const pm = await post(`${API_PREFIX}/exterior/trajectory`, { shot, ranges: [100] })
    expect(pm.status).toBe(422)
    expect(pm.body.message).toBe('result holds a non-finite number at result.points.0.spinDrift')
  })

  it('writes NaN truing standard uncertainty and correlation as null', async () => {
    vi.mocked(trueMuzzleVelocity).mockImplementationOnce(
      () =>
        ({
          parameters: [
            { name: 'muzzleVelocity', initial: 800, value: 800, standardUncertainty: Number.NaN },
          ],
          correlation: [[Number.NaN]],
          chiSquare: 0,
        }) as never,
    )
    const res = await post(`${API_PREFIX}/exterior/truing`, {
      shot,
      observations: [{ kind: 'height', range: 300, value: -0.3 }],
      fit: { kind: 'muzzleVelocity' },
    })
    expect(res.status).toBe(200)
    expect(res.body.result.parameters[0].standardUncertainty).toBeNull()
    expect(res.body.result.correlation).toEqual([[null]])
  })
})

describe('non-finite fields of the range strings routes', () => {
  const { post } = api
  const strings = { shot, clickValue: 1e-4 }
  const planBody = {
    ...strings,
    dispersion: 2e-4,
    candidates: [{ entries: [{ kind: 'impact', range: 300, shotCount: 5 }] }],
  }
  const fitBody = {
    ...strings,
    entries: [{ kind: 'impact', range: 300, value: -0.3, shotCount: 5, standardDeviation: 0.01 }],
  }
  const parameter = { name: 'dragFactor', status: 'weak', reasons: ['collinear'] }
  const planResult = (p: object, extra: object = {}) =>
    [
      {
        shotCount: 5,
        plan: { parameters: [{ ...parameter, ...p }], conditionNumber: Infinity, ...extra },
      },
    ] as never
  const fitResult = (p: object, extra: object = {}) =>
    ({
      parameters: [{ ...parameter, ...p }],
      conditionNumber: Infinity,
      chiSquare: 0,
      ...extra,
    }) as never

  it('writes the infinite numbers of a singular design as null', async () => {
    const infinite = {
      relativeStandardUncertainty: Infinity,
      varianceInflation: Infinity,
      standardUncertainty: Infinity,
      posteriorSigma: Infinity,
      prior: { sigma: 0.05, ratio: Infinity },
    }
    vi.mocked(comparePlanCandidates).mockImplementationOnce(() => planResult(infinite))
    const planned = await post(`${API_PREFIX}/exterior/range-strings/plan`, planBody)
    expect(planned.status).toBe(200)
    expect(planned.body.result[0].plan.conditionNumber).toBeNull()
    expect(planned.body.result[0].plan.parameters[0]).toEqual({
      ...parameter,
      relativeStandardUncertainty: null,
      varianceInflation: null,
      standardUncertainty: null,
      posteriorSigma: null,
      prior: { sigma: 0.05, ratio: null },
    })
    vi.mocked(fitTruingStrings).mockImplementationOnce(() => fitResult(infinite))
    const fitted = await post(`${API_PREFIX}/exterior/range-strings/fit`, fitBody)
    expect(fitted.status).toBe(200)
    expect(fitted.body.result.conditionNumber).toBeNull()
    expect(fitted.body.result.parameters[0].posteriorSigma).toBeNull()
  })

  it('answers 422 for a non-finite number at any other path', async () => {
    const message = (path: string) => `result holds a non-finite number at ${path}`
    vi.mocked(comparePlanCandidates).mockImplementationOnce(() =>
      planResult({ interval: { lower: 1, upper: Infinity, confidenceLevel: 0.95 } }),
    )
    const planned = await post(`${API_PREFIX}/exterior/range-strings/plan`, planBody)
    expect(planned.status).toBe(422)
    expect(planned.body.message).toBe(message('result.0.plan.parameters.0.interval.upper'))
    vi.mocked(comparePlanCandidates).mockImplementationOnce(() =>
      planResult({}, { correlation: { 'a:b': Infinity } }),
    )
    const correlated = await post(`${API_PREFIX}/exterior/range-strings/plan`, planBody)
    expect(correlated.status).toBe(422)
    expect(correlated.body.message).toBe(message('result.0.plan.correlation.a:b'))
    vi.mocked(fitTruingStrings).mockImplementationOnce(() => fitResult({}, { chiSquare: Infinity }))
    const fitted = await post(`${API_PREFIX}/exterior/range-strings/fit`, fitBody)
    expect(fitted.status).toBe(422)
    expect(fitted.body.message).toBe(message('result.chiSquare'))
    vi.mocked(fitTruingStrings).mockImplementationOnce(() => fitResult({ value: Infinity }))
    expect((await post(`${API_PREFIX}/exterior/range-strings/fit`, fitBody)).body.message).toBe(
      message('result.parameters.0.value'),
    )
  })
})

describe('charge ladder on a full pool', () => {
  it('answers the whole ladder with 503 busy when a step is refused', async () => {
    let calls = 0
    // the first step runs, the next ones find the queue full
    const busy = buildApp({
      db: api.db,
      compute: {
        run: (task) => {
          calls += 1
          if (calls > 1) return Promise.reject(new ComputeBusy('all compute workers are busy', 5))
          return inlineRunner.run(task)
        },
        close: async () => {},
      },
    })
    const res = await busy.inject({
      method: 'POST',
      url: `${API_PREFIX}/interior`,
      payload: { model: 'm3', load: m3Load, ladder: { chargeStep: 0.0001, stepCount: 3 } },
    })
    await busy.close()
    expect(res.statusCode).toBe(503)
    expect(res.headers['retry-after']).toBe('5')
    expect(res.json()).toMatchObject({ reason: 'busy', notice: 'simulation, not load data' })
  })
})

describe('charge ladder bounds', () => {
  it('starts no batch that could end after the budget: 503 timeout', async () => {
    let calls = 0
    const clock = vi.spyOn(Date, 'now')
    let now = 1_000_000
    clock.mockImplementation(() => now)
    // each batch "takes" 6 s: after the first two the next one could end past 14 s
    const slow = buildApp({
      db: api.db,
      compute: {
        run: async (task) => {
          calls += 1
          const result = await inlineRunner.run(task)
          now += 1500
          return result
        },
        close: async () => {},
      },
    })
    const res = await slow.inject({
      method: 'POST',
      url: `${API_PREFIX}/interior`,
      payload: { model: 'm3', load: m3Load, ladder: { chargeStep: 0.00002, stepCount: 21 } },
    })
    clock.mockRestore()
    await slow.close()
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ reason: 'timeout', notice: 'simulation, not load data' })
    // batches of 4 at 0 s and 6 s ran; the one at 12 s would end at 17 s and was not started
    expect(calls).toBe(8)
  })

  it('refuses a ladder whose output is above five runs at the point cap, without its later batches', async () => {
    let calls = 0
    const wide = buildApp({
      db: api.db,
      compute: {
        run: async (task) => {
          calls += 1
          const result = (await inlineRunner.run(task)) as { result?: { points: unknown[] } }
          // each step as long as 30000 points
          if (result.result)
            result.result.points = Array.from({ length: 30000 }, () => result.result?.points[0])
          return result as never
        },
        close: async () => {},
      },
    })
    const res = await wide.inject({
      method: 'POST',
      url: `${API_PREFIX}/interior`,
      payload: { model: 'm3', load: m3Load, ladder: { chargeStep: 0.00002, stepCount: 21 } },
    })
    await wide.close()
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({
      reason: 'outputTooLarge',
      notice: 'simulation, not load data',
    })
    // the first batch of 4 is above the cap of 100000 points
    expect(calls).toBe(4)
  })
})
