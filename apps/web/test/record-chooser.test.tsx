import { expect, it } from 'vitest'
import { bulletKind } from '../src/components/bullet-search-dialog.tsx'
import type { ChooserKind, ChooserRow } from '../src/components/record-chooser.tsx'
import { cartridgeKind, powderKind } from '../src/components/record-choosers.tsx'
import { english } from '../src/i18n/translate.ts'
import type { BulletRow } from '../src/lib/bullet-rows.ts'
import type { PowderRow } from '../src/lib/burn-rate.ts'
import type { CartridgeRow } from '../src/lib/cartridge-rows.ts'
import { presetUnits } from '../src/lib/units.ts'

const system = presetUnits('metric-grams')
const { t } = english

/** The head of each column and the cells of `row` under it, the name column first. */
const table = <R extends ChooserRow>(kind: ChooserKind<R>, row: R) => [
  [t(kind.texts.column), row.name],
  ...kind.columns.map((c) => [t(c.label), c.cell(row, system, t)]),
]

const ids = <R extends ChooserRow>(kind: ChooserKind<R>, rows: R[], query: string, sort?: string) =>
  kind.search(rows, query, sort ?? kind.sorts[0]?.value ?? '').map((r) => r.id)

// invented bullets: mass in g (168 gr = 10.886 g), diameter in mm
const bullet = (over: Partial<BulletRow> & Pick<BulletRow, 'id' | 'name'>): BulletRow => ({
  manufacturer: 'acme',
  manufacturerName: 'Acme Bullets',
  diameter: 7.823,
  mass: 10.886,
  length: null,
  ballisticCoefficientG1: null,
  ballisticCoefficientG7: 0.25,
  ...over,
})

it('the bullet chooser shows caliber, mass and BC, ranks the bullet search and says when nothing matches', () => {
  const rows = [
    bullet({ id: 'a-175', name: '30 Cal 175 gr Match', mass: 11.34 }),
    bullet({ id: 'a-168', name: '30 Cal 168 gr Match' }),
    bullet({ id: 'own', origin: 'user', name: 'My 168 gr design', ballisticCoefficientG7: null }),
  ]
  expect(table(bulletKind, rows[1] as BulletRow)).toEqual([
    ['Bullet', '30 Cal 168 gr Match'],
    ['Caliber', '.308'],
    ['Mass', '10.89 g'],
    ['BC', '0.250 G7'],
  ])
  // the browser's design first among equal matches, then the catalogue's
  expect(ids(bulletKind, rows, '168')).toEqual(['own', 'a-168'])
  expect(ids(bulletKind, rows, '', 'mass')).toEqual(['a-175', 'a-168', 'own'])
  expect(ids(bulletKind, rows, 'nothing')).toEqual([])
  expect(t(bulletKind.texts.empty)).toBe('No bullet matches')
})

// invented powders
const powder = (over: Partial<PowderRow> & Pick<PowderRow, 'id' | 'name'>): PowderRow => ({
  manufacturer: 'acme',
  manufacturerName: 'Acme Powder',
  manufacturerAliases: ['AP'],
  grainForm: 'extruded',
  propellantBase: 'single',
  ...over,
})

it('the powder chooser shows form, base and burn-rate order, ranks as the API and says when nothing matches', () => {
  const rows = [
    powder({ id: 'a-q150', name: 'Q150', meanVivacity: 0.5, burnRateOrder: 2 }),
    powder({ id: 'a-q140', name: 'Q140', meanVivacity: 0.6, burnRateOrder: 1 }),
    powder({ id: 'b-140', manufacturer: 'beta', manufacturerName: 'Beta', name: 'Match 140x' }),
    powder({
      id: 'own',
      origin: 'user',
      manufacturer: '',
      manufacturerName: '',
      manufacturerAliases: [],
      name: 'Q140 mine',
    }),
  ]
  expect(table(powderKind, rows[1] as PowderRow)).toEqual([
    ['Powder', 'Q140'],
    ['Form', 'extruded'],
    ['Base', 'single'],
    ['Burn-rate order', '1'],
  ])
  // the exact name first, then a word's start; the manufacturer's alias finds its powders
  expect(ids(powderKind, rows, 'q140')).toEqual(['a-q140', 'own'])
  expect(ids(powderKind, rows, 'ap q1')).toEqual(['a-q140', 'a-q150'])
  expect(ids(powderKind, rows, '', 'name')).toEqual(['own', 'a-q140', 'a-q150', 'b-140'])
  // powders without a burn rate last
  expect(ids(powderKind, rows, '', 'rate')).toEqual(['a-q140', 'a-q150', 'own', 'b-140'])
  expect(ids(powderKind, rows, 'nothing')).toEqual([])
  expect(t(powderKind.texts.empty)).toBe('No powder matches')
})

// invented cartridges, lengths in mm and Pmax in bar
const cartridge = (
  over: Partial<CartridgeRow> & Pick<CartridgeRow, 'id' | 'name'>,
): CartridgeRow => ({ aliases: [], ...over })

it('the cartridge chooser shows caliber, case type and Pmax, ranks as the API and says when nothing matches', () => {
  const rows = [
    cartridge({
      id: '308-win',
      name: '308 Win',
      aliases: ['7.62x51'],
      maxBulletDiameter: 7.85,
      pmax: 4150,
      caseType: 'rimless',
    }),
    cartridge({
      id: '308-norma',
      name: '308 Norma Magnum',
      maxBulletDiameter: 7.85,
      caseType: 'belted',
    }),
    cartridge({ id: '6-5x55', name: '6.5x55 SE', maxBulletDiameter: 6.72, pmax: 3800 }),
    cartridge({ id: 'own', origin: 'user', name: 'My 308 Win wildcat', maxBulletDiameter: 7.85 }),
  ]
  expect(table(cartridgeKind, rows[0] as CartridgeRow)).toEqual([
    ['Cartridge', '308 Win'],
    ['Caliber', '.308'],
    ['Case type', 'rimless'],
    ['Pmax', '4150 bar'],
  ])
  // the exact name above longer names, the design first among equal matches
  expect(ids(cartridgeKind, rows, '308 win')).toEqual(['308-win', 'own'])
  expect(ids(cartridgeKind, rows, '308')).toEqual(['own', '308-norma', '308-win'])
  expect(ids(cartridgeKind, rows, '7.62x51')).toEqual(['308-win'])
  // equal calibers by name
  expect(ids(cartridgeKind, rows, '', 'caliber')).toEqual(['308-norma', '308-win', 'own', '6-5x55'])
  expect(ids(cartridgeKind, rows, 'nothing')).toEqual([])
  expect(t(cartridgeKind.texts.empty)).toBe('No cartridge matches')
})
