import { describe, expect, it } from 'vitest'
import { compareKeys, sortKey } from '../src/index.ts'

const order = (names: string[]) => [...names].sort((a, b) => compareKeys(sortKey(a), sortKey(b)))

describe('sortKey', () => {
  it('orders numbers by value, not by digits', () => {
    expect(order(['10 mm', '9 mm', '100 mm', '.25 ACP'])).toEqual([
      '.25 ACP',
      '9 mm',
      '10 mm',
      '100 mm',
    ])
  })

  it('ignores case and accents', () => {
    expect(order(['b', 'Á', 'a', 'B'])).toEqual(['Á', 'a', 'b', 'B'])
  })

  it('orders by the first name, then the next', () => {
    const keys = [sortKey('b', 'a'), sortKey('a', 'z'), sortKey('a', 'b'), sortKey('a')]
    expect(keys.sort(compareKeys)).toEqual([
      sortKey('a'),
      sortKey('a', 'b'),
      sortKey('a', 'z'),
      sortKey('b', 'a'),
    ])
  })

  it('compares by code unit, the same in every runtime', () => {
    expect(compareKeys('a', 'b')).toBe(-1)
    expect(compareKeys('b', 'a')).toBe(1)
    expect(compareKeys('a', 'a')).toBe(0)
    expect(compareKeys('Z', 'a')).toBe(-1)
  })
})
