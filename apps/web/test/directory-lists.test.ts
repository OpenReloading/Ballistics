import { expect, it } from 'vitest'
import type { PowderSummary } from '../src/lib/api-types.ts'
import {
  classifyPowder,
  isFitted,
  orderPowders,
  overlayFrom,
  overlayHref,
  type PowderRow,
  type UnfittedPowder,
  unfittedGroups,
} from '../src/lib/burn-rate.ts'
import {
  type CartridgeRow,
  cartridgeCells,
  cartridgeMatches,
  packCartridges,
  unpackCartridges,
} from '../src/lib/cartridge-rows.ts'
import { emptyDirectory, readDirectory, writeDirectory } from '../src/lib/directory.ts'
import { packPowders, powderMatches, unpackPowders } from '../src/lib/powder-rows.ts'
import { presetUnits } from '../src/lib/units.ts'

const c = (over: Partial<CartridgeRow>): CartridgeRow => ({
  id: '308-win',
  name: '308 Win.',
  aliases: ['7,62 x 51'],
  maxBulletDiameter: 7.85,
  caseLength: 51.18,
  cartridgeLength: 71.12,
  pmax: 4150,
  caseType: 'rimless',
  ...over,
})

it('filters cartridges by case type, common caliber and words of name, aliases and caliber', () => {
  const s = (over: object) => ({ ...emptyDirectory, ...over })
  expect(cartridgeMatches(c({}), s({ query: '7,62 51' }))).toBe(true)
  expect(cartridgeMatches(c({}), s({ query: 'lapua' }))).toBe(false)
  expect(cartridgeMatches(c({}), s({ caseType: 'rimmed' }))).toBe(false)
  expect(cartridgeMatches(c({}), s({ caseType: 'rimless' }))).toBe(true)
  // the common caliber of the G1, whatever the preset
  expect(cartridgeMatches(c({}), s({ caliber: '.308' }))).toBe(true)
  expect(cartridgeMatches(c({}), s({ caliber: '.311' }))).toBe(false)
  expect(cartridgeMatches(c({ maxBulletDiameter: undefined }), s({ caliber: '.308' }))).toBe(false)
  // the search finds the common caliber and the G1 in both units
  for (const q of ['.308', '7.85', '.309', '6.5'])
    expect(cartridgeMatches(c({}), s({ query: q })), q).toBe(q !== '6.5')
  expect(cartridgeMatches(c({ maxBulletDiameter: 6.72 }), s({ query: '6.5 mm' }))).toBe(true)
})

it('gives the cartridge cells in the preset units', () => {
  expect(cartridgeCells(c({}), presetUnits('metric-grams'))).toEqual({
    caliber: '.308',
    maxBulletDiameter: '7.85',
    caseLength: '51.18',
    cartridgeLength: '71.12',
    pmax: '4150',
  })
  expect(cartridgeCells(c({}), presetUnits('us'))).toEqual({
    caliber: '.308',
    maxBulletDiameter: '.309',
    caseLength: '2.015',
    cartridgeLength: '2.800',
    pmax: '60191',
  })
  expect(
    cartridgeCells(
      c({
        maxBulletDiameter: undefined,
        caseLength: undefined,
        cartridgeLength: undefined,
        pmax: undefined,
      }),
      presetUnits('us'),
    ),
  ).toEqual({ caliber: '', maxBulletDiameter: '', caseLength: '', cartridgeLength: '', pmax: '' })
})

it('drops the leading zero of inch cells and prints a zero as 0', () => {
  const us = presetUnits('us')
  expect(
    cartridgeCells(c({ maxBulletDiameter: 0, caseLength: 12, cartridgeLength: 0.01 }), us),
  ).toMatchObject({
    maxBulletDiameter: '0',
    caseLength: '.472',
    cartridgeLength: '0',
  })
})

it('packs cartridges without key names and back', () => {
  const rows = [
    c({}),
    c({
      id: 'x',
      aliases: [],
      maxBulletDiameter: undefined,
      cartridgeLength: undefined,
      caseType: undefined,
    }),
  ]
  expect(unpackCartridges(packCartridges(rows))).toEqual(rows)
})

it('keeps the list filters of every list in the URL, other parameters untouched', () => {
  const s = readDirectory('?type=rebated&base=double&form=ball&curve=1&units=us')
  expect(s).toMatchObject({ caseType: 'rebated', base: 'double', form: 'ball', curve: '1' })
  expect(writeDirectory({ ...s, curve: '' }, '?units=us&curve=1')).toBe(
    '?units=us&type=rebated&base=double&form=ball',
  )
  expect(writeDirectory(emptyDirectory, '?type=belted&curve=1')).toBe('')
})

