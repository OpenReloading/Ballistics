import { describe, expect, it } from 'vitest'
import { identifiability, logLeastSquares } from '../src/least-squares.ts'

describe('shared least-squares loop', () => {
  it('rejects a candidate without a prediction and recovers by raising lambda', () => {
    // y = exp(theta) with observation e: solution theta = 1; trials above 1.5 have no prediction
    const candidates: { trial: number; current: number; ok: boolean }[] = []
    const r = logLeastSquares({
      parameterCount: 1,
      observed: [Math.E],
      standardUncertainty: [1],
      weighted: true,
      floor: [0],
      first: [1],
      predict: ([trial], [current]) => {
        const ok = trial <= 1.5
        // Jacobian calls sit one central-difference step (1e-3) from the accepted iterate
        if (Math.abs(Math.abs(trial - current) - 1e-3) > 1e-12)
          candidates.push({ trial, current, ok })
        return ok ? [Math.exp(trial)] : null
      },
      maxIterations: 50,
      maxCondition: 1e3,
      fail: (reason) => {
        throw new Error(reason)
      },
    })
    expect(Math.abs(r.theta[0] - 1)).toBeLessThan(1e-8)
    const rejected = candidates.filter((c) => !c.ok)
    expect(rejected.length).toBeGreaterThan(0)
    expect(r.iterations).toBeGreaterThan(candidates.length - rejected.length)
    // each candidate is predicted with the accepted iterate as `current`, not with itself
    expect(candidates[0]).toMatchObject({ current: 0, ok: false })
    expect(candidates.find((c) => c.ok)?.current).toBe(0)
  })

  it('reports the weak direction of an ill-conditioned fit', () => {
    // y depends on theta_0 - theta_1 only: J d = 0 for d = (1, 1)/sqrt(2)
    const at = (t: number[]) => [Math.exp(t[0] - t[1]), 2 * Math.exp(t[0] - t[1])]
    let failure: { reason: string; direction?: number[] } | undefined
    try {
      logLeastSquares({
        parameterCount: 2,
        observed: [2, 4],
        standardUncertainty: [1, 1],
        weighted: true,
        floor: [0, 0],
        first: at([0, 0]),
        predict: (trial) => at(trial),
        maxIterations: 10,
        maxCondition: 1e3,
        fail: (reason, _theta, extra) => {
          failure = { reason, direction: extra?.direction }
          throw new Error(reason)
        },
      })
    } catch {}
    expect(failure?.reason).toBe('ill-conditioned')
    const [d0, d1] = failure?.direction ?? []
    expect(Math.abs(Math.abs(d0) - Math.SQRT1_2)).toBeLessThan(1e-9)
    expect(Math.abs(d0 - d1)).toBeLessThan(1e-9)
  })

  it('evaluates a run only for the parameters that move it', () => {
    // run 0: y = exp(t0 + t1); run 1: y = exp(t1); parameter 0 does not move run 1
    const run = (t: number[], k: number) => (k === 0 ? [Math.exp(t[0] + t[1])] : [Math.exp(t[1])])
    const calls: { k: number; moved: number }[] = []
    const r = logLeastSquares({
      parameterCount: 2,
      observed: [Math.E, Math.exp(0.5)],
      standardUncertainty: [1, 1],
      weighted: true,
      floor: [0, 0],
      first: [1, 1],
      predict: (trial, current, k) => {
        if (k === undefined) return [...run(trial, 0), ...run(trial, 1)]
        calls.push({ k, moved: trial.findIndex((x, l) => x !== current[l]) })
        return run(trial, k)
      },
      runs: [1, 1],
      moves: (j, k) => j === 1 || k === 0,
      maxIterations: 50,
      maxCondition: 1e3,
      fail: (reason) => {
        throw new Error(reason)
      },
    })
    expect(Math.abs(r.theta[0] - 0.5)).toBeLessThan(1e-6)
    expect(Math.abs(r.theta[1] - 0.5)).toBeLessThan(1e-6)
    expect(calls.some((c) => c.k === 1 && c.moved === 1)).toBe(true)
    expect(calls.some((c) => c.k === 1 && c.moved === 0)).toBe(false)
  })

  it('reuses the accepted prediction and Jacobian at the solution', () => {
    // y_i = 2 e^t0 exp(-0.3 e^t1 x_i) with fixed noise; the loop ends on a step below 1e-8
    const xs = [0, 1, 2, 3, 4, 5]
    const model = (t: number[]) => xs.map((x) => 2 * Math.exp(t[0] - 0.3 * Math.exp(t[1]) * x))
    const noise = [1, -1, 0.5, -1.5, 0.8, 0.3]
    const observed = model([0.4, -0.2]).map((v, i) => v + 0.01 * noise[i])
    const returned: (readonly number[])[] = []
    let calls = 0
    const r = logLeastSquares({
      parameterCount: 2,
      observed,
      standardUncertainty: xs.map(() => 0.01),
      weighted: true,
      floor: xs.map(() => 0),
      first: model([0, 0]),
      predict: (trial) => {
        calls++
        const p = model(trial)
        returned.push(p)
        return p
      },
      maxIterations: 50,
      maxCondition: 1e3,
      fail: (reason) => {
        throw new Error(reason)
      },
    })
    // measured: 5 accepted candidates and 6 Jacobians of 4 calls; the sixth step is below 1e-8,
    // calls nothing and leaves the Jacobian current, so none is recomputed at the solution
    expect([r.iterations, calls]).toEqual([6, 29])
    expect(returned).toContain(r.predicted)
    expect(r.predicted).toEqual(model(r.theta))
  })
})

describe('identifiability', () => {
  // two unit-variance columns with correlation rho of the information
  const jac = (rho: number) => [
    [1, rho],
    [0, Math.sqrt(1 - rho * rho)],
  ]

  it('gives the two-parameter closed forms', () => {
    const rho = 0.9
    const r = identifiability(jac(rho))
    expect(r.varianceInflation[0]).toBeCloseTo(1 / (1 - rho * rho), 9)
    expect(r.conditionNumber ** 2).toBeCloseTo((1 + rho) / (1 - rho), 9)
    expect(r.correlation[0][1]).toBeCloseTo(-rho, 12)
    expect(r.conditionalSigma).toEqual([1, 1])
    expect(r.standardUncertainty[0]).toBeCloseTo(
      r.conditionalSigma[0] * Math.sqrt(r.varianceInflation[0]),
      12,
    )
  })

  it('gives independent columns unit inflation and a singular matrix a huge one', () => {
    expect(identifiability(jac(0)).varianceInflation).toEqual([1, 1])
    const s = identifiability([[1, 2]])
    expect(s.varianceInflation).toEqual([Infinity, Infinity])
    expect(s.standardUncertainty).toEqual([Infinity, Infinity])
    expect(s.conditionNumber).toBe(Infinity)
    expect(s.correlation.flat().every((x) => Number.isFinite(x))).toBe(true)
  })

  it('leaves a parameter outside the null direction of a singular design finite', () => {
    // columns 0 and 1 are equal, column 2 is orthogonal to them
    const s = identifiability([
      [1, 1, 0],
      [0, 0, 1],
    ])
    expect(s.varianceInflation[0]).toBe(Infinity)
    expect(s.varianceInflation[1]).toBe(Infinity)
    expect(s.varianceInflation[2]).toBeCloseTo(1, 9)
    expect(s.standardUncertainty[2]).toBeCloseTo(1, 9)
    expect(s.conditionNumber).toBe(Infinity)
  })
})
