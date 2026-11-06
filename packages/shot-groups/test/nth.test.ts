import { expect, it } from 'vitest'
import { nth } from '../src/nth.ts'

it('reads an entry and throws outside the array', () => {
  expect(nth([3, 4], 1)).toBe(4)
  expect(() => nth([3, 4], 2)).toThrow(RangeError)
})
