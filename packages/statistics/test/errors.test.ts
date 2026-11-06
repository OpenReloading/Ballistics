import { expect, it } from 'vitest'
import { InputError, need } from '../src/errors.ts'

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
