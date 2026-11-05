import { describe, expect, it } from 'vitest'
import { near } from '../src/index.ts'

describe('near: the tolerance', () => {
  it('adds the relative part, scaled by the expected size, to the absolute part', () => {
    expect(near(100, { relative: 0.01 }).asymmetricMatch(101)).toBe(true)
    expect(near(100, { relative: 0.01 }).asymmetricMatch(101.1)).toBe(false)
    expect(near(0, { absolute: 1e-12 }).asymmetricMatch(1e-13)).toBe(true)
    expect(near(1, {}).asymmetricMatch(1)).toBe(true)
    expect(near(1, {}).asymmetricMatch(1 + 1e-15)).toBe(false)
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
