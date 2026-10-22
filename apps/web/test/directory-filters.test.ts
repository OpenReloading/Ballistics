import { expect, it } from 'vitest'
import type { PowderSummary } from '../src/lib/api-types.ts'
import {
  type BulletItem,
  bulletMatches,
  bulletSearchText,
  packBullets,
  unpackBullets,
} from '../src/lib/bullet-rows.ts'
import { orderPowders } from '../src/lib/burn-rate.ts'
import {
  type CartridgeRow,
  cartridgeMatches,
  packCartridges,
  unpackCartridges,
} from '../src/lib/cartridge-rows.ts'
import { countryKeys, countryLabel } from '../src/lib/countries.ts'
import {
  convertBulletDiameter,
  convertPressure,
  emptyDirectory,
  numberRange,
  readDirectory,
  writeDirectory,
} from '../src/lib/directory.ts'
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

const s = (over: object) => ({ ...emptyDirectory, ...over })

it('parses a range with or without a unit and none that does not parse', () => {
  expect(numberRange('0.3-0.5', [''])).toEqual({ min: 0.3, max: 0.5, unit: '' })
  expect(numberRange('-0.5', [''])).toEqual({ min: undefined, max: 0.5, unit: '' })
  expect(numberRange('7-8mm', ['in', 'mm'])).toEqual({ min: 7, max: 8, unit: 'mm' })
  expect(numberRange('.28-.31in', ['in', 'mm'])).toEqual({ min: 0.28, max: 0.31, unit: 'in' })
  expect(numberRange('3000-4000psi', ['bar', 'psi'])?.unit).toBe('psi')
  // a unit the filter does not know, no bound, no number
  expect(numberRange('7-8cm', ['in', 'mm'])).toBeUndefined()
  expect(numberRange('-', [''])).toBeUndefined()
  expect(numberRange('.-.', [''])).toBeUndefined()
  expect(numberRange('', [''])).toBeUndefined()
  expect(numberRange('0.3-0.5', ['in', 'mm'])).toBeUndefined()
})

it('shows a bore diameter and a pressure at the rounding of the list', () => {
  expect(convertBulletDiameter(7.85, 'mm', 'in')).toBe(0.309)
  expect(convertBulletDiameter(7.85, 'mm', 'mm')).toBe(7.85)
  expect(convertBulletDiameter(0.3, 'in', 'mm')).toBe(7.62)
  expect(convertPressure(4150, 'bar', 'bar')).toBe(4150)
  expect(convertPressure(4150, 'bar', 'psi')).toBe(60191)
  expect(convertPressure(60000, 'psi', 'bar')).toBe(4137)
})

it('names the countries of a cartridge record by flag code or by name', () => {
  expect(countryKeys('Italy, Germany')).toEqual(['IT', 'DE'])
  // the records print some countries as codes and some twice
  expect(countryKeys('US')).toEqual(['US'])
  expect(countryKeys('Germany, Germany')).toEqual(['DE'])
  // a former state has no flag code: its name
  expect(countryKeys('USSR')).toEqual(['USSR'])
  expect(countryLabel('DE')).toBe('Germany')
  expect(countryLabel('USSR')).toBe('USSR')
})

it('filters bullets by country, tip type and the BC of the drag model shown', () => {
  const r = bullet({ country: 'US', tipType: 'hollow-point' })
  expect(bulletMatches(r, s({ country: 'US' }))).toBe(true)
  expect(bulletMatches(r, s({ country: 'FI' }))).toBe(false)
  expect(bulletMatches(bullet({}), s({ country: 'US' }))).toBe(false)
  expect(bulletMatches(r, s({ tipType: 'hollow-point' }))).toBe(true)
  expect(bulletMatches(r, s({ tipType: 'soft-point' }))).toBe(false)
  expect(bulletMatches(bullet({}), s({ tipType: 'hollow-point' }))).toBe(false)
  const c = bullet({ construction: 'lead-core' })
  expect(bulletMatches(c, s({ construction: 'lead-core' }))).toBe(true)
  expect(bulletMatches(c, s({ construction: 'bonded' }))).toBe(false)
  expect(bulletMatches(bullet({}), s({ construction: 'lead-core' }))).toBe(false)
  // any model shows G7 where given
  expect(bulletMatches(r, s({ ballisticCoefficient: '0.2-0.3' }))).toBe(true)
  expect(bulletMatches(r, s({ ballisticCoefficient: '0.4-0.6' }))).toBe(false)
  expect(bulletMatches(r, s({ ballisticCoefficient: '0.4-0.6', dragModel: 'G1' }))).toBe(true)
  expect(bulletMatches(r, s({ ballisticCoefficient: '0.2-0.3', dragModel: 'G1' }))).toBe(false)
  // the value at the rounding of the column: 0.264 shown lies in 0.26-0.264 and not in 0.27-
  expect(
    bulletMatches(
      bullet({ ballisticCoefficientG7: 0.2644 }),
      s({ ballisticCoefficient: '0.26-0.264' }),
    ),
  ).toBe(true)
  expect(
    bulletMatches(
      bullet({ ballisticCoefficientG7: 0.2644 }),
      s({ ballisticCoefficient: '0.265-' }),
    ),
  ).toBe(false)
  // no coefficient of the model: no match; a bound that does not parse filters nothing
  expect(
    bulletMatches(
      bullet({ ballisticCoefficientG1: null, ballisticCoefficientG7: null }),
      s({ ballisticCoefficient: '0-1' }),
    ),
  ).toBe(false)
  expect(bulletMatches(r, s({ ballisticCoefficient: 'x' }))).toBe(true)
})

