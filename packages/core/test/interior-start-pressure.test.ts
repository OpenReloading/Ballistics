import { describe, expect, it } from 'vitest'
import { defaultStartPressure, InputError } from '../src/index.ts'

describe('default start pressure', () => {
  it('gives the rifle assumption from 300 mm and the fitted handgun value by construction below', () => {
    const rifle = defaultStartPressure(0.61, 'monolithic')
    expect(rifle.value).toBe(30e6)
    expect(rifle.interval).toBeUndefined()
    expect(rifle.approximate).toBe(true)
    expect(defaultStartPressure(0.3).value).toBe(30e6)
    const lead = defaultStartPressure(0.12, 'lead')
    expect(lead.value).toBe(24.3e6)
    expect(lead.interval).toEqual([16.7e6, 34.2e6])
    expect(defaultStartPressure(0.12, 'monolithic').value).toBe(50e6)
    expect(defaultStartPressure(0.12, 'plated').value).toBe(30.9e6)
    expect(defaultStartPressure(0.12)).toEqual(defaultStartPressure(0.12, 'jacketed'))
    expect(defaultStartPressure(0.12).value).toBe(30.8e6)
  })

  it('refuses a barrel that is not a positive number and an unknown construction', () => {
    for (const b of [Number.NaN, 0, -0.1]) expect(() => defaultStartPressure(b)).toThrow(InputError)
    for (const c of ['steel', 'constructor', 'toString'])
      expect(() => defaultStartPressure(0.12, c as never)).toThrow(InputError)
  })
})
