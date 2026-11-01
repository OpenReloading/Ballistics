import { describe, expect, it } from 'vitest'
import { stepBody, stepLoad } from '../src/components/workbench-outcome.ts'
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

describe('seating ladder step body', () => {
  const body = {
    model: 'm3',
    load: { charge: 0.003, chamber: { volume: 4e-6 }, barrel: { length: 0.6 } },
    tolerances: { volumeFraction: 0.05 },
  } as unknown as InteriorBody
  const seating = { value: 0.07, volume: 3.9e-6, travel: 0.53 }

  it("sends a seating step's own volume tolerance, or none, instead of the preview's", () => {
    const own = stepBody(body, { charge: 0.003, seating, volumeFraction: 0.08 })
    expect(own.tolerances).toEqual({ volumeFraction: 0.08 })
    expect(own.load.chamber.volume).toBe(3.9e-6)
    expect(stepBody(body, { charge: 0.003, seating }).tolerances).toBeUndefined()
  })

  it('keeps the run tolerance for a charge or temperature step', () => {
    expect(stepBody(body, { charge: 0.004 }).tolerances).toEqual({ volumeFraction: 0.05 })
    expect(stepBody(body, { charge: 0.003, temperature: 300 }).tolerances).toEqual({
      volumeFraction: 0.05,
    })
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
