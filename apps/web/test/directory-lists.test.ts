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
import { packPowders, powderMatches, unpackPowders } from '../src/lib/powder-rows.ts'
import { presetUnits } from '../src/lib/units.ts'
import { defined } from './defined.ts'

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

it('searches the words of name, aliases and caliber', () => {
  expect(cartridgeMatches(c({}), '7,62 51')).toBe(true)
  expect(cartridgeMatches(c({}), 'lapua')).toBe(false)
  // the search finds the common caliber and the G1 in both units
  for (const q of ['.308', '7.85', '.309', '6.5'])
    expect(cartridgeMatches(c({}), q), q).toBe(q !== '6.5')
  expect(cartridgeMatches(c({ maxBulletDiameter: 6.72 }), '6.5 mm')).toBe(true)
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

it('orders powders fastest first and keeps the global order under the search', () => {
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
  // searched: Delta's fastest keeps order 2
  expect(rows.filter((r) => powderMatches(r, 'delta')).map((r) => r.burnRateOrder)).toEqual([3, 2])
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
  expect(defined(defined(groups[1]).powders[0]).detail).toBe('exponent 1.1')
  expect(defined(defined(groups[2]).powders[0]).detail).toBe(
    'vivacity 1 1/s, plus and minus 2 times 0.6',
  )
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
