import { assert, property } from 'fast-check'
import { describe, expect, it } from 'vitest'
import { degreesOfFreedom, positive, probability, velocities } from '../src/index.ts'

describe('arbitraries', () => {
  it('draws probabilities strictly between 0 and 1', () => {
    assert(property(probability(), (p) => p > 0 && p < 1))
  })

  it('draws positive numbers up to the maximum', () => {
    assert(property(positive(5), (x) => x > 0 && x <= 5))
  })

  it('draws whole degrees of freedom from 1 to the maximum', () => {
    assert(property(degreesOfFreedom(30), (n) => Number.isInteger(n) && n >= 1 && n <= 30))
  })

  it('draws strings of velocities with a shot count in range', () => {
    assert(
      property(velocities(2, 10), (v) => {
        expect(v.length).toBeGreaterThanOrEqual(2)
        expect(v.length).toBeLessThanOrEqual(10)
        expect(v.every((x) => x >= 100 && x <= 1500)).toBe(true)
      }),
    )
  })
})
