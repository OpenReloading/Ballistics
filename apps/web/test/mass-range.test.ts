import { expect, it } from 'vitest'
import { convertMass, massRange } from '../src/lib/mass-range.ts'

it('reads a mass range with its unit, open ends allowed', () => {
  expect(massRange('150-180gr')).toEqual({ min: 150, max: 180, unit: 'gr' })
  expect(massRange('9.5-g')).toEqual({ min: 9.5, max: undefined, unit: 'g' })
  expect(massRange('-180gr')).toEqual({ min: undefined, max: 180, unit: 'gr' })
  expect(massRange('heavy')).toBeUndefined()
  expect(massRange('')).toBeUndefined()
  // no number: no range
  expect(massRange('.-g')).toBeUndefined()
  expect(massRange('.-.gr')).toBeUndefined()
  expect(massRange('.-180gr')).toEqual({ min: undefined, max: 180, unit: 'gr' })
})

it('shows a mass bound of the other unit at that unit display decimals', () => {
  // 150 gr in grams: 9.72 g, which filters as 150 gr does
  expect(convertMass(150, 'gr', 'g')).toBe(9.72)
  expect(convertMass(180, 'gr', 'g')).toBe(11.66)
  expect(convertMass(9.72, 'g', 'gr')).toBe(150)
  expect(convertMass(168, 'gr', 'gr')).toBe(168)
})
