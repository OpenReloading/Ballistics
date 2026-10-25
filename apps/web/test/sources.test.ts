import { fromSi, type UserBullet, type UserCartridge } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import { bulletMatches } from '../src/lib/bullet-rows.ts'
import { searchBullets } from '../src/lib/bullet-search.ts'
import { emptyDirectory, readDirectory, writeDirectory } from '../src/lib/directory.ts'
import { matchesQuery } from '../src/lib/lists.ts'
import {
  countOrigins,
  inOrigins,
  readOrigins,
  toggleOrigin,
  userBulletRows,
  userCartridgeRows,
  userRecordId,
  writeOrigins,
} from '../src/lib/sources.ts'
import type { UserCartridgeView } from '../src/lib/variants.ts'
import { missing } from './defined.ts'
import { resolvedBullet, resolvedCartridge } from './resolved.ts'

const quantityOf = (kind: 'length' | 'mass', si: number | undefined) =>
  si === undefined ? undefined : { value: fromSi(kind, si) }
/** A bullet view with the SI values given as overrides of no base. */
const bullet = (
  id: string,
  si: Record<string, number>,
  manufacturerName = 'Me',
  name = 'Draft',
) => {
  const data: UserBullet = {
    origin: 'user',
    overrides: {
      name,
      ...(si.diameter !== undefined && { diameter: quantityOf('length', si.diameter) }),
      ...(si.mass !== undefined && { mass: quantityOf('mass', si.mass) }),
      ...(si.length !== undefined && { length: quantityOf('length', si.length) }),
    },
  }
  return {
    id,
    name: `${manufacturerName} ${name}`,
    data,
    resolved: resolvedBullet(data),
    manufacturerName,
    si,
  }
}
const cartridge = (id: string, name: string, values: object[]): UserCartridgeView => {
  const data = {
    origin: 'user',
    overrides: { table: 'I', values },
  } as UserCartridge
  return { id, name, data, resolved: resolvedCartridge(data) }
}

it('reads the sources that are on: absent, empty or unknown names mean all', () => {
  expect(readOrigins(undefined)).toEqual(['openreloading', 'user'])
  expect(readOrigins('')).toEqual(['openreloading', 'user'])
  expect(readOrigins('community')).toEqual(['openreloading', 'user'])
  expect(readOrigins('user')).toEqual(['user'])
  expect(readOrigins('user,community')).toEqual(['user'])
  expect(readOrigins('user,openreloading,user')).toEqual(['openreloading', 'user'])
})

it('writes no parameter while all sources are on', () => {
  expect(writeOrigins(['openreloading', 'user'])).toBe('')
  expect(writeOrigins(['user'])).toBe('user')
  expect(writeOrigins(['openreloading'])).toBe('openreloading')
})

it('toggles a source and keeps the last one on', () => {
  expect(toggleOrigin('', 'user')).toBe('openreloading')
  expect(toggleOrigin('openreloading', 'user')).toBe('')
  expect(toggleOrigin('user', 'openreloading')).toBe('')
  expect(toggleOrigin('user', 'user')).toBe('user')
  expect(toggleOrigin('openreloading', 'openreloading')).toBe('openreloading')
})

it('reads, writes and toggles within the sources a list has', () => {
  const powders = ['openreloading'] as const
  expect(readOrigins('user', powders)).toEqual(['openreloading'])
  expect(readOrigins('', powders)).toEqual(['openreloading'])
  expect(writeOrigins(['openreloading'], powders)).toBe('')
  expect(toggleOrigin('', 'openreloading', powders)).toBe('')
  expect(toggleOrigin('user', 'openreloading', powders)).toBe('')
  expect(inOrigins({}, 'user', powders)).toBe(true)
})

it('keeps src in the URL beside the search', () => {
  const s = readDirectory('?src=user&q=alpha&units=us')
  expect(s.sources).toBe('user')
  expect(writeDirectory(s, '?units=us')).toBe('?units=us&q=alpha&src=user')
  expect(writeDirectory({ ...s, sources: '' }, '?src=user')).toBe('?q=alpha')
  expect(writeDirectory(emptyDirectory, '?src=user')).toBe('')
})

it('counts rows per source and filters rows by the sources on', () => {
  const rows = [{ origin: 'user' as const }, {}, {}, { origin: 'user' as const }, {}]
  expect(countOrigins(rows)).toEqual({ openreloading: 3, user: 2 })
  expect(rows.filter((r) => inOrigins(r, 'user'))).toHaveLength(2)
  expect(rows.filter((r) => inOrigins(r, ''))).toHaveLength(5)
  expect(rows.filter((r) => inOrigins(r, 'openreloading'))).toHaveLength(3)
})

