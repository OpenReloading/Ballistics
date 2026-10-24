import { lbPerSqInToKgPerSqM } from '@openreloading/core'
import { toSi } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'

describe('stored to SI', () => {
  it('uses the solver factor for the ballistic coefficient', () => {
    expect(toSi('ballisticCoefficient', 1)).toBe(lbPerSqInToKgPerSqM)
  })
})
