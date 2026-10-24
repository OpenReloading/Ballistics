import { expect, it } from 'vitest'
import type { BulletRow } from '../src/lib/bullet-rows.ts'
import {
  type BulletFilters,
  bulletRelevance,
  findBullets,
  searchBullets,
} from '../src/lib/bullet-search.ts'

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
  row({ id: 'own-1', origin: 'user', manufacturerName: 'Zed', name: 'My 168 gr design' }),
]
const none: BulletFilters = { manufacturer: '', caliber: '', mass: '' }
const ids = (query: string, filters = none, sort?: Parameters<typeof searchBullets>[3]) =>
  searchBullets(rows, query, filters, sort).map((b) => b.id)

it('finds a bullet by caliber and weight although its name says neither as typed', () => {
  // the browser's own design comes first among equals, whatever manufacturer it names
  expect(ids('308 168')).toEqual(['own-1', 'a-168-match', 'a-168-tipped'])
  expect(ids('.308 175gr')).toEqual(['a-175-match'])
  expect(ids('10.9g')).toEqual(['own-1', 'a-168-match', 'a-168-tipped'])
})

it('finds what the API search of the card missed: words in any order, spacing, a unit apart', () => {
  // a manufacturer and a word of a name that starts with its caliber and weight words
  expect(ids('acme tipped')).toEqual(['a-168-tipped'])
  expect(ids('tipped acme')).toEqual(['a-168-tipped'])
  expect(ids('acme 168')).toEqual(['a-168-match', 'a-168-tipped'])
  expect(ids('308 168gr')).toEqual(['own-1', 'a-168-match', 'a-168-tipped'])
  expect(ids('168 gr')).toEqual(['own-1', 'a-168-match', 'a-168-tipped'])
  expect(ids('30 cal')).toEqual(['a-168-match', 'a-168-tipped', 'a-175-match'])
  // the caliber with or without its space, the decimal comma as a point
  expect(ids('6.5mm')).toEqual(['b-140-match'])
  expect(ids('beta 6,5')).toEqual(['b-140-match'])
})

it('ranks a number at the start of a word above one inside a word', () => {
  const inside = [
    row({ id: 'in', name: 'Plain', diameter: 6.1, mass: 17.82 }),
    row({ id: 'start', name: 'Plain', diameter: 6.1, mass: 7.82 }),
  ]
  // 7.8 in 17.82 g, at the start of 7.82 g
  expect(searchBullets(inside, '7.8', none).map((b) => b.id)).toEqual(['start', 'in'])
})

it('matches a fractional weight at the digits typed', () => {
  const heavy = [row({ id: 'frac', name: 'Heavy', mass: 77.5 * 0.06479891 })]
  expect(searchBullets(heavy, '77.5gr', none).map((b) => b.id)).toEqual(['frac'])
  expect(searchBullets(heavy, '77.6gr', none)).toEqual([])
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
  expect(ids('', none, 'mass').slice(0, 2)).toEqual(['a-175-match', 'a-168-match'])
  expect(ids('', none, 'ballisticCoefficient').slice(0, 2)).toEqual(['b-140-match', 'a-168-tipped'])
  expect(ids('', none, 'name')).toEqual([
    'a-168-match',
    'a-168-tipped',
    'a-175-match',
    'b-140-match',
    'own-1',
  ])
})

it('lists the designs for a first key without reading the catalogue', async () => {
  const designs = rows.filter((r) => r.origin === 'user')
  expect(await findBullets(designs, '', 20)).toEqual({ total: 1, items: designs })
  expect(await findBullets(designs, 'x', 20)).toEqual({ total: 0, items: [] })
})