it('lists bullet designs as rows in mm and g', () => {
  const rows = userBulletRows([
    bullet('a1', { diameter: 0.007823, mass: 0.010886, length: 0.0315 }, 'Me', 'Test 168'),
  ])
  expect(rows).toHaveLength(1)
  const [r = missing()] = rows
  expect(r).toMatchObject({
    id: 'user:a1',
    manufacturerName: 'Me',
    name: 'Test 168',
    origin: 'user',
  })
  expect(r.diameter).toBeCloseTo(7.823, 9)
  expect(r.mass).toBeCloseTo(10.886, 9)
  expect(r.length).toBeCloseTo(31.5, 9)
  expect(r.ballisticCoefficientG1).toBeNull()
  expect(r.ballisticCoefficientG7).toBeNull()
  expect(userRecordId(r.id)).toBe('a1')
  expect(userRecordId('alpha-30425')).toBeUndefined()
})

it('leaves out a bullet design without a diameter', () => {
  expect(userBulletRows([bullet('a3', { mass: 0.01 })])).toEqual([])
})

it('lists a bullet design without a mass, length or manufacturer name', () => {
  const [r = missing()] = userBulletRows([bullet('a2', { diameter: 0.00782 }, '', 'Plain')])
  expect(r).toMatchObject({ manufacturerName: '', name: 'Plain', mass: null, length: null })
  // no mass: a mass filter hides it, a search for its name finds it
  expect(searchBullets([r], '', { manufacturer: '', caliber: '', mass: '100-200gr' })).toEqual([])
  expect(searchBullets([r], 'plain', { manufacturer: '', caliber: '', mass: '' })).toEqual([r])
})

it('lists cartridge designs with the smallest cartridge G1, L3, L6 and the Pmax', () => {
  const [r] = userCartridgeRows([
    cartridge('c1', 'My .308', [
      { side: 'cartridge', symbol: 'G1', quantity: 'length', value: 7.85 },
      { side: 'cartridge', symbol: 'G1', variant: 'a', quantity: 'length', value: 7.9 },
      { side: 'chamber', symbol: 'G1', quantity: 'length', value: 7.8 },
      { side: 'cartridge', symbol: 'L3', quantity: 'length', value: 51.18 },
      { side: 'cartridge', symbol: 'L6', quantity: 'length', value: 71.12 },
      { symbol: 'Pmax', quantity: 'pressure', value: 4150 },
      { symbol: 'Pmax', variant: 'a', quantity: 'pressure', value: 4000 },
      { side: 'cartridge', symbol: 'L6', variant: 'a', quantity: 'length' },
    ]),
  ])
  expect(r).toEqual({
    id: 'user:c1',
    name: 'My .308',
    aliases: [],
    origin: 'user',
    maxBulletDiameter: 7.85,
    caseLength: 51.18,
    cartridgeLength: 71.12,
    pmax: 4150,
  })
})

it('lists a cartridge design with no values as a name only', () => {
  expect(userCartridgeRows([cartridge('c2', 'Empty', [])])).toEqual([
    { id: 'user:c2', name: 'Empty', aliases: [], origin: 'user' },
  ])
})

it('ignores accents, and with spaces and hyphens removed finds 8x57 in 8 x 57 IS', () => {
  expect(matchesQuery(['8 x 57 IS'], '8x57')).toBe(true)
  expect(matchesQuery(['8 x 57 IS'], '8x57is')).toBe(true)
  expect(matchesQuery(['8 x 57 IS'], '8 x 57')).toBe(true)
  expect(matchesQuery(['7,62 x 51'], '762x51')).toBe(false)
  expect(matchesQuery(['Müller Pulver'], 'muller')).toBe(true)
  expect(matchesQuery(['Müller Pulver'], 'MÜLLER pulver')).toBe(true)
  expect(matchesQuery(['6.5 Creed-moor'], 'creedmoor')).toBe(true)
  expect(matchesQuery(['308 Win.'], 'magnum')).toBe(false)
  // a word of spaces and hyphens only filters nothing more than the empty query
  expect(matchesQuery(['308 Win.'], '- -')).toBe(true)
})

it('folds accents in the bullet search and keeps the word-start rule', () => {
  const b = {
    id: 'x',
    manufacturer: 'foxtrot',
    manufacturerName: 'Foxtrot',
    name: 'Précision',
    diameter: 7.035,
    mass: 17.82,
    length: null,
    ballisticCoefficientG1: null,
    ballisticCoefficientG7: null,
  }
  expect(bulletMatches(b, 'precision')).toBe(true)
})
