import { near } from '@rangefoundry/test-kit'
import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import { type LogFitInput, logLeastSquares } from '../src/least-squares.ts'

/** The failure a fit reports, thrown on as an error with its reason and details. */
class FitFailure extends Error {
  readonly reason: string
  readonly extra: object | undefined

  constructor(reason: string, extra: object | undefined) {
    super(reason)
    this.reason = reason
    this.extra = extra
  }
}

/** Two observations of y = e^(t0 + x t1) at x = 0 and 1, weighted, with `change` applied. */
const lineFit = (change: Partial<LogFitInput>): LogFitInput => ({
  parameterCount: 2,
  observed: [Math.E, Math.exp(1.5)],
  standardUncertainty: [1, 1],
  weighted: true,
  floor: [0, 0],
  first: [1, 1],
  predict: (theta) => [0, 1].map((x) => Math.exp(nth(theta, 0) + x * nth(theta, 1))),
  maxIterations: 50,
  maxCondition: 1e6,
  fail: (reason, _theta, extra) => {
    throw new FitFailure(reason, extra)
  },
  ...change,
})

/** Three observations of y = e^(t0 + x t1) at x = 0, 1 and 2, off the line. */
const threeObserved = [Math.E, Math.exp(1.5), Math.exp(2.1)]
const threePoints = (theta: number[]) =>
  [0, 1, 2].map((x) => Math.exp(nth(theta, 0) + x * nth(theta, 1)))

/** The fit of `threePoints` to `threeObserved`, with or without their standard uncertainties. */
const threePointFit = (weighted: boolean) =>
  logLeastSquares(
    lineFit({
      observed: threeObserved,
      predict: threePoints,
      first: [1, 1, 1],
      floor: [0, 0, 0],
      standardUncertainty: [1, 1, 1],
      weighted,
    }),
  )

const failureOf = (fit: LogFitInput) => {
  try {
    logLeastSquares(fit)
  } catch (error) {
    if (error instanceof FitFailure) return error
    throw error
  }
  throw new Error('the fit did not fail')
}

describe('shared least-squares loop: failures', () => {
  it('fails as unreachable where the Jacobian has no prediction', () => {
    const fit = lineFit({ predict: (theta) => (nth(theta, 0) === 0 ? [1, 1] : null) })
    expect(failureOf(fit).reason).toBe('unreachable')
  })

  it('names a parameter that moves no prediction as unresolved', () => {
    const fit = lineFit({ predict: (theta) => [1, 1].map(() => Math.exp(nth(theta, 0))) })
    const failure = failureOf(fit)
    expect(failure.reason).toBe('unresolved')
    expect(failure.extra).toEqual({ unresolved: [1] })
  })

  it('fails as not converged once the iterations reach the limit', () => {
    expect(failureOf(lineFit({ maxIterations: 1 })).reason).toBe('not-converged')
  })
})

describe('shared least-squares loop: covariance', () => {
  it('scales the covariance of an unweighted fit by its residual variance', () => {
    const unweighted = threePointFit(false)
    const scale = unweighted.loss / (threeObserved.length - 2)
    const expected = defined(threePointFit(true).covariance).map((row) =>
      row.map((x) => near(scale * x, { relative: 1e-9 })),
    )
    expect(unweighted.covariance).toEqual(expected)
  })

  it('leaves the covariance out of an unweighted fit without residual degrees of freedom', () => {
    const r = logLeastSquares(lineFit({ weighted: false }))
    expect(r.covariance).toBeUndefined()
    expect(r.standardUncertainty).toBeUndefined()
  })
})

function defined<T>(x: T | undefined): T {
  if (x === undefined) throw new Error('expected a value')
  return x
}