it('filters cartridges by country, bore diameter G1 and Pmax in any unit', () => {
  const c = cartridge({ country: 'Germany, Austria' })
  expect(cartridgeMatches(c, s({ country: 'AT' }))).toBe(true)
  expect(cartridgeMatches(c, s({ country: 'DE' }))).toBe(true)
  expect(cartridgeMatches(c, s({ country: 'US' }))).toBe(false)
  expect(cartridgeMatches(cartridge({}), s({ country: 'US' }))).toBe(false)
  expect(cartridgeMatches(c, s({ bulletDiameter: '7.8-7.9mm' }))).toBe(true)
  expect(cartridgeMatches(c, s({ bulletDiameter: '.309-.31in' }))).toBe(true)
  expect(cartridgeMatches(c, s({ bulletDiameter: '.31-.32in' }))).toBe(false)
  expect(
    cartridgeMatches(cartridge({ maxBulletDiameter: undefined }), s({ bulletDiameter: '0-9mm' })),
  ).toBe(false)
  expect(cartridgeMatches(c, s({ pmax: '4000-4200bar' }))).toBe(true)
  expect(cartridgeMatches(c, s({ pmax: '4200-bar' }))).toBe(false)
  expect(cartridgeMatches(c, s({ pmax: '60000-61000psi' }))).toBe(true)
  expect(cartridgeMatches(cartridge({ pmax: undefined }), s({ pmax: '0-9999bar' }))).toBe(false)
})

it('filters powders by country and burn-rate rank', () => {
  const summary = (
    id: string,
    over: Partial<PowderSummary>,
    vivacity: number,
  ): PowderSummary & { manufacturerName: string } => ({
    id,
    manufacturer: 'echo',
    manufacturerName: 'Echo',
    name: id,
    interior: {
      vivacity: { value: vivacity },
      pressureExponent: 1,
      referencePressure: { value: 0.980665 },
      burnForm: { kind: 'twoStage', a: { value: 0 }, m: 0.5, q: 0.5, z1: 0.8 },
    },
    ...over,
  })
  const rows = orderPowders([
    summary('slow', { country: 'FI' }, 0.3),
    summary('fast', { country: 'AU' }, 0.9),
    summary('mid', {}, 0.6),
    { id: 'none', manufacturer: 'm', manufacturerName: 'M', name: 'none' },
  ])
  const ids = (over: object) => rows.filter((r) => powderMatches(r, s(over))).map((r) => r.id)
  expect(ids({ country: 'FI' })).toEqual(['slow'])
  expect(ids({ burnRateOrder: '1-2' })).toEqual(['fast', 'mid'])
  expect(ids({ burnRateOrder: '3-' })).toEqual(['slow'])
  // a powder without a curve has no rank
  expect(ids({ burnRateOrder: '1-99' })).not.toContain('none')
  expect(ids({ burnRateOrder: 'x' })).toContain('none')
})

it('keeps the new filters in the URL after the older ones', () => {
  const state = {
    ...emptyDirectory,
    country: 'FI',
    bulletDiameter: '7-8mm',
    pmax: '3000-4000bar',
    ballisticCoefficient: '0.2-0.3',
    tipType: 'hollow-point',
    construction: 'lead-core',
    burnRateOrder: '1-50',
  }
  const search = writeDirectory(state, '?units=us')
  expect(search).toBe(
    '?units=us&country=FI&bore=7-8mm&pmax=3000-4000bar&bc=0.2-0.3&tipType=hollow-point&construction=lead-core&rank=1-50',
  )
  expect(readDirectory(search)).toEqual(state)
  expect(writeDirectory(emptyDirectory, search)).toBe('?units=us')
})

it('keeps the rows picked for Compare in the URL, in the order picked', () => {
  const state = { ...emptyDirectory, compareIds: 'b-2,user:a1' }
  const search = writeDirectory(state, '')
  expect(search).toBe('?pick=b-2,user%3Aa1')
  expect(readDirectory(search)).toEqual(state)
  // a bullet record's Compare link names one bullet
  expect(readDirectory('?caliber=.308&pick=b-1').compareIds).toBe('b-1')
})

it('packs the country and tip type of the rows and back', () => {
  const bullets = [
    bullet({ country: 'US', tipType: 'soft-point', construction: 'bonded' }),
    bullet({ id: 'y' }),
  ]
  expect(unpackBullets(packBullets(bullets))).toEqual(bullets)
  const cartridges = [cartridge({ country: 'US' }), cartridge({ id: 'y' })]
  expect(unpackCartridges(packCartridges(cartridges))).toEqual(cartridges)
  const powders = orderPowders([
    { id: 'a', manufacturer: 'm', manufacturerName: 'M', name: 'a', country: 'FI' },
  ])
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
  expect(powders.filter((r) => powderMatches(r, s({ query: 'mco' }))).map((r) => r.id)).toEqual([
    'a',
  ])
  expect(unpackPowders(packPowders(powders))).toEqual(powders)
  const bullets = [bullet({ manufacturerAliases: ['MCO'] }), bullet({ id: 'y' })]
  expect(bullets.map((b) => bulletSearchText(b).includes('MCO'))).toEqual([true, false])
  expect(unpackBullets(packBullets(bullets))).toEqual(bullets)
})
