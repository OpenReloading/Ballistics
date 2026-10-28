import { expect, it } from 'vitest'
import {
  type BulletItem,
  bulletSearchText,
  packBullets,
  unpackBullets,
} from '../src/lib/bullet-rows.ts'
import { orderPowders } from '../src/lib/burn-rate.ts'
import { type CartridgeRow, packCartridges, unpackCartridges } from '../src/lib/cartridge-rows.ts'
import { emptyDirectory, readDirectory, writeDirectory } from '../src/lib/directory.ts'
import {
  manufacturerAliases,
  manufacturerNames,
  withManufacturerName,
} from '../src/lib/manufacturers.ts'
import { packPowders, powderMatches, unpackPowders } from '../src/lib/powder-rows.ts'

const bullet = (over: Partial<BulletItem>): BulletItem => ({
  id: 'x',
  manufacturer: 'bravo',
  manufacturerName: 'Bravo',
  name: 'Ridge',
  diameter: 7.823,
  mass: 10.886,
  length: null,
  ballisticCoefficientG1: 0.51,
  ballisticCoefficientG7: 0.26,
  ...over,
})

const cartridge = (over: Partial<CartridgeRow>): CartridgeRow => ({
  id: '308-win',
  name: '308 Win.',
  aliases: [],
  maxBulletDiameter: 7.85,
  pmax: 4150,
  ...over,
})

it('keeps the search, source, scope and sort in the URL, other parameters untouched', () => {
  const state = {
    ...emptyDirectory,
    query: '168 vld',
    sources: 'user',
    fits: '308-win',
    facets: { org: ['ISSF', 'DSB'], dist: ['25m'] },
    sort: { column: 'mass', dir: 'descending' as const },
  }
  const search = writeDirectory(state, '?units=us')
  expect(search).toBe('?units=us&q=168+vld&src=user&fits=308-win&org=ISSF,DSB&dist=25m&sort=-mass')
  expect(readDirectory(search, ['org', 'dist', 'category'])).toEqual(state)
  // a filter the list does not have is not read, and a filter taken out leaves the URL
  expect(readDirectory(search).facets).toBeUndefined()
  expect(writeDirectory({ ...state, facets: { org: ['ISSF'] } }, search, ['org', 'dist'])).toBe(
    '?units=us&q=168+vld&src=user&fits=308-win&org=ISSF&sort=-mass',
  )
  expect(writeDirectory(emptyDirectory, search, ['org', 'dist'])).toBe('?units=us')
  expect(readDirectory('?sort=name')).toEqual({
    ...emptyDirectory,
    sort: { column: 'name', dir: 'ascending' },
  })
  // a parameter of a removed filter is read as nothing
  expect(readDirectory('?caliber=.308&type=belted')).toEqual(emptyDirectory)
})

it('keeps the rows picked for Compare in the URL, in the order picked', () => {
  const state = { ...emptyDirectory, compareIds: 'b-2,user:a1' }
  const search = writeDirectory(state, '')
  expect(search).toBe('?pick=b-2,user%3Aa1')
  expect(readDirectory(search)).toEqual(state)
  // a bullet record's Compare link names one bullet
  expect(readDirectory('?q=.308&pick=b-1').compareIds).toBe('b-1')
})

it('packs the rows of the lists and back', () => {
  const bullets = [bullet({ manufacturerAliases: ['B'] }), bullet({ id: 'y' })]
  expect(unpackBullets(packBullets(bullets))).toEqual(bullets)
  const cartridges = [cartridge({ aliases: ['x'] }), cartridge({ id: 'y' })]
  expect(unpackCartridges(packCartridges(cartridges))).toEqual(cartridges)
  const powders = orderPowders([{ id: 'a', manufacturer: 'm', manufacturerName: 'M', name: 'a' }])
  expect(unpackPowders(packPowders(powders))).toEqual(powders)
})

it('finds a powder and a bullet by an alias of the manufacturer and packs the aliases', () => {
  const items = [
    { id: 'a', manufacturer: 'm', name: 'a' },
    { id: 'b', manufacturer: 'n', name: 'b' },
  ]
  const named = withManufacturerName(
    items,
    manufacturerNames([
      { id: 'm', name: 'Maker Co.', aliases: ['MCO'] },
      { id: 'n', name: 'Other' },
    ]),
    manufacturerAliases([
      { id: 'm', name: 'Maker Co.', aliases: ['MCO'] },
      { id: 'n', name: 'Other' },
    ]),
  )
  expect(named.map((r) => r.manufacturerAliases)).toEqual([['MCO'], undefined])
  const powders = orderPowders(named)
  expect(powders.filter((r) => powderMatches(r, 'mco')).map((r) => r.id)).toEqual(['a'])
  expect(unpackPowders(packPowders(powders))).toEqual(powders)
  const bullets = [bullet({ manufacturerAliases: ['MCO'] }), bullet({ id: 'y' })]
  expect(bullets.map((b) => bulletSearchText(b).includes('MCO'))).toEqual([true, false])
  expect(unpackBullets(packBullets(bullets))).toEqual(bullets)
})
