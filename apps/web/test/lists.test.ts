import { expect, it } from 'vitest'
import de from '../src/i18n/de.json'
import { translator } from '../src/i18n/translate.ts'
import {
  countText,
  filterText,
  matchesQuery,
  matchingText,
  sortRows,
  widestCount,
} from '../src/lib/lists.ts'

const english = translator()
const german = translator(de, 'de')

it('matches every word of the query in any text, ignoring case', () => {
  expect(matchesQuery(['308 Win.', '7,62 x 51'], '308 win')).toBe(true)
  expect(matchesQuery(['308 Win.', '7,62 x 51'], 'win 7,62')).toBe(true)
  expect(matchesQuery(['308 Win.'], 'lapua')).toBe(false)
  expect(matchesQuery(['308 Win.', undefined], '  ')).toBe(true)
})

it('matches the words in any order and a number in any of its writings', () => {
  expect(matchesQuery(['308 Win.'], 'win 308')).toBe(true)
  expect(matchesQuery(['308 Win.', '.308 Winchester'], '.308')).toBe(true)
  expect(matchesQuery(['7,62 x 51 NATO'], '7.62x51')).toBe(true)
  expect(matchesQuery(['30-06 Springfield'], '30 06')).toBe(true)
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
  expect(countText(english, 1684, 1684, 'bullets')).toBe('1684 bullets')
  expect(countText(english, 12, 1684, 'bullets')).toBe('12 of 1684 bullets')
  expect(countText(english, 0, 5, 'powders')).toBe('0 of 5 powders')
  expect(countText(english, 1, 1, 'powders')).toBe('1 powder')
  expect(countText(english, 0, 1, 'cartridges')).toBe('0 of 1 cartridge')
})

it('counts in the language shown, with its plural forms', () => {
  expect(countText(german, 1, 1, 'bullets')).toBe('1 Geschoss')
  expect(countText(german, 12, 1684, 'bullets')).toBe('12 von 1684 Geschossen')
  expect(countText(german, 0, 1, 'firearms')).toBe('0 von 1 Schusswaffe')
  expect(widestCount(german, 5, 'cases')).toBe('5 von 5 Hülsen')
})

it('names the search as a filter, nothing for an empty one', () => {
  expect(matchingText(english.t, '  zz ')).toBe('matching "zz"')
  expect(matchingText(english.t, ' ')).toBe(false)
})

it('names the filters set as one sentence, nothing when none is set', () => {
  expect(filterText(['caliber .308', 'matching "zz"'])).toBe('Caliber .308, matching "zz".')
  expect(filterText([])).toBe('')
})
