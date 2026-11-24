import { expect, it } from 'vitest'
import { parseSearch, stringifySearch } from '../src/routes/-search.ts'

it('keeps numeric-looking values as typed through a read and a write', () => {
  const search = '?q=6.50&x=1e3&sort=-name&pick=007'
  expect(parseSearch(search)).toEqual({ q: '6.50', x: '1e3', sort: '-name', pick: '007' })
  expect(stringifySearch(parseSearch(search))).toBe(search)
})

it('keeps every value of a repeated key through a read and a write', () => {
  expect(parseSearch('?q=a&q=b')).toEqual({ q: ['a', 'b'] })
  expect(stringifySearch(parseSearch('?q=a&q=b'))).toBe('?q=a&q=b')
})

it('reads an empty query as no keys', () => {
  expect(parseSearch('')).toEqual({})
  expect(stringifySearch({})).toBe('')
})
