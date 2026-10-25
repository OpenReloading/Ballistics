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
    expect(bulletMatches(r, q), q).toBe(true)
  expect(bulletMatches(r, 'bravo')).toBe(false)
  expect(bulletMatches(r, '175')).toBe(false)
})

it('gives the published BC with its drag model: G7 preferred, the other on hover', () => {
  expect(bulletBallisticCoefficient(b({}))).toEqual({
    model: 'G7',
    value: 0.26,
    other: { model: 'G1', value: 0.507 },
  })
  expect(bulletBallisticCoefficient(b({ ballisticCoefficientG7: null }))).toEqual({
    model: 'G1',
    value: 0.507,
  })
  expect(
    bulletBallisticCoefficient(b({ ballisticCoefficientG1: null, ballisticCoefficientG7: null })),
  ).toBeUndefined()
})

it('sorts the BC by drag model first, G1 before G7 whatever the values', () => {
  const g1High = b({ ballisticCoefficientG1: 0.9, ballisticCoefficientG7: null })
  const g7Low = b({ ballisticCoefficientG1: 0.3, ballisticCoefficientG7: 0.1 })
  expect(bulletBallisticCoefficientSort(g1High)).toBeLessThan(
    bulletBallisticCoefficientSort(g7Low) as number,
  )
  expect(
    bulletBallisticCoefficientSort(
      b({ ballisticCoefficientG1: null, ballisticCoefficientG7: null }),
    ),
  ).toBeUndefined()
})

it('matches a number of the search as a whole number, as the schema matcher does', () => {
  const heavy = b({ diameter: 7.035, mass: 17.82 })
  // 7.8 is no whole number of a 17.82 g, 7.82 mm or 7.035 mm bullet
  expect(bulletMatches(heavy, '7.8')).toBe(false)
  expect(bulletMatches(b({}), '7.8')).toBe(false)
  expect(bulletMatches(heavy, '17.82')).toBe(true)
  expect(bulletMatches(b({}), '7.82')).toBe(true)
  expect(bulletMatches(b({}), '308')).toBe(true)
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
