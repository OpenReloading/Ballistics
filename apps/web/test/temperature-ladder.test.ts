import { describe, expect, it } from 'vitest'
import { stepLoad } from '../src/components/workbench-outcome.ts'
import type { InteriorBody } from '../src/lib/interior-input.ts'
import { presetUnits, resolveUnits } from '../src/lib/units.ts'

describe('temperature ladder step', () => {
  const load = {
    charge: 0.003,
    propellantTemperature: 294.15,
    chamber: { volume: 4e-6 },
    barrel: { length: 0.6 },
  } as unknown as InteriorBody['load']

  it('runs the load at the propellant temperature of the step and keeps the rest', () => {
    const at = stepLoad(load, { charge: 0.003, temperature: 313.15 })
    expect(at.propellantTemperature).toBe(313.15)
    expect({ ...at, propellantTemperature: 0 }).toEqual({ ...load, propellantTemperature: 0 })
  })

  it('leaves the temperature of a charge or seating step alone', () => {
    expect(stepLoad(load, { charge: 0.004 }).propellantTemperature).toBe(294.15)
  })
})

describe('temperature difference unit', () => {
  it('is a step without the offset of a temperature', () => {
    const [metric, us] = [presetUnits('metric-grams'), presetUnits('us')]
    expect(metric.temperatureDifference.fromSi(5)).toBe(5)
    expect(us.temperatureDifference.fromSi(5)).toBeCloseTo(9, 12)
    expect(us.temperatureDifference.toSi(9)).toBeCloseTo(5, 12)
  })

  it('follows the unit chosen for the temperature', () => {
    const system = resolveUnits({ preset: 'metric-grams', overrides: { temperature: 'degF' } })
    expect(system.temperatureDifference.symbol).toBe('°F')
  })
})
