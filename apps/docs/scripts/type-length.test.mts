import assert from 'node:assert/strict'
import { test } from 'node:test'
import { maxTypeLength, tooLong } from './type-length.mts'

test('a rendered type of up to 100 characters passes, a longer one fails', () => {
  assert.equal(tooLong('x'.repeat(maxTypeLength)), false)
  assert.equal(tooLong('x'.repeat(maxTypeLength + 1)), true)
})
