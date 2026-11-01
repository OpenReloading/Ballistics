import { expect, it } from 'vitest'
import { bulletKind } from '../src/components/bullet-search-dialog.tsx'
import {
  type ChooserKind,
  type ChooserRow,
  highlighted,
  listKey,
  moveHighlight,
  searchKey,
} from '../src/components/record-chooser.tsx'
import {
  cartridgeKind,
  caseKind,
  firearmKind,
  powderKind,
  primerKind,
} from '../src/components/record-choosers.tsx'
import { setShownLanguage } from '../src/i18n/shown.ts'
import { english } from '../src/i18n/translate.ts'
import type { BulletRow } from '../src/lib/bullet-rows.ts'
import type { PowderRow } from '../src/lib/burn-rate.ts'
import type { CartridgeRow } from '../src/lib/cartridge-rows.ts'
import type { FirearmRow } from '../src/lib/firearm.ts'
import type { PrimerRow } from '../src/lib/primer-rows.ts'
import type { CaseRow } from '../src/lib/record-choosers.ts'
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

it('the cartridge chooser names the countries as the record page does, in the language shown', () => {
  const country = (text: string) =>
    cartridgeKind
      .facts(cartridge({ id: 'c', name: 'C', country: text }), system, t)
      .find(([k]) => k === 'Country')?.[1]
  expect(country('United states')).toBe('United States')
  setShownLanguage('de')
  try {
    expect(country('United states')).toBe('Vereinigte Staaten')
    expect(country('Germany, us')).toBe('Deutschland, Vereinigte Staaten')
  } finally {
    setShownLanguage('en')
  }
})

// invented firearms, lengths in m
it('the firearm chooser shows barrel length and twist, ranks by name and says when nothing matches', () => {
  const rows: FirearmRow[] = [
    { id: 'a', name: 'Match rifle 308', barrelLength: 0.66, twist: 0.254 },
    { id: 'b', name: 'Hunting rifle', barrelLength: 0.56 },
    { id: 'ex', name: 'Example rifle, 308 Win. (example)', barrelLength: 0.6, twist: 0.3048 },
  ]
  expect(table(firearmKind, rows[0] as FirearmRow)).toEqual([
    ['Firearm', 'Match rifle 308'],
    ['Barrel length', '660 mm'],
    ['Twist', '254 mm'],
  ])
  expect(table(firearmKind, rows[1] as FirearmRow)[2]).toEqual(['Twist', ''])
  // a word's start ranks above its middle; no words: by name
  expect(ids(firearmKind, rows, '308')).toEqual(['ex', 'a'])
  expect(ids(firearmKind, rows, 'rifle hunt')).toEqual(['b'])
  expect(ids(firearmKind, rows, '')).toEqual(['ex', 'b', 'a'])
  expect(ids(firearmKind, rows, 'nothing')).toEqual([])
  expect(t(firearmKind.texts.empty)).toBe('No firearm matches')
  expect(firearmKind.href).toBeUndefined()
})

// invented brass, water in g
it('the brass chooser shows material and water, ranks over maker and name and says when nothing matches', () => {
  const rows: CaseRow[] = [
    { id: 'user:g1', name: 'Lot 2024', manufacturerName: 'Your brass', waterCapacity: 3.41 },
    {
      id: 'acme-308',
      name: '308 Win',
      manufacturerName: 'Acme',
      material: 'brass',
      waterCapacity: 3.52,
    },
    {
      id: 'beta-308',
      name: '308 Win Match',
      manufacturerName: 'Beta',
      material: 'nickel-plated-brass',
    },
  ]
  expect(table(caseKind, rows[1] as CaseRow)).toEqual([
    ['Brass', '308 Win'],
    ['Material', 'Brass'],
    ['Water', '3.52 g water'],
  ])
  expect(ids(caseKind, rows, 'acme')).toEqual(['acme-308'])
  expect(ids(caseKind, rows, '308 win')).toEqual(['acme-308', 'beta-308'])
  expect(ids(caseKind, rows, 'lot')).toEqual(['user:g1'])
  expect(ids(caseKind, rows, '', 'name')).toEqual(['acme-308', 'beta-308', 'user:g1'])
  expect(ids(caseKind, rows, 'nothing')).toEqual([])
  expect(t(caseKind.texts.empty)).toBe('No brass matches')
  // the user's own group has no record page
  expect(caseKind.href?.(rows[0] as CaseRow)).toBeUndefined()
  expect(caseKind.href?.(rows[1] as CaseRow)).toBe('/cases/acme-308')
})

