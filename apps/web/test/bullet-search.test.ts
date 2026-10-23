import { expect, it } from 'vitest'
import type { BulletRow } from '../src/lib/bullet-rows.ts'
import { type BulletFilters, bulletRelevance, searchBullets } from '../src/lib/bullet-search.ts'

// invented bullets: mass in g (168 gr = 10.886 g), diameter in mm
const row = (over: Partial<BulletRow> & Pick<BulletRow, 'id' | 'name'>): BulletRow => ({
  manufacturer: 'acme',
  manufacturerName: 'Acme Bullets',
  diameter: 7.823,
  mass: 10.886,
  length: null,
  ballisticCoefficientG1: null,
  ballisticCoefficientG7: null,
  ...over,
})

const rows: BulletRow[] = [
  row({ id: 'a-168-match', name: '30 Cal 168 gr Match Hollow Point' }),
  row({ id: 'a-175-match', name: '30 Cal 175 gr Match Hollow Point', mass: 11.34 }),
  row({
    id: 'a-168-tipped',
    name: '30 Cal 168 gr Tipped',
    ballisticCoefficientG7: 0.25,
    ballisticCoefficientG1: 0.5,
  }),
  row({
    id: 'b-140-match',
    manufacturer: 'beta',
    manufacturerName: 'Beta Projectiles',
    manufacturerAliases: ['BP'],
    name: '6.5 mm 140 gr Matchline',
    diameter: 6.718,
    mass: 9.072,
    ballisticCoefficientG7: 0.31,
  }),
  row({ id: 'own-1', origin: 'user', manufacturerName: '', name: 'My 168 gr design' }),
]
const none: BulletFilters = { manufacturer: '', caliber: '', mass: '' }
const ids = (query: string, filters = none, sort?: Parameters<typeof searchBullets>[3]) =>
  searchBullets(rows, query, filters, sort).map((b) => b.id)

it('finds a bullet by caliber and weight although its name says neither as typed', () => {
  // the browser's own design comes first among equals, as in the old picker
  expect(ids('308 168')).toEqual(['own-1', 'a-168-match', 'a-168-tipped'])
  expect(ids('.308 175gr')).toEqual(['a-175-match'])
  expect(ids('10.9g')).toEqual(['own-1', 'a-168-match', 'a-168-tipped'])
})

it('matches words in any order and by the manufacturer alias', () => {
  expect(ids('match acme')).toEqual(['a-168-match', 'a-175-match'])
  expect(ids('bp 6.5')).toEqual(['b-140-match'])
})

it('ranks an exact word and the product name above a word start and the manufacturer', () => {
  const [match, matchline] = [rows[0], rows[3]]
  expect(bulletRelevance(match, 'match')).toBeGreaterThan(bulletRelevance(matchline, 'match'))
  expect(bulletRelevance(rows[3], 'beta')).toBeLessThan(bulletRelevance(rows[3], 'matchline'))
  expect(bulletRelevance(match, '')).toBe(0)
})

it('puts the bullets of the typed weight before other matches of the same word', () => {
  expect(ids('match 175')).toEqual(['a-175-match'])
  expect(ids('hollow 175 gr')[0]).toBe('a-175-match')
})

it('applies the filters before ordering, and the fit and origin filters', () => {
  expect(ids('', { ...none, manufacturer: 'beta' })).toEqual(['b-140-match'])
  expect(ids('', { ...none, caliber: '6.5 mm' })).toEqual(['b-140-match'])
  expect(ids('', { ...none, mass: '170-180gr' })).toEqual(['a-175-match'])
  expect(ids('', { ...none, origin: 'designs' })).toEqual(['own-1'])
  expect(ids('', { ...none, origin: 'catalogue', caliber: '.308' })).toHaveLength(3)
  // land and groove 7.62 and 7.82, G1 7.85: the 6.5 mm bullet does not fit
  const fit = { g1: 7.85, land: 7.62, groove: 7.82 }
  expect(searchBullets(rows, '', { ...none, fit }).map((b) => b.id)).not.toContain('b-140-match')
})

it('sorts by mass or coefficient, rows without a value last', () => {
  expect(ids('', none, 'mass').slice(0, 2)).toEqual(['a-175-match', 'own-1'])
  expect(ids('', none, 'ballisticCoefficient').slice(0, 2)).toEqual(['b-140-match', 'a-168-tipped'])
  expect(ids('', none, 'name')).toEqual([
    'own-1',
    'a-168-match',
    'a-168-tipped',
    'a-175-match',
    'b-140-match',
  ])
})
