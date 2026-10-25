import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import { type Rhs, rk45 } from '../src/index.ts'

const decay: Rhs = (_t, y, dy) => {
  dy[0] = -nth(y, 0)
}
const oscillator: Rhs = (_t, y, dy) => {
  dy[0] = nth(y, 1)
  dy[1] = -nth(y, 0)
}
const options = { relativeTolerance: 1e-8, absoluteTolerance: 1e-10, maxSteps: 10000, maxTime: 5 }

describe('rk45', () => {
  it("keeps the error of y' = -y and of the oscillator near the tolerance", () => {
    let last = Number.POSITIVE_INFINITY
    for (const relativeTolerance of [1e-6, 1e-8, 1e-10]) {
      const a = rk45(decay, 0, Float64Array.of(1), [], {
        ...options,
        relativeTolerance,
        absoluteTolerance: relativeTolerance * 1e-2,
      })
      const b = rk45(oscillator, 0, Float64Array.of(0, 1), [], {
        ...options,
        relativeTolerance,
        absoluteTolerance: relativeTolerance,
      })
      const err = Math.max(
        Math.abs(nth(a.y, 0) - Math.exp(-5)),
        Math.abs(nth(b.y, 0) - Math.sin(5)),
        Math.abs(nth(b.y, 1) - Math.cos(5)),
      )
      expect(a.t).toBe(5)
      expect(err).toBeLessThan(100 * relativeTolerance)
      expect(err).toBeLessThan(last)
      last = err
    }
  })

  it('integrates a quadratic solution exactly, also in the dense output', () => {
    const f: Rhs = (_t, y, dy) => {
      dy[0] = nth(y, 1)
      dy[1] = 2
    }
    const r = rk45(
      f,
      0,
      Float64Array.of(0, 0),
      [{ eventFunction: (_t, y) => nth(y, 0) - 2.25, direction: 1, terminal: false }],
      {
        ...options,
        relativeTolerance: 1e-3,
        absoluteTolerance: 1e-3,
        maxTime: 3,
      },
    )
    expect(r.y[0]).toBeCloseTo(9, 12)
    expect(r.y[1]).toBeCloseTo(6, 12)
    expect(r.hits).toHaveLength(1)
    expect(nth(r.hits, 0).t).toBeCloseTo(1.5, 12)
    expect(nth(r.hits, 0).y[1]).toBeCloseTo(3, 12)
  })

  it('has steps whose local error falls as h^6 (fifth order)', () => {
    const stepError = (h: number) => {
      const r = rk45(decay, 0, Float64Array.of(1), [], {
        relativeTolerance: 1e9,
        absoluteTolerance: 1e9,
        maxSteps: 1,
        maxTime: h,
        initialStep: h,
      })
      return Math.abs(nth(r.y, 0) - Math.exp(-h))
    }
    const order = Math.log2(stepError(0.2) / stepError(0.1))
    expect(order).toBeGreaterThan(5.5)
    expect(order).toBeLessThan(6.5)
  })

  it('has a dense output whose midpoint error falls as h^5', () => {
    const midpointError = (h: number) => {
      const r = rk45(
        decay,
        0,
        Float64Array.of(1),
        [{ eventFunction: (t) => t - h / 2, direction: 1, terminal: false }],
        {
          relativeTolerance: 1e9,
          absoluteTolerance: 1e9,
          maxSteps: 1,
          maxTime: h,
          initialStep: h,
        },
      )
      return Math.abs(nth(nth(r.hits, 0).y, 0) - Math.exp(-h / 2))
    }
    const order = Math.log2(midpointError(0.2) / midpointError(0.1))
    expect(order).toBeGreaterThan(4.5)
    expect(order).toBeLessThan(5.5)
  })

  it('locates a terminal event on sin t', () => {
    const r = rk45(
      oscillator,
      0,
      Float64Array.of(0, 1),
      [{ eventFunction: (_t, y) => nth(y, 0), direction: -1, terminal: true }],
      {
        ...options,
        relativeTolerance: 1e-12,
        absoluteTolerance: 1e-12,
      },
    )
    expect(r.event).toBe(0)
    expect(Math.abs(r.t - Math.PI)).toBeLessThan(1e-10)
  })

  it('drops non-terminal roots after a terminal root in the same step', () => {
    const clock: Rhs = (_t, _y, dy) => {
      dy[0] = 1
    }
    const at = (time: number, terminal: boolean) => ({
      eventFunction: (t: number) => t - time,
      direction: 1 as const,
      terminal,
    })
    const r = rk45(clock, 0, Float64Array.of(0), [at(0.5, false), at(1, true), at(1.01, false)], {
      ...options,
      initialStep: 2,
    })
    expect(r.steps).toBe(1)
    expect(r.event).toBe(1)
    expect(r.t).toBeCloseTo(1, 12)
    expect(r.hits.map((hit) => hit.event)).toEqual([0])
  })

  it('counts the steps of earlier calls against the limit', () => {
    expect(() =>
      rk45(oscillator, 0, Float64Array.of(0, 1), [], { ...options, maxSteps: 10, stepsBefore: 10 }),
    ).toThrow('more than 10 integration steps')
  })

  it('fails instead of looping', () => {
    expect(() =>
      rk45(oscillator, 0, Float64Array.of(0, 1), [], { ...options, maxSteps: 3 }),
    ).toThrow(RangeError)
    const blowUp: Rhs = (_t, y, dy) => {
      dy[0] = nth(y, 0) * nth(y, 0)
    }
    expect(() => rk45(blowUp, 0, Float64Array.of(1), [], { ...options, maxTime: 2 })).toThrow(
      RangeError,
    )
  })
})
