import type { PressureRange } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { type CartridgeWithSpecs, limitCheck, maximumCheck } from '../src/compute/limits.ts'

const range: PressureRange = {
  quantity: 'maxPressure',
  nominalPressure: 3.9e8,
  lowPressure: 3.5e8,
  highPressure: 4.3e8,
  complete: true,
  tolerances: {
    chargeFraction: 0.005,
    volumeFraction: 0.01,
    massFraction: 0,
    burnRateFraction: 0.03,
    temperatureKelvin: 5,
    startPressureFraction: 0.2,
  },
  cases: [],
}
const cartridge = (values: object[], over: object = {}): CartridgeWithSpecs => ({
  id: 'x',
  name: 'X',
  published: '2020-01-01',
  pressureMethod: 'transducer',
  provenance: { kind: 'published', sources: [{ title: 'Test standard' }] },
  values: values as CartridgeWithSpecs['values'],
  ...over,
})

describe('limitCheck', () => {
  it('compares each variant and names it in the message', () => {
    const { limits, warnings } = limitCheck(
      range,
      cartridge([
        { symbol: 'Pmax', quantity: 'pressure', value: 4200, variant: '12/70' },
        { symbol: 'Pmax', quantity: 'pressure', value: 4000, variant: '12/76' },
        { symbol: 'PK', quantity: 'pressure', value: 4600, variant: '12/76' },
      ]),
    )
    expect(limits?.map((l) => [l.variant, l.exceeded, l.nominalExceeded])).toEqual([
      ['12/70', true, false],
      ['12/76', true, false],
    ])
    expect(warnings.map((w) => w.message)).toEqual([
      'The upper end of the simulated peak pressure range, 4300 bar, is above CIP Pmax (12/70) 4200 bar (cip-x-2020-01-01; transducer); the nominal value is 3900 bar.',
      'The upper end of the simulated peak pressure range, 4300 bar, is above CIP Pmax (12/76) 4000 bar (cip-x-2020-01-01; transducer); the nominal value is 3900 bar.',
    ])
  })

  it('ignores other symbols, lists values without a number', () => {
    const { limits, warnings } = limitCheck(
      range,
      cartridge([
        { symbol: 'PK', quantity: 'pressure', value: 1000 },
        { symbol: 'Pmax', quantity: 'pressure' },
        { symbol: 'Pmax', quantity: 'pressure', value: 5000 },
      ]),
    )
    expect(limits?.map((l) => [l.cartridge, l.revised, l.compared, l.reason, l.exceeded])).toEqual([
      ['x', '2020-01-01', false, 'noValue', undefined],
      ['x', '2020-01-01', true, undefined, false],
    ])
    expect(limits?.[0]).not.toHaveProperty('standard')
    expect(warnings).toEqual([])
  })

  it('dates the limit by the revision, else the publication', () => {
    const revised = cartridge([{ symbol: 'Pmax', quantity: 'pressure', value: 4000 }], {
      revised: '2024-05-06',
    })
    const { limits, warnings } = limitCheck(range, revised)
    expect(limits?.[0]?.revised).toBe('2024-05-06')
    expect(warnings[0]).toMatchObject({ code: 'limitExceeded', spec: 'cip-x-2024-05-06' })
  })

  it('prints the stored decimals of a limit and enough decimals to keep a value on its side', () => {
    const pmax = (value: number) => cartridge([{ symbol: 'Pmax', quantity: 'pressure', value }])
    const near = { ...range, nominalPressure: 4274.74e5, highPressure: 4274.9e5 }
    expect(limitCheck(near, pmax(4274.75)).warnings[0]?.message).toBe(
      'The upper end of the simulated peak pressure range, 4275 bar, is above CIP Pmax 4274.75 bar (cip-x-2020-01-01; transducer); the nominal value is 4274.7 bar.',
    )
    const at = { ...range, nominalPressure: 4274.75e5, highPressure: 4274.751e5 }
    expect(limitCheck(at, pmax(4274.75)).warnings[0]?.message).toBe(
      'The upper end of the simulated peak pressure range, 4275 bar, is above CIP Pmax 4274.75 bar (cip-x-2020-01-01; transducer); the nominal value is 4274.75 bar.',
    )
    const whole = { ...range, nominalPressure: 4000.3e5, highPressure: 4100e5 }
    expect(limitCheck(whole, pmax(4000)).warnings[0]?.message).toBe(
      'Simulated peak pressure 4000.3 bar (range 3500 to 4100 bar) is above CIP Pmax 4000 bar (cip-x-2020-01-01; transducer).',
    )
  })

  it('adds rangeIncomplete with the reasons, and never says safe', () => {
    const incomplete = {
      ...range,
      complete: false,
      cases: [
        {
          input: 'chargeFraction' as const,
          side: 1 as const,
          maxPressure: null,
          reason: 'chargeTooHigh',
        },
        { input: 'chargeFraction' as const, side: -1 as const, maxPressure: 3.8e8 },
      ],
    }
    const { warnings } = limitCheck(incomplete, undefined)
    expect(warnings.map((w) => w.code)).toEqual(['noCartridge', 'rangeIncomplete'])
    expect(warnings[1]?.message).toBe(
      '1 of 2 range cases could not be computed (chargeTooHigh); the range covers only the computed cases, and the true range can be wider.',
    )
    for (const w of warnings) expect(w.message).not.toMatch(/safe/i)
  })

  it('adds chargeTooSmall below 2.2 times the start or the ignition pressure', () => {
    const pmax = cartridge([{ symbol: 'Pmax', quantity: 'pressure', value: 4000 }])
    const low = { ...range, nominalPressure: 5e7, lowPressure: 4e7, highPressure: 6e7 }
    const check = (meanPressure: number, startPressure: number, ignitionPressure: number) =>
      limitCheck(low, pmax, {
        result: { maxMeanPressure: meanPressure },
        load: { startPressure, ignitionPressure },
      }).warnings
    expect(check(4.41e7, 2e7, 1e6)).toEqual([])
    // no part compares with the cartridge maximum pressure
    expect(check(4.5e6, 0, 2e6)).toEqual([])
    expect(check(4.39e7, 2e7, 1e6)).toEqual([
      {
        code: 'chargeTooSmall',
        message:
          'Charge too small for the model: the simulated peak mean pressure, 439 bar, is below 2.2 times the start pressure (200 bar); results are outside the range the model was built for.',
      },
    ])
    expect(check(4.3e6, 0, 2e6)).toEqual([
      {
        code: 'chargeTooSmall',
        message:
          'Charge too small for the model: the simulated peak mean pressure, 43 bar, is below 2.2 times the ignition pressure (20 bar); results are outside the range the model was built for.',
      },
    ])
  })
})

