import { expect, it } from 'vitest'
import { InputError, need, nth } from '../src/errors.ts'

it('raises an English message, or a typed issue whose code is the message', () => {
  const worded = new InputError('the sample needs two values')
  expect([worded.message, worded.issue, worded instanceof RangeError]).toEqual([
    'the sample needs two values',
    undefined,
    true,
  ])
  const issue = { code: 'distances', params: {} }
  expect(() => need(false, issue)).toThrow(expect.objectContaining({ message: 'distances', issue }))
  expect(() => need(true, issue)).not.toThrow()
})

it('returns an entry inside the array and throws for one outside it', () => {
  expect(nth([4, 5], 1)).toBe(5)
  expect(() => nth([4, 5], 2)).toThrow('index 2 outside an array of 2')
  expect(() => nth(new Float64Array(0), -1)).toThrow(RangeError)
})
