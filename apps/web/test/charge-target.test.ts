import { describe, expect, it } from 'vitest'
import de from '../src/i18n/de.json'
import { type Catalogue, english, translator } from '../src/i18n/translate.ts'
import {
  answerOf,
  chargeTargetBody,
  checkedRequest,
  refusalText,
  targetNumber,
  targetUnit,
} from '../src/lib/charge-target.ts'
import { presetUnits } from '../src/lib/units.ts'

const german = translator(de as Catalogue, 'de')
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
      english.t,
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
      english.t,
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
      english.t,
    )
    expect(text).toContain(
      'lowest value is 5.0 % of Pmax at 1.00 g and the highest is 100.0 % of Pmax at 4.00 g',
    )
  })

  it('words the other reasons and falls back to the message', () => {
    expect(
      refusalText({ statusCode: 422, reason: 'notMonotone' }, 'barrelTime', si, false, english.t),
    ).toMatch(/more than one charge/)
    expect(
      refusalText({ statusCode: 500, message: 'boom' }, 'barrelTime', si, false, english.t),
    ).toBe('boom')
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
      english.t,
    )
    expect(text).toBe(
      'The simulation gives no valid run for this load. Reason: input; field: ignitionPressure.',
    )
    expect(
      refusalText({ statusCode: 422, reason: 'noValidRun' }, 'barrelTime', si, false, english.t),
    ).toMatch(/No charge in the range/)
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

describe('the answer kept for a language change', () => {
  const refusal = { reason: 'toleranceNotReached', message: 'x', error: 'unreachable' }
  const refused = () =>
    answerOf(new Response(null, { status: 422 }), refusal, 'peakPressure', si, false)

  it('writes a refusal in the language it is shown in, not the one it came in', () => {
    const out = refused()
    if (out.kind !== 'refused') throw new Error('expected a refusal')
    const en = out.text(english.t)
    expect(en).toBe('The search did not reach its tolerance.')
    expect(out.text(german.t)).not.toBe(en)
    expect(out.text(english.t)).toBe(en)
  })

  it('writes a value error under the language shown, from the stored value', () => {
    const checked = checkedRequest(
      0,
      targetUnit('loadRatio', si),
      'loadRatio',
      () => ({}) as { bulkDensity?: number },
    )
    if (!('text' in checked)) throw new Error('expected an error')
    expect(checked.text(english.t)).toBe('Enter a target above 0.')
    expect(checked.text(german.t)).toBe('Geben Sie eine Zielgröße über 0 ein.')
  })

  it('writes a failed answer from the API message in the language shown', () => {
    const out = answerOf(new Response(null, { status: 500 }), undefined, 'peakPressure', si, false)
    if (out.kind !== 'failed') throw new Error('expected a failure')
    expect(out.text(english.t)).toBe('Error 500.')
  })
})