// invented primers
const primer = (over: Partial<PrimerRow> & Pick<PrimerRow, 'id' | 'name'>): PrimerRow => ({
  manufacturer: 'acme',
  manufacturerName: 'Acme Primers',
  manufacturerAliases: ['AP'],
  size: 'large-rifle',
  ...over,
})

it('the primer chooser shows size and magnum, ranks as the API and says when nothing matches', () => {
  const rows = [
    primer({ id: 'a-lr', name: 'LR 210', magnum: false }),
    primer({ id: 'a-lrm', name: 'LR 210M', magnum: true }),
    primer({
      id: 'b-sr',
      manufacturer: 'beta',
      manufacturerName: 'Beta',
      name: 'SR 400',
      size: 'small-rifle',
    }),
  ]
  expect(table(primerKind, rows[1] as PrimerRow)).toEqual([
    ['Primer', 'LR 210M'],
    ['Size', 'Large rifle'],
    ['Magnum', 'Yes'],
  ])
  // the exact name first; the manufacturer's alias finds its primers
  expect(ids(primerKind, rows, 'lr 210')).toEqual(['a-lr', 'a-lrm'])
  expect(ids(primerKind, rows, 'ap 210m')).toEqual(['a-lrm'])
  expect(ids(primerKind, rows, '', 'name')).toEqual(['a-lr', 'a-lrm', 'b-sr'])
  expect(ids(primerKind, rows, 'nothing')).toEqual([])
  expect(t(primerKind.texts.empty)).toBe('No primer matches')
})

it('Enter in the search box chooses the highlighted row, but not while it confirms an IME composition', () => {
  const press = (key: string, isComposing: boolean) => {
    const done: string[] = []
    const e = {
      key,
      ctrlKey: false,
      metaKey: false,
      nativeEvent: { isComposing },
      preventDefault() {},
    }
    searchKey(
      e as unknown as Parameters<typeof searchKey>[0],
      () => done.push('choose'),
      (by) => done.push(`move ${by}`),
    )
    return done
  }
  expect(press('Enter', false)).toEqual(['choose'])
  expect(press('ArrowDown', false)).toEqual(['move 1'])
  expect(press('Enter', true)).toEqual([])
  expect(press('ArrowDown', true)).toEqual([])
})

it('the highlight belongs to the list it was moved in, so a list rendered later cannot take it back (#884)', () => {
  const all = listKey([
    { id: 'a-150', name: '150' },
    { id: 'a-168', name: '168' },
    { id: 'b', name: 'b' },
  ])
  const demo = listKey([
    { id: 'a-150', name: '150' },
    { id: 'a-168', name: '168' },
  ])
  // ArrowDown pressed for the list of the typed text, before that list has rendered
  const moved = moveHighlight({ list: all, index: 0 }, demo, 2, 1)
  // the list still shown highlights its first row; the typed text's list, once rendered, the second
  expect(highlighted(moved, all)).toBe(0)
  expect(highlighted(moved, demo)).toBe(1)
  // the highlight stops at the ends; an empty list leaves it as it was
  expect(moveHighlight(moved, demo, 2, 8)).toEqual({ list: demo, index: 1 })
  expect(moveHighlight(moved, demo, 2, -8)).toEqual({ list: demo, index: 0 })
  expect(moveHighlight(moved, listKey([]), 0, 1)).toBe(moved)
  // a re-sorted list of the same count and first row is another list
  const resorted = listKey([
    { id: 'a-150', name: '150' },
    { id: 'b', name: 'b' },
    { id: 'a-168', name: '168' },
  ])
  expect(resorted).not.toBe(all)
})