describe('maximumCheck', () => {
  const spread = {
    ...range,
    cases: [
      { input: 'burnRateFraction' as const, side: 1 as const, maxPressure: 4.2e8 },
      { input: 'burnRateFraction' as const, side: -1 as const, maxPressure: 3.6e8 },
      { input: 'chargeFraction' as const, side: 1 as const, maxPressure: 3.95e8 },
      { input: 'chargeFraction' as const, side: -1 as const, maxPressure: 3.85e8 },
    ],
  }

  it('states the range for each class and names the dominant input', () => {
    const at = (pa: number) => maximumCheck(spread, pa)
    expect(at(3.9e8)).toMatchObject({
      class: 'inputPlausible',
      dominantInput: 'burnRateFraction',
      message:
        'The entered maximum, 3900 bar, is inside the simulated peak-pressure range of this load, 3500 bar to 4300 bar.',
    })
    expect(at(3.4e8)).toMatchObject({
      class: 'modelDiscrepancy',
      message:
        'The entered maximum, 3400 bar, is below the lower end of the simulated peak-pressure range of this load, 3500 bar. The simulation and the entered maximum do not agree for these inputs.',
    })
    expect(at(4.4e8)).toMatchObject({
      class: 'aboveRange',
      message:
        'The entered maximum, 4400 bar, is above the upper end of the simulated peak-pressure range, 4300 bar.',
    })
  })

  it('makes no statement about a load', () => {
    for (const pa of [3.4e8, 3.9e8, 4.4e8])
      expect(maximumCheck(spread, pa).message).not.toMatch(/safe|load is|charge/i)
  })
})
