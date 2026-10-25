import { expect, it } from 'vitest'
import {
  type BulletItem,
  bulletBallisticCoefficient,
  bulletBallisticCoefficientSort,
  bulletCells,
  bulletMatches,
  packBullets,
  unpackBullets,
} from '../src/lib/bullet-rows.ts'
import { caliberLabel } from '../src/lib/caliber.ts'
import {
  convertMass,
  type DirectoryState,
  emptyDirectory,
  massRange,
  readDirectory,
  writeDirectory,
} from '../src/lib/directory.ts'
import { presetUnits } from '../src/lib/units.ts'

const b = (over: Partial<BulletItem>): BulletItem => ({
  id: 'x',
  manufacturer: 'alpha',
  manufacturerName: 'Alpha',
  name: '30 Cal VLD Target',
  diameter: 7.823,
  mass: 10.886,
  length: 31.5,
  ballisticCoefficientG1: 0.507,
  ballisticCoefficientG7: 0.26,
  ...over,
})

it('labels a caliber in inches as .308 and in mm with two decimals', () => {
  expect(caliberLabel(7.823, 'in')).toBe('.308')
  expect(caliberLabel(7.823, 'mm')).toBe('7.82')
  expect(caliberLabel(25.4, 'in')).toBe('1.000')
  expect(caliberLabel(5.69, 'in')).toBe('.224')
  expect(caliberLabel(0, 'in')).toBe('0')
})

it('matches manufacturer name, product name and the diameter and mass in every unit', () => {
  const r = b({})
  for (const q of ['alpha', 'vld', '168', '.308', '7.82', '10.89', 'alpha 168 .308'])
    expect(bulletMatches(r, { ...emptyDirectory, query: q }), q).toBe(true)
  expect(bulletMatches(r, { ...emptyDirectory, query: 'bravo' })).toBe(false)
  expect(bulletMatches(r, { ...emptyDirectory, query: '175' })).toBe(false)
})

it('filters by manufacturer id, common caliber and a mass range', () => {
  const r = b({})
  const s = (over: Partial<DirectoryState>) => bulletMatches(r, { ...emptyDirectory, ...over })
  expect(s({ manufacturer: 'alpha' })).toBe(true)
  expect(s({ manufacturer: 'bravo' })).toBe(false)
  expect(s({ caliber: '.308' })).toBe(true)
  expect(s({ caliber: '7 mm' })).toBe(false)
  expect(bulletMatches(b({ diameter: 6.706 }), { ...emptyDirectory, caliber: '6.5 mm' })).toBe(true)
  expect(s({ mass: '150-180gr' })).toBe(true)
  expect(s({ mass: '170-gr' })).toBe(false)
  expect(s({ mass: '-10.9g' })).toBe(true)
  expect(s({ mass: '-10g' })).toBe(false)
})

it('filters by drag model: only bullets with a coefficient of that model', () => {
  const s = (over: Partial<BulletItem>, drag: string) =>
    bulletMatches(b(over), { ...emptyDirectory, dragModel: drag })
  expect(s({}, 'G1')).toBe(true)
  expect(s({ ballisticCoefficientG1: null }, 'G1')).toBe(false)
  expect(s({ ballisticCoefficientG7: null }, 'G7')).toBe(false)
  expect(s({ ballisticCoefficientG1: null, ballisticCoefficientG7: null }, '')).toBe(true)
  // an unknown model filters nothing
  expect(s({ ballisticCoefficientG7: null }, 'G5')).toBe(true)
})

it('gives the published BC with its drag model: G7 preferred, the other on hover', () => {
  expect(bulletBallisticCoefficient(b({}), '')).toEqual({
    model: 'G7',
    value: 0.26,
    other: { model: 'G1', value: 0.507 },
  })
  expect(bulletBallisticCoefficient(b({ ballisticCoefficientG7: null }), '')).toEqual({
    model: 'G1',
    value: 0.507,
  })
  expect(bulletBallisticCoefficient(b({}), 'G1')).toEqual({
    model: 'G1',
    value: 0.507,
    other: { model: 'G7', value: 0.26 },
  })
  expect(
    bulletBallisticCoefficient(
      b({ ballisticCoefficientG1: null, ballisticCoefficientG7: null }),
      '',
    ),
  ).toBeUndefined()
  expect(bulletBallisticCoefficient(b({ ballisticCoefficientG1: null }), 'G1')).toBeUndefined()
})

