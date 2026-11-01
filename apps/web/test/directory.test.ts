import { expect, it } from 'vitest'
import { english, translator } from '../src/i18n/translate.ts'
import { bulletKinds, bulletSectionalDensity } from '../src/lib/bullet-kinds.ts'
import {
  bulletFacets,
  bulletTypeText,
  coefficientText,
  constructionText,
  listCells,
  packBullets,
  unpackBullets,
} from '../src/lib/bullet-list-data.ts'
import {
  type BulletItem,
  bulletBallisticCoefficient,
  bulletCells,
  bulletMatches,
} from '../src/lib/bullet-rows.ts'
import { caliberLabel } from '../src/lib/caliber.ts'
import { facetOptions, facetRows } from '../src/lib/facets.ts'
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

it('shows G1 and G7 each in its own column, to three decimals', () => {
  expect(coefficientText(0.507)).toBe('0.507')
  expect(coefficientText(null)).toBe('')
})

it('computes the sectional density from mass and diameter, none without both', () => {
  // 168 gr over (.308 in)²: 0.253 lb/in²
  expect(bulletSectionalDensity(b({ diameter: 7.8232 })) as number).toBeCloseTo(177.88, 1)
  expect(bulletSectionalDensity(b({ diameter: null }))).toBeUndefined()
  expect(bulletSectionalDensity({ mass: null, diameter: 7.8 })).toBeUndefined()
})

it('names the type by tip and base, and the construction by structure or core', () => {
  const t = english.t
  expect(bulletTypeText(t, b({ tipType: 'hollow-point', baseType: 'boat-tail' }))).toBe(
    'Hollow point, boat tail',
  )
  expect(bulletTypeText(t, b({ baseType: 'flat' }))).toBe('Flat')
  expect(bulletTypeText(t, b({}))).toBe('')
  expect(constructionText(t, 'cup-and-core')).toBe('Cup and core')
  expect(constructionText(t, 'lead-core')).toBe('Lead core')
  const de = translator({ 'hollow-point': 'Hohlspitze', 'boat-tail': 'Bootsheck' }, 'de')
  expect(bulletTypeText(de.t, b({ tipType: 'hollow-point', baseType: 'boat-tail' }))).toBe(
    'Hohlspitze, Bootsheck',
  )
  // a structure that ends in "-core" is no core material
  const deBuild = translator(
    { 'cup-and-core': 'Mantel mit Kern', lead: 'Blei', '{material} core': 'Kern aus {material}' },
    'de',
  )
  expect(constructionText(deBuild.t, 'cup-and-core')).toBe('Mantel mit Kern')
  expect(constructionText(deBuild.t, 'lead-core')).toBe('Kern aus Blei')
})

it("takes a design's first G1 and G7, tip, base, construction and lead-free from its record", () => {
  expect(
    bulletKinds({
      tip: { type: 'polymer-tip' },
      base: { type: 'boat-tail' },
      construction: { raw: 'Copper', structure: 'monolithic', core: { material: 'copper' } },
      ballisticCoefficients: [
        { dragModel: 'G7', value: 0.3 },
        { dragModel: 'G7', value: 0.28 },
      ],
    }),
  ).toEqual({
    ballisticCoefficientG1: null,
    ballisticCoefficientG7: 0.3,
    tipType: 'polymer-tip',
    baseType: 'boat-tail',
    construction: 'monolithic',
    leadFree: true,
  })
  expect(bulletKinds({ construction: { raw: 'Lead core', core: { material: 'lead' } } })).toEqual({
    ballisticCoefficientG1: null,
    ballisticCoefficientG7: null,
    construction: 'lead-core',
    leadFree: false,
  })
})

it('filters by construction, tip, base and lead-free, and leaves out a filter of one value', () => {
  const rows = [
    b({
      id: 'a',
      tipType: 'hollow-point',
      baseType: 'boat-tail',
      construction: 'lead-core',
      leadFree: false,
    }),
    b({
      id: 'c',
      tipType: 'polymer-tip',
      baseType: 'boat-tail',
      construction: 'monolithic',
      leadFree: true,
    }),
    b({ id: 'd', tipType: 'hollow-point', baseType: 'boat-tail', construction: 'bonded' }),
    b({ id: 'e' }),
  ]
  const facets = bulletFacets(english.t)
  const ids = (s: Record<string, string[]>) => facetRows(rows, facets, s).map((r) => r.id)
  expect(ids({ tip: ['hollow-point'] })).toEqual(['a', 'd'])
  expect(ids({ construction: ['monolithic', 'bonded'] })).toEqual(['c', 'd'])
  expect(ids({ leadfree: ['yes'] })).toEqual(['c'])
  expect(ids({ leadfree: ['no'], tip: ['hollow-point'] })).toEqual(['a'])
  const options = facetOptions(rows, rows, facets, { tip: ['hollow-point'] })
  // every row has a boat tail: one value, no filter
  expect([...options.keys()]).toEqual(['construction', 'tip', 'leadfree'])
  expect(options.get('leadfree')).toEqual([
    { value: 'yes', text: 'Yes', count: 0 },
    { value: 'no', text: 'No', count: 1 },
  ])
  expect(options.get('tip')).toEqual([
    { value: 'hollow-point', text: 'Hollow point', count: 2 },
    { value: 'polymer-tip', text: 'Polymer tip', count: 1 },
  ])
  expect(options.get('construction')?.map((o) => [o.text, o.count])).toEqual([
    ['Bonded', 1],
    ['Lead core', 1],
    ['Monolithic', 0],
  ])
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
  const rows = [
    b({ id: 'a', length: null, ballisticCoefficientG7: null }),
    b({
      tipType: 'hollow-point',
      baseType: 'boat-tail',
      construction: 'lead-core',
      leadFree: false,
    }),
  ]
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
  // the Diameter and SD columns: inches to 4 decimals, mm to 3, SD in lb/in² or kg/m²
  expect(listCells(r, presetUnits('us'))).toEqual({
    diameterValue: '.3080',
    sectionalDensity: '0.253',
  })
  expect(listCells(r, presetUnits('metric-grams'))).toEqual({
    diameterValue: '7.823',
    sectionalDensity: '177.9',
  })
  expect(listCells({ ...r, diameter: null }, presetUnits('us'))).toEqual({
    diameterValue: '',
    sectionalDensity: '',
  })
  // below one inch the zero before the point goes; a zero prints as 0
  expect(bulletCells({ ...r, length: 12 }, presetUnits('us')).length).toBe('.472')
  expect(bulletCells({ ...r, length: 0 }, presetUnits('us')).length).toBe('0')
  expect(bulletCells({ ...r, diameter: 0 }, presetUnits('us')).diameter).toBe('0 in')
})
