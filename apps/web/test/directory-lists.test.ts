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
import {
  inOverlay,
  packPowders,
  powderMatches,
  unpackPowders,
  userPowderRows,
} from '../src/lib/powder-rows.ts'
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
  // a row carries whether its record has burn values, for "Complete records only"
  expect(fast.modelled).toBe(true)
  // searched: Delta's fastest keeps order 2
  expect(rows.filter((r) => powderMatches(r, 'delta')).map((r) => r.burnRateOrder)).toEqual([3, 2])
  expect(unpackPowders(packPowders(rows))).toEqual(rows)
})

it('carries the training rows, cartridges and day of a fit, and packs them back', () => {
  const fitted = summary('a-fit', 0.5)
  const rows = orderPowders([
    {
      ...fitted,
      interior: {
        ...defined(fitted.interior),
        trainingRows: 153,
        trainingCartridges: 4,
        retrieved: '2026-10-12',
      },
    },
    summary('h-none'),
  ])
  expect(rows[0]).toMatchObject({
    trainingRows: 153,
    trainingCartridges: 4,
    retrieved: '2026-10-12',
  })
  expect(rows[1]?.trainingRows).toBeUndefined()
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

it("lists the browser's powders as Mine rows without a manufacturer or burn rate", () => {
  const saved = '2026-10-26T10:00:00.000Z'
  const rows = userPowderRows([
    {
      kind: 'powder',
      id: 'p1',
      name: 'My powder',
      saved,
      data: { origin: 'user', draft: { grainForm: 'extruded', propellantBase: 'single' } },
    },
    { kind: 'manufacturer', id: 'm', name: 'Maker', saved, data: { origin: 'user' } },
  ])
  expect(rows).toEqual([
    {
      id: 'user:p1',
      origin: 'user',
      manufacturer: '',
      manufacturerName: '',
      name: 'My powder',
      grainForm: 'extruded',
      propellantBase: 'single',
    },
  ])
  expect(powderMatches(defined(rows[0]), 'my powder')).toBe(true)
})

it('gives a browser design with a curve its mean vivacity, so the overlay can take it', () => {
  const saved = '2026-10-26T10:00:00.000Z'
  const interior = {
    model: 'm3' as const,
    fitted: ['vivacity' as const],
    vivacity: { value: 0.6 },
    energy: { value: 3.8e6 },
    gamma: 1.24,
    covolume: { value: 0.001 },
    density: { value: 1.6 },
    pressureExponent: 1,
    referencePressure: { value: 0.980665 },
    ignitionPressure: { value: 150 },
    propellantTemperature: { value: 21 },
    burnForm: { kind: 'twoStage' as const, a: { value: 0.1 }, m: 0.5, q: 0.1, z1: 0.8 },
  }
  const [fitted, unfinished] = userPowderRows([
    {
      kind: 'powder',
      id: 'p1',
      name: 'Fitted design',
      saved,
      data: { origin: 'user', provenanceKind: 'fitted', draft: { interior } },
    },
    // no provenance kind: no powder yet, so no curve
    {
      kind: 'powder',
      id: 'p2',
      name: 'Draft',
      saved,
      data: { origin: 'user', draft: { interior } },
    },
  ])
  expect(fitted?.meanVivacity).toBeGreaterThan(0)
  expect(fitted?.burnRateOrder).toBeUndefined()
  expect(inOverlay(defined(fitted))).toBe(true)
  expect(unfinished?.meanVivacity).toBeUndefined()
  expect(inOverlay(defined(unfinished))).toBe(false)
  // a whole interior model counts as burn values, a partly entered one does not
  expect(fitted?.modelled).toBe(true)
  const [partial] = userPowderRows([
    {
      kind: 'powder',
      id: 'p3',
      name: 'Partial',
      saved,
      data: { origin: 'user', draft: { interior: { vivacity: interior.vivacity } } },
    },
  ])
  expect(partial?.modelled).toBeUndefined()

  const design = (id: string, data: object) => ({
    kind: 'powder' as const,
    id,
    name: id,
    saved,
    data: { origin: 'user' as const, provenanceKind: 'fitted' as const, draft: { interior: data } },
  })
  const [trained, still, overflow] = userPowderRows([
    // the fit's training counts carry into the row
    design('trained', { ...interior, trainingRows: 12, trainingCartridges: 3 }),
    // no curve for a vivacity of 0 or a mean rate that overflows
    design('still', { ...interior, vivacity: { value: 0 } }),
    design('overflow', {
      ...interior,
      burnForm: { ...interior.burnForm, a: { value: 1 }, m: 5000 },
    }),
  ])
  expect(trained).toMatchObject({ trainingRows: 12, trainingCartridges: 3 })
  expect(trained?.meanVivacity).toBeGreaterThan(0)
  expect(still?.meanVivacity).toBeUndefined()
  expect(overflow?.meanVivacity).toBeUndefined()
})
