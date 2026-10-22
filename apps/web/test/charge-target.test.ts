import { describe, expect, it } from 'vitest'
import {
  chargeTargetBody,
  refusalText,
  targetNumber,
  targetUnit,
} from '../src/lib/charge-target.ts'
import { presetUnits } from '../src/lib/units.ts'

const si = presetUnits('metric-grams')
const us = presetUnits('us')

describe('chargeTargetBody', () => {
  it('drops the model, adds the target and the propellant bulk density in kg/m3', () => {
    const load = { charge: 0.002, propellant: { gamma: 1.2 } }
    const body = chargeTargetBody({ model: 'm3', load, cartridge: '308-win' }, 900, {
      kind: 'peakPressure',
      value: 80,
      percent: true,
    })
    expect(body).toEqual({
      load: { charge: 0.002, propellant: { gamma: 1.2, bulkDensity: 900 } },
      cartridge: '308-win',
      target: { kind: 'peakPressure', value: 80, unit: 'percentOfLimit' },
    })
  })

  it('sends an absolute target without a unit and without a bulk density', () => {
    const body = chargeTargetBody({ model: 'm3', load: { propellant: {} } }, undefined, {
      kind: 'muzzleVelocity',
      value: 800,
      percent: false,
    })
    expect(body).toEqual({
      load: { propellant: {} },
      target: { kind: 'muzzleVelocity', value: 800 },
    })
  })
})

describe('targetUnit', () => {
  it('follows the unit system for pressure and velocity, ms for times', () => {
    expect(targetUnit('peakPressure', si).symbol).toBe('bar')
    expect(targetUnit('peakPressure', us).symbol).toBe('psi')
    expect(targetUnit('muzzleVelocity', us).symbol).toBe('ft/s')
    expect(targetUnit('barrelTime', si).toSi(1.2)).toBeCloseTo(1.2e-3, 12)
    expect(targetUnit('peakPressure', si, true).fromSi(80)).toBe(80)
  })
})

describe('refusalText', () => {
  const reachable = {
    minValue: { value: 2e7, charge: 0.001 },
    maxValue: { value: 4e8, charge: 0.004 },
  }

  it('gives the reachable values and charges in the units shown', () => {
    const text = refusalText(
      { statusCode: 422, reason: 'aboveRange', reachable },
      'peakPressure',
      si,
      false,
    )
    expect(text).toContain('does not reach this high a value')
    expect(text).toContain(
      'the lowest value is 200 bar at 1.00 g and the highest is 4000 bar at 4.00 g',
    )
  })

  it('pairs each extreme with its own charge where the curve is not monotone', () => {
    const peak = {
      minValue: { value: 2e7, charge: 0.004 },
      maxValue: { value: 4e8, charge: 0.002 },
    }
    const text = refusalText(
      { statusCode: 422, reason: 'aboveRange', reachable: peak },
      'peakPressure',
      si,
      false,
    )
    expect(text).toContain('lowest value is 200 bar at 4.00 g')
    expect(text).toContain('highest is 4000 bar at 2.00 g')
  })

  it('gives the reachable pressures as percentages of the limit for a percentage target', () => {
    const text = refusalText(
      { statusCode: 422, reason: 'belowRange', reachable, target: { limit: { pressure: 4e8 } } },
      'peakPressure',
      si,
      true,
    )
    expect(text).toContain(
      'lowest value is 5.0 % of Pmax at 1.00 g and the highest is 100.0 % of Pmax at 4.00 g',
    )
  })

  it('words the other reasons and falls back to the message', () => {
    expect(
      refusalText({ statusCode: 422, reason: 'notMonotone' }, 'barrelTime', si, false),
    ).toMatch(/more than one charge/)
    expect(refusalText({ statusCode: 500, message: 'boom' }, 'barrelTime', si, false)).toBe('boom')
  })

  it('names the failing run of the load for noValidRun, not the target', () => {
    const text = refusalText(
      {
        statusCode: 422,
        reason: 'noValidRun',
        failure: { reason: 'input', field: 'ignitionPressure' },
      },
      'peakPressure',
      si,
      false,
    )
    expect(text).toBe(
      'The simulation gives no valid run for this load. Reason: input; field: ignitionPressure.',
    )
    expect(refusalText({ statusCode: 422, reason: 'noValidRun' }, 'barrelTime', si, false)).toMatch(
      /No charge in the range/,
    )
  })
})

describe('targetNumber', () => {
  it('reads the text of a number input, also while it is being typed', () => {
    expect(targetNumber(12)).toBe(12)
    expect(targetNumber('12.')).toBe(12)
    expect(targetNumber(' 0.5 ')).toBe(0.5)
    expect(targetNumber('.5')).toBe(0.5)
    expect(targetNumber('0.')).toBe(0)
    expect(targetNumber('')).toBeNaN()
    expect(targetNumber('1,5')).toBeNaN()
    expect(targetNumber('abc')).toBeNaN()
  })
})
