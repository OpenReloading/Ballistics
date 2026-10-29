import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'

describe('nth', () => {
  it('returns an entry inside the array and throws for one outside it', () => {
    expect(nth([4, 5], 1)).toBe(5)
    expect(() => nth([4, 5], 2)).toThrow('index 2 outside an array of 2')
    expect(() => nth(new Float64Array(0), -1)).toThrow(RangeError)
  })
})
