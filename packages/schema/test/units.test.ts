import { describe, expect, it } from 'vitest'
import { fromSi, type QuantityKind, quantityKind, toSi, units } from '../src/index.ts'

const kinds = Object.keys(units) as QuantityKind[]

describe('unit table', () => {
  it('has an entry for every quantity kind', () => {
    expect(kinds).toEqual(quantityKind.options)
  })

  it.each([
    ['length', 1, 1e-3],
    ['area', 1, 1e-6],
    ['mass', 1, 1e-3],
    ['density', 1, 1e3],
    ['pressure', 1, 1e5],
    ['angle', 180, Math.PI],
    ['temperature', 0, 273.15],
    ['temperature', 15, 288.15],
    ['absoluteTemperature', 300, 300],
    ['velocity', 800, 800],
    ['relativeHumidity', 50, 0.5],
    ['ballisticCoefficient', 1, 703.0695796],
  ] as const)('converts 1 stored %s value %s to SI %s', (kind, stored, si) => {
    expect(toSi(kind, stored)).toBeCloseTo(si, 6)
    expect(fromSi(kind, si)).toBeCloseTo(stored, 6)
  })

  it.each(kinds)('round-trips %s', (kind) => {
    for (const x of [-12.5, 0, 0.001, 1, 7.823, 3450.5])
      expect(fromSi(kind, toSi(kind, x))).toBeCloseTo(x, 9)
  })

  it('keeps the quantities that are stored in their SI unit unchanged', () => {
    for (const kind of [
      'energy',
      'velocity',
      'time',
      'absoluteTemperature',
      'specificEnergy',
      'molarMass',
      'specificVolume',
      'burnRate',
      'inverseTemperature',
      'count',
      'dimensionless',
    ] as const)
      expect(toSi(kind, 12.5)).toBe(12.5)
  })
})
