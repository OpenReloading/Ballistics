import { describe, expect, it } from 'vitest'
import { chargeLadder, InputError } from '../src/index.ts'

describe('chargeLadder', () => {
  it('steps up from the start charge', () => {
    const c = chargeLadder(0.0029, 0.0001, 5, 'up')
    const want = [0.0029, 0.003, 0.0031, 0.0032, 0.0033]
    expect(c).toHaveLength(5)
    for (const [i, v] of c.entries()) expect(v).toBeCloseTo(want[i], 15)
  })

  it('steps down from the start charge', () => {
    const c = chargeLadder(0.0029, 0.0001, 3, 'down')
    for (const [i, v] of [0.0029, 0.0028, 0.0027].entries())
      expect(Math.abs(c[i] - v) / v).toBeLessThan(1e-15)
  })

  it('multiplies the step, so the last charge is start plus (n - 1) steps', () => {
    expect(chargeLadder(0.001, 0.0001, 5, 'up')[4]).toBe(0.001 + 4 * 0.0001)
  })

  it('centres an odd count on the start charge, lowest first', () => {
    const c = chargeLadder(0.0029, 0.0001, 5, 'around')
    for (const [i, v] of [0.0027, 0.0028, 0.0029, 0.003, 0.0031].entries())
      expect(Math.abs(c[i] - v) / v).toBeLessThan(1e-14)
    expect(c[2]).toBe(0.0029)
  })

  it('gives the start charge alone for one step', () => {
    expect(chargeLadder(0.0029, 0.0001, 1, 'down')).toEqual([0.0029])
  })

  it.each([
    [0, 0.0001, 2, 'up'],
    [Number.NaN, 0.0001, 2, 'up'],
    [0.0029, 0, 2, 'up'],
    [0.0029, Number.POSITIVE_INFINITY, 2, 'up'],
    [0.0029, 0.0001, 0, 'up'],
    [0.0029, 0.0001, 2.5, 'up'],
    [0.0002, 0.0001, 3, 'down'],
    [0.0029, 0.0001, 4, 'around'],
    [0.0001, 0.0001, 3, 'around'],
  ] as const)('rejects start %s, step %s, %s steps %s', (start, step, steps, direction) => {
    expect(() => chargeLadder(start, step, steps, direction)).toThrow(InputError)
  })
})
