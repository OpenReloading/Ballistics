import { lbPerSqInToKgPerSqM } from '@open-reloading/core'
import { toSi } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'

describe('stored to SI', () => {
  it('uses the solver factor for the ballistic coefficient', () => {
    expect(toSi('ballisticCoefficient', 1)).toBe(lbPerSqInToKgPerSqM)
  })
})