it('sorts the BC by drag model first with Any, by value with one model', () => {
  const g1High = b({ ballisticCoefficientG1: 0.9, ballisticCoefficientG7: null })
  const g7Low = b({ ballisticCoefficientG1: 0.3, ballisticCoefficientG7: 0.1 })
  // G1 before G7 whatever the values
  expect(bulletBallisticCoefficientSort(g1High, '')).toBeLessThan(
    bulletBallisticCoefficientSort(g7Low, '') as number,
  )
  expect(bulletBallisticCoefficientSort(g1High, 'G1')).toBe(0.9)
  expect(bulletBallisticCoefficientSort(g7Low, 'G1')).toBe(0.3)
  expect(
    bulletBallisticCoefficientSort(
      b({ ballisticCoefficientG1: null, ballisticCoefficientG7: null }),
      '',
    ),
  ).toBeUndefined()
})

it('reads a mass range with its unit, open ends allowed', () => {
  expect(massRange('150-180gr')).toEqual({ min: 150, max: 180, unit: 'gr' })
  expect(massRange('9.5-g')).toEqual({ min: 9.5, max: undefined, unit: 'g' })
  expect(massRange('-180gr')).toEqual({ min: undefined, max: 180, unit: 'gr' })
  expect(massRange('heavy')).toBeUndefined()
  expect(massRange('')).toBeUndefined()
  // no number: no filter, not an active one
  expect(massRange('.-g')).toBeUndefined()
  expect(massRange('.-.gr')).toBeUndefined()
  expect(massRange('.-180gr')).toEqual({ min: undefined, max: 180, unit: 'gr' })
  expect(bulletMatches(b({}), { ...emptyDirectory, mass: '.-g' })).toBe(true)
})

it('shows a mass bound of the other unit at that unit display decimals', () => {
  // 150 gr in grams: 9.72 g, which filters as 150 gr does
  expect(convertMass(150, 'gr', 'g')).toBe(9.72)
  expect(convertMass(180, 'gr', 'g')).toBe(11.66)
  expect(convertMass(9.72, 'g', 'gr')).toBe(150)
  expect(convertMass(168, 'gr', 'gr')).toBe(168)
  const at = (gr: number) => b({ mass: gr * 0.06479891 })
  for (const gr of [150, 180])
    expect(bulletMatches(at(gr), { ...emptyDirectory, mass: '9.72-11.66g' }), `${gr}`).toBe(true)
})

it('matches a number of the search as a whole number, as the schema matcher does', () => {
  const heavy = b({ diameter: 7.035, mass: 17.82 })
  // 7.8 is no whole number of a 17.82 g, 7.82 mm or 7.035 mm bullet
  expect(bulletMatches(heavy, { ...emptyDirectory, query: '7.8' })).toBe(false)
  expect(bulletMatches(b({}), { ...emptyDirectory, query: '7.8' })).toBe(false)
  expect(bulletMatches(heavy, { ...emptyDirectory, query: '17.82' })).toBe(true)
  expect(bulletMatches(b({}), { ...emptyDirectory, query: '7.82' })).toBe(true)
  expect(bulletMatches(b({}), { ...emptyDirectory, query: '308' })).toBe(true)
})

it('round-trips the state through the URL and keeps other parameters', () => {
  const state: DirectoryState = {
    query: '168 vld',
    manufacturer: 'alpha',
    caliber: '6.5 mm',
    mass: '150-180gr',
    dragModel: 'G7',
    sort: { column: 'mass', dir: 'descending' },
  }
  const search = writeDirectory(state, '?units=us')
  expect(search).toBe(
    '?units=us&q=168+vld&manufacturer=alpha&caliber=6.5+mm&mass=150-180gr&drag=G7&sort=-mass',
  )
  expect(readDirectory(search)).toEqual(state)
  expect(writeDirectory(emptyDirectory, search)).toBe('?units=us')
  expect(readDirectory('?sort=name')).toEqual({
    ...emptyDirectory,
    sort: { column: 'name', dir: 'ascending' },
  })
})

it('packs bullets into rows and back', () => {
  const rows = [b({ id: 'a', length: null, ballisticCoefficientG7: null })]
  expect(unpackBullets(packBullets(rows))).toEqual(rows)
})

it('formats the columns by the preset, rounded for display', () => {
  const r = b({ length: 32.69, ballisticCoefficientG7: null })
  expect(bulletCells(r, presetUnits('us'))).toEqual({
    caliber: '.308',
    diameter: '.3080 in',
    mass: '168.0',
    length: '1.287',
  })
  expect(bulletCells(r, presetUnits('metric-grams'))).toEqual({
    caliber: '.308',
    diameter: '7.823 mm',
    mass: '10.89',
    length: '32.69',
  })
  expect(bulletCells(r, presetUnits('metric-grains')).mass).toBe('168.0')
  // below one inch the zero before the point goes; a zero prints as 0
  expect(bulletCells({ ...r, length: 12 }, presetUnits('us')).length).toBe('.472')
  expect(bulletCells({ ...r, length: 0 }, presetUnits('us')).length).toBe('0')
  expect(bulletCells({ ...r, diameter: 0 }, presetUnits('us')).diameter).toBe('0 in')
})
