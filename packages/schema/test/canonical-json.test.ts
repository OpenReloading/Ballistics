import { expect, it } from 'vitest'
import { canonicalJson } from '../src/canonical-json.ts'

it('sorts the keys at every depth and keeps the order of arrays', () => {
  expect(canonicalJson({ b: [{ d: 1, c: 2 }, 3], a: null })).toBe(
    '{"a":null,"b":[{"c":2,"d":1},3]}',
  )
  expect(canonicalJson({ y: { b: 1, a: 2 }, x: [2, 1] })).toBe(
    canonicalJson({ x: [2, 1], y: { a: 2, b: 1 } }),
  )
})
