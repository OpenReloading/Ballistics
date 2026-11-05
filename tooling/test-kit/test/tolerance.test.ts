import { describe, expect, it } from 'vitest'
import { near, within } from '../src/index.ts'

describe('within', () => {
  it('adds the relative part, scaled by the expected size, to the absolute part', () => {
    expect(within(101, 100, { relative: 0.01 })).toBe(true)
    expect(within(101.1, 100, { relative: 0.01 })).toBe(false)
    expect(within(1e-13, 0, { absolute: 1e-12 })).toBe(true)
    expect(within(1, 1, {})).toBe(true)
    expect(within(1 + 1e-15, 1, {})).toBe(false)
  })
})

describe('near', () => {
  it('matches numbers inside objects and arrays of a toEqual', () => {
    expect({ v: 0.1 + 0.2, list: [1 + 1e-13, 2] }).toEqual({
      v: near(0.3, { absolute: 1e-15 }),
      list: [near(1, { relative: 1e-12 }), near(2, { relative: 0 })],
    })
  })

  it('refuses a number outside the tolerance, a non-finite number and a non-number', () => {
    const m = near(0.3, { absolute: 1e-15 })
    expect(m.asymmetricMatch(0.31)).toBe(false)
    expect(m.asymmetricMatch(Number.NaN)).toBe(false)
    expect(m.asymmetricMatch(Number.POSITIVE_INFINITY)).toBe(false)
    expect(m.asymmetricMatch('0.3')).toBe(false)
    expect(() => expect({ v: 0.31 }).toEqual({ v: m })).toThrow()
    expect(m.toAsymmetricMatcher()).toBe('near(0.3, relative 0, absolute 1e-15)')
  })
})
