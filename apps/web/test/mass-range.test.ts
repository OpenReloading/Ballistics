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

it('reads blanks around the parts and rejects malformed ranges', () => {
  expect(massRange('  150 - 180 gr  ')).toEqual({ min: 150, max: 180, unit: 'gr' })
  expect(massRange('1.-.5g')).toEqual({ min: 1, max: 0.5, unit: 'g' })
  expect(massRange('150gr')).toBeUndefined()
  expect(massRange('1-2-3gr')).toBeUndefined()
  expect(massRange('1.2.3-4g')).toBeUndefined()
  expect(massRange('1 5-3g')).toBeUndefined()
  expect(massRange('150-180')).toBeUndefined()
  expect(massRange('150-180 g r')).toBeUndefined()
})

it('rejects a long input that does not match without backtracking', () => {
  const start = performance.now()
  for (const text of [
    `${'1'.repeat(50000)}x`,
    `${' '.repeat(50000)}x`,
    `1-${' '.repeat(50000)}x`,
    `${'1.'.repeat(25000)}-g`,
  ]) {
    expect(massRange(text)).toBeUndefined()
  }
  // a backtracking regression takes seconds to minutes here, a coverage run on a loaded runner far less
  expect(performance.now() - start).toBeLessThan(5000)
})

it('shows a mass bound of the other unit at that unit display decimals', () => {
  // 150 gr in grams: 9.72 g, which filters as 150 gr does
  expect(convertMass(150, 'gr', 'g')).toBe(9.72)
  expect(convertMass(180, 'gr', 'g')).toBe(11.66)
  expect(convertMass(9.72, 'g', 'gr')).toBe(150)
  expect(convertMass(168, 'gr', 'gr')).toBe(168)
})
