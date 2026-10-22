import { expect, it } from 'vitest'
import { countText, filterText, matchesQuery, sortRows } from '../src/lib/lists.ts'

it('matches every word of the query in any text, ignoring case', () => {
  expect(matchesQuery(['308 Win.', '7,62 x 51'], '308 win')).toBe(true)
  expect(matchesQuery(['308 Win.', '7,62 x 51'], 'win 7,62')).toBe(true)
  expect(matchesQuery(['308 Win.'], 'lapua')).toBe(false)
  expect(matchesQuery(['308 Win.', undefined], '  ')).toBe(true)
})

it('sorts by text or number, missing values last in both orders', () => {
  const rows = [{ v: 'b' }, { v: undefined }, { v: '10 a' }, { v: '9 a' }]
  expect(sortRows(rows, (r) => r.v, 'ascending').map((r) => r.v)).toEqual([
    '9 a',
    '10 a',
    'b',
    undefined,
  ])
  const nums = [{ v: 2 }, { v: undefined }, { v: 1 }]
  expect(sortRows(nums, (r) => r.v, 'descending').map((r) => r.v)).toEqual([2, 1, undefined])
  // a copy: the input keeps its order
  expect(nums.map((r) => r.v)).toEqual([2, undefined, 1])
})

it('counts the rows of a list, naming the total only while a filter hides rows', () => {
  expect(countText(1684, 1684, 'bullets')).toBe('1684 bullets')
  expect(countText(12, 1684, 'bullets')).toBe('12 of 1684 bullets')
  expect(countText(0, 5, 'powders')).toBe('0 of 5 powders')
  expect(countText(1, 1, 'powders')).toBe('1 powder')
  expect(countText(0, 1, 'cartridges')).toBe('0 of 1 cartridge')
})

it('names the filters set as one sentence, nothing when none is set', () => {
  expect(filterText(['caliber .308', 'matching "zz"'])).toBe('Caliber .308, matching "zz".')
  expect(filterText([])).toBe('')
})
