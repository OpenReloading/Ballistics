import { describe, expect, it } from 'vitest'
import { checkCase } from '../src/plausibility.ts'

describe('checkCase', () => {
  const sheet = {
    values: [
      { side: 'cartridge' as const, symbol: 'P1', quantity: 'length' as const, value: 11.9 },
      { side: 'cartridge' as const, symbol: 'L3', quantity: 'length' as const, value: 51 },
    ],
  }

  it('accepts values in range, a capacity inside the case cylinder included', () => {
    expect(
      checkCase(
        { flashHole: { value: 2 }, mass: { value: 11.4 }, waterCapacity: { value: 3.6 } },
        sheet,
      ),
    ).toEqual([])
    expect(checkCase({}, undefined)).toEqual([])
  })

  it('reports a flash hole or mass outside the range, and a capacity above the cylinder', () => {
    const findings = checkCase(
      { flashHole: { value: 20 }, mass: { value: 0.01 }, waterCapacity: { value: 9 } },
      sheet,
    )
    expect(findings.map((f) => f.finding)).toEqual([
      'flashHole-range',
      'mass-range',
      'capacity-range',
    ])
  })
})
