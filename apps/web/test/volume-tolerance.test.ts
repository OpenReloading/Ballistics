import { describe, expect, it } from 'vitest'
import { capacityFraction, capacityTolerance, volumeFraction } from '../src/lib/volume-tolerance.ts'

const maker = (value: number, caseManufacturer?: string) => ({
  waterCapacity: { value },
  ...(caseManufacturer && { caseManufacturer }),
})

describe('capacityFraction', () => {
  it('takes the spread of measured cases over their capacity, 0.5 % without one', () => {
    expect(
      capacityFraction({ source: 'measured', grams: 49.14, spread: 0.13, records: [] }),
    ).toEqual({ fraction: 0.13 / 49.14, rule: 'spread' })
    expect(capacityFraction({ source: 'measured', grams: 49.14, records: [] })).toEqual({
      fraction: capacityTolerance.measured,
      rule: 'measured',
    })
  })

  it('takes the spread of records of two or more makers over their mean, else 2 %', () => {
    const two = [maker(54, 'catalogue:a'), maker(55, 'catalogue:b'), maker(56)]
    const r = capacityFraction({ source: 'capacity', grams: 54, records: two })
    expect(r.rule).toBe('makers')
    // sample standard deviation of 54 and 55 over their mean 54.5
    expect(r.fraction).toBeCloseTo(Math.SQRT1_2 / 54.5, 12)
    const one = [maker(54, 'catalogue:a'), maker(55, 'catalogue:a')]
    expect(capacityFraction({ source: 'case', grams: 54, records: one })).toEqual({
      fraction: capacityTolerance.catalogue,
      rule: 'catalogue',
    })
  })
})

describe('volumeFraction', () => {
  // stand-in volumes, cm3: case to the mouth and behind the seated bullet
  const rifle = { caseVolume: 3.6e-6, volume: 3.1e-6 }
  const handgun = { caseVolume: 0.86e-6, volume: 0.55e-6 }
  const catalogue = { fraction: capacityTolerance.catalogue }

  it('gives a handgun case a wider tolerance than a rifle case, both above the former 1 %', () => {
    const r = volumeFraction({ capacity: catalogue, ...rifle }) as number
    const h = volumeFraction({ capacity: catalogue, ...handgun }) as number
    expect(r).toBeCloseTo((0.02 * 3.6) / 3.1, 12)
    expect(h).toBeCloseTo((0.02 * 0.86) / 0.55, 12)
    expect(h).toBeGreaterThan(r)
    expect(r).toBeGreaterThan(0.01)
  })

  it("adds an estimated bullet volume's interval and stops at the API's limit", () => {
    expect(volumeFraction({ capacity: catalogue, ...rifle, bullet: 0.05 })).toBeCloseTo(
      (0.02 * 3.6) / 3.1 + 0.05,
      12,
    )
    expect(volumeFraction({ capacity: catalogue, ...handgun, bullet: 0.5 })).toBe(0.2)
    expect(volumeFraction({ capacity: undefined, ...rifle })).toBeUndefined()
  })
})
