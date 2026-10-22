import { describe, expect, it } from 'vitest'
import { resolveUnit } from '../src/units.ts'

describe('resolveUnit', () => {
  it('takes the file unit, a caller unit equal to it without a warning', () => {
    const warnings: string[] = []
    expect(resolveUnit('fps', { velocityUnit: 'ft/s' }, warnings)).toBe('ft/s')
    expect(resolveUnit('M/S', { velocityUnit: 'm/s' }, warnings)).toBe('m/s')
    expect(warnings).toEqual([])
  })
})