const fitted = (vivacity: number) =>
  summary('x', vivacity).interior as NonNullable<PowderSummary['interior']>

const summary = (
  id: string,
  vivacity?: number,
  over: Partial<PowderSummary> = {},
): PowderSummary & { manufacturerName: string } => ({
  id,
  manufacturer: id.startsWith('a') ? 'delta' : 'charlie',
  manufacturerName: id.startsWith('a') ? 'Delta' : 'Charlie',
  name: id,
  grainForm: 'ball',
  propellantBase: 'single',
  ...(vivacity !== undefined && {
    interior: {
      vivacity: { value: vivacity, standardUncertainty: vivacity / 50 },
      pressureExponent: 1,
      referencePressure: { value: 0.980665 },
      burnForm: { kind: 'twoStage', a: { value: 0 }, m: 0.5, q: 0.5, z1: 0.8 },
    },
  }),
  ...over,
})

it('orders powders fastest first and keeps the global order under filters', () => {
  const rows = orderPowders([
    summary('a-slow', 0.3),
    summary('h-fast', 0.9),
    summary('a-mid', 0.6, { propellantBase: 'double' }),
    summary('h-none'),
  ])
  expect(rows.map((r) => [r.id, r.burnRateOrder])).toEqual([
    ['a-slow', 3],
    ['h-fast', 1],
    ['a-mid', 2],
    ['h-none', undefined],
  ])
  const fast = rows.find((r) => r.id === 'h-fast') as PowderRow
  expect(fast.low).toBeLessThan(fast.meanVivacity as number)
  expect(fast.high).toBeGreaterThan(fast.meanVivacity as number)
  expect(rows.find((r) => r.id === 'h-none')?.burnRateOrder).toBeUndefined()
  const s = { ...emptyDirectory, manufacturer: 'delta' }
  // filtered: Delta's fastest keeps order 2
  expect(rows.filter((r) => powderMatches(r, s)).map((r) => r.burnRateOrder)).toEqual([3, 2])
  expect(rows.filter((r) => powderMatches(r, { ...emptyDirectory, curve: '1' }))).toHaveLength(3)
  expect(rows.filter((r) => powderMatches(r, { ...emptyDirectory, base: 'double' }))).toHaveLength(
    1,
  )
  expect(unpackPowders(packPowders(rows))).toEqual(rows)
})

it('groups the powders without a curve by reason', () => {
  const unfitted = [
    summary('a', undefined),
    summary('b', undefined),
    summary('c', 0.5, { interior: { ...fitted(0.5), pressureExponent: 1.1 } }),
    summary('d', 1, {
      interior: { ...fitted(1), vivacity: { value: 1, standardUncertainty: 0.6 } },
    }),
  ].map((p) => classifyPowder(p))
  const groups = unfittedGroups(unfitted.filter((p): p is UnfittedPowder => !isFitted(p)))
  expect(groups.map((g) => [g.kind, g.powders.map((p) => p.id)])).toEqual([
    ['none', ['a', 'b']],
    ['exponent', ['c']],
    ['unresolved', ['d']],
  ])
  // the numbers stay with each powder, the sentence is the group's
  expect(groups[1].powders[0].detail).toBe('exponent 1.1')
  expect(groups[2].powders[0].detail).toBe('vivacity 1 1/s, plus and minus 2 times 0.6')
})

it('builds the overlay from ?add= only: no preset, the ids in order, colour slots by place', () => {
  expect(overlayFrom('', 6)).toEqual([])
  expect(overlayFrom('?add=x', 6)).toEqual([{ id: 'x', slot: 0 }])
  expect(overlayFrom('?add=a,b,a,,c', 6)).toEqual([
    { id: 'a', slot: 0 },
    { id: 'b', slot: 1 },
    { id: 'c', slot: 2 },
  ])
  expect(overlayFrom('?add=a,b,c,d,e,f,g', 6).map((p) => p.id)).toEqual([
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
  ])
  // the list's Compare link round-trips
  expect(overlayHref([])).toBe('/powders/burn-rates')
  const href = overlayHref(['a', 'b'])
  expect(href).toBe('/powders/burn-rates?add=a,b')
  expect(overlayFrom(href.slice(href.indexOf('?')), 6).map((p) => p.id)).toEqual(['a', 'b'])
})
