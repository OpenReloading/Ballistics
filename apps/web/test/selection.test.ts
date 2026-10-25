import { expect, it } from 'vitest'
import { pickRange, togglePick } from '../src/lib/selection.ts'

const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }))

it('toggles one id and takes no more than the maximum', () => {
  expect(togglePick(['a'], 'b', 4)).toEqual(['a', 'b'])
  expect(togglePick(['a', 'b'], 'a', 4)).toEqual(['b'])
  expect(togglePick(['a', 'b'], 'c', 2)).toEqual(['a', 'b'])
})

it('ticks the rows between the anchor and the clicked row, downwards and upwards', () => {
  expect(pickRange(rows, ['a'], 'a', 'c', 4)).toEqual(['a', 'b', 'c'])
  expect(pickRange(rows, ['d'], 'd', 'b', 4)).toEqual(['d', 'b', 'c'])
})

it('keeps the ticked rows in the order ticked and adds only the new ones', () => {
  expect(pickRange(rows, ['c', 'a'], 'a', 'd', 5)).toEqual(['c', 'a', 'b', 'd'])
})

it('stops at the maximum', () => {
  expect(pickRange(rows, ['a'], 'a', 'e', 3)).toEqual(['a', 'b', 'c'])
})

it('skips the rows that have no box', () => {
  expect(pickRange(rows, ['a'], 'a', 'd', 4, (r) => r.id !== 'b')).toEqual(['a', 'c', 'd'])
})

it('unticks the range when the clicked row is ticked', () => {
  expect(pickRange(rows, ['a', 'b', 'c', 'e'], 'a', 'c', 4)).toEqual(['e'])
})

it('is a plain toggle without an anchor or when the search hides it', () => {
  expect(pickRange(rows, [], undefined, 'c', 4)).toEqual(['c'])
  expect(pickRange(rows, ['x'], 'x', 'c', 4)).toEqual(['x', 'c'])
  expect(pickRange(rows, ['c'], 'x', 'c', 4)).toEqual([])
})
