import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Outcome } from '../src/components/workbench-outcome.ts'
import { peakFacts } from '../src/components/workbench-readouts.tsx'
import de from '../src/i18n/de.json'
import { setShownLanguage } from '../src/i18n/shown.ts'
import { type Catalogue, english, type Translator, translator } from '../src/i18n/translate.ts'
import type { InteriorResponse } from '../src/lib/api-types.ts'
import { installCoreMessages } from '../src/lib/core-message-table.ts'
import { presetUnits } from '../src/lib/units.ts'
import {
  bandLine,
  bandNotice,
  bulletLeadTime,
  mmLength,
  percentOfPressureLimit,
  rangeCardNote,
  rangeHero,
  resultBand,
  resultTabsFit,
  shownLength,
  shownWarnings,
  solidFillWarning,
  statusText,
  stepLabel,
  warningCountText,
} from '../src/lib/workbench.ts'
import { defined, missing } from './defined.ts'

type Limit = NonNullable<InteriorResponse['limits']>[number]
const limit = (l: Partial<Limit>): Limit => ({
  cartridge: '308-win',
  revised: '2008-09-23',
  symbol: 'Pmax',
  method: 'transducer',
  compared: true,
  ...l,
})

describe('percentOfMax', () => {
  it('divides the peak pressure by the first compared limit', () => {
    const limits = [
      limit({ compared: false, reason: 'crusher', pressure: 3.0e8 }),
      limit({ pressure: 4.15e8 }),
      limit({ pressure: 5e8 }),
    ]
    const p = percentOfPressureLimit(3.81e8, limits)
    expect(p?.percent).toBeCloseTo(91.807, 3)
    expect(p?.limit.pressure).toBe(4.15e8)
  })

  it('is undefined without a compared limit', () => {
    expect(percentOfPressureLimit(3.81e8, undefined)).toBeUndefined()
    expect(
      percentOfPressureLimit(3.81e8, [limit({ compared: false, reason: 'noValue' })]),
    ).toBeUndefined()
  })
})

describe('leadTime', () => {
  it('is the muzzle time less the 10 % pressure time, both from ignition', () => {
    expect(bulletLeadTime({ muzzleTime: 1.2e-3, tenPercentPressureTime: 0.25e-3 })).toBeCloseTo(
      0.95e-3,
      12,
    )
  })

  it('is undefined when the 10 % pressure time is 0', () => {
    expect(bulletLeadTime({ muzzleTime: 1.2e-3, tenPercentPressureTime: 0 })).toBeUndefined()
  })
})

describe('solidFillWarning', () => {
  const volume = 3.4e-6
  const at = (fill: number) => fill * 1600 * volume

  it('warns above the solid fill limit only', () => {
    expect(solidFillWarning(at(0.639), 1600, 900, volume, english.t)).toBeUndefined()
    expect(solidFillWarning(at(0.65), 1600, undefined, volume, english.t)).toEqual({
      text: 'Simulation: solid fill 0.65 is above 0.64; the model is outside the range it was built for.',
      name: 'solid fill above 0.64',
    })
  })

  it('gives the load ratio and its limit for the powder with a bulk density', () => {
    expect(solidFillWarning(at(0.65), 1600, 900, volume, english.t)?.text).toBe(
      'Simulation: load ratio 1.16 is above 1.14, solid fill 0.64 for this powder; the model is outside the range it was built for.',
    )
  })
})

describe('warningsSummary', () => {
  it('counts the warnings as simulation warnings', () => {
    expect(warningCountText(0, english.tn)).toBe('')
    expect(warningCountText(1, english.tn)).toBe('1 simulation warning')
    expect(warningCountText(2, english.tn)).toBe('2 simulation warnings')
  })
})

describe('shownWarnings', () => {
  const psi = 0.45359237 * 9.80665 * 0.0254 ** -2
  /** An answer whose peak and range are above or across CIP Pmax 4150 bar (60191 psi). */
  const body = (nominal: number, low: number, high: number) =>
    ({
      pressureRange: { nominalPressure: nominal, lowPressure: low, highPressure: high },
      limits: [
        limit({
          pressure: 4150e5,
          exceeded: high > 4150e5,
          nominalExceeded: nominal > 4150e5,
        }),
      ],
      warnings: [
        {
          code: 'limitExceeded',
          spec: 'cip-308-win-2008-09-23',
          symbol: 'Pmax',
          method: 'transducer',
          message: 'in bar',
        },
        {
          code: 'chargeTooSmall',
          message:
            'Charge too small for the model: the simulated peak mean pressure, 250 bar, is low',
        },
        { code: 'test', message: 'Other warning.' },
        { code: 'gyrationRadiusWithoutTwist', message: 'Twist is 0.' },
      ],
    }) as unknown as InteriorResponse

  it('writes an exceeded limit in the page unit with the sheet date and method, and names it', () => {
    const [line, small, other, ignored] = shownWarnings(
      body(4766e5, 4174e5, 5460e5),
      presetUnits('us'),
      english.t,
    )
    expect(line).toEqual({
      text: 'Simulated peak pressure 69125 psi (range 60539 to 79191 psi) is above CIP Pmax 60191 psi, source CIP (2008-09-23, transducer).',
      name: 'above CIP Pmax',
    })
    expect(small).toEqual({
      text: 'Charge too small for the model: the simulated peak mean pressure, 3626 psi, is low',
      name: 'charge too small for the model',
    })
    expect(other).toEqual({ text: 'Other warning.', name: undefined })
    expect(ignored).toEqual({ text: 'Twist is 0.', name: 'gyration radius ignored' })
  })

  it('converts every bar value of a message and leaves other words alone', () => {
    const warned = (message: string) =>
      ({
        ...body(4000e5, 3600e5, 4400e5),
        warnings: [{ code: 'test', message }],
      }) as unknown as InteriorResponse
    const [us = missing()] = shownWarnings(
      warned('1.5 bar and 25 bar, 3 barrel'),
      presetUnits('us'),
      english.t,
    )
    expect(us.text).toBe('22 psi and 363 psi, 3 barrel')
    const [metric = missing()] = shownWarnings(
      warned('1.5 bar and 25 bar'),
      presetUnits('metric-grains'),
      english.t,
    )
    expect(metric.text).toBe('1.5 bar and 25 bar')
  })

  it('keeps bar with the record decimals and names a range above the limit', () => {
    const [line, small = missing()] = shownWarnings(
      body(4000e5, 3600e5, 4400e5),
      presetUnits('metric-grains'),
      english.t,
    )
    expect(line).toEqual({
      text: 'The upper end of the simulated peak pressure range, 4400 bar, is above CIP Pmax 4150 bar, source CIP (2008-09-23, transducer); the nominal value is 4000 bar.',
      name: 'range above CIP Pmax',
    })
    expect(small.text).toContain('250 bar')
  })

  it('writes each exceeded limit with its own variant and value', () => {
    const exceeded = (variant: string, pressure: number) => ({
      limit: limit({ variant, pressure, exceeded: true, nominalExceeded: true }),
      warning: {
        code: 'limitExceeded',
        spec: 'cip-308-win-2008-09-23',
        symbol: 'Pmax',
        variant,
        method: 'transducer',
        message: 'in bar',
      },
    })
    const [a, b] = [exceeded('A', 4150e5), exceeded('B', 3800e5)]
    const lines = shownWarnings(
      {
        pressureRange: { nominalPressure: 4500e5, lowPressure: 4300e5, highPressure: 4700e5 },
        limits: [limit({ variant: 'A', compared: false, reason: 'noValue' }), a.limit, b.limit],
        warnings: [a.warning, b.warning],
      } as unknown as InteriorResponse,
      presetUnits('metric-grains'),
      english.t,
    )
    expect(lines.map((l) => l.name)).toEqual(['above CIP Pmax (A)', 'above CIP Pmax (B)'])
    expect(defined(lines[0]).text).toContain('above CIP Pmax (A) 4150 bar')
    expect(defined(lines[1]).text).toContain('above CIP Pmax (B) 3800 bar')
  })

  it('adds decimals while rounding would put a pressure on the limit', () => {
    // 60190.8 psi rounds to the limit's 60191 psi: one decimal keeps it above 60190.7 psi
    const [line = missing()] = shownWarnings(
      body(60190.8 * psi, 4000e5, 4400e5),
      presetUnits('us'),
      english.t,
    )
    expect(line.text).toMatch(
      /^Simulated peak pressure 60190\.8 psi \(range \d+ to 63816\.6 psi\) is above CIP Pmax 60190\.7 psi,/,
    )
  })
})

describe('shownLength', () => {
  it('gives travels to 0.1 mm or 0.01 in and diameters to 0.01 mm or 0.001 in', () => {
    const [metric, us] = [presetUnits('metric-grains'), presetUnits('us')]
    expect(shownLength('travel', us, 22.5028 * 0.0254)).toBe('22.50 in')
    expect(shownLength('travel', metric, 0.334621)).toBe('334.6 mm')
    expect(shownLength('diameter', us, 0.308 * 0.0254)).toBe('.308 in')
    expect(shownLength('diameter', metric, 7.823e-3)).toBe('7.82 mm')
  })
})

describe('mmLength', () => {
  it('shows a length given in mm in the Settings unit', () => {
    const [metric, us] = [presetUnits('metric-grains'), presetUnits('us')]
    expect(mmLength(metric, 7.82)).toBe('7.82 mm')
    expect(mmLength(us, 7.82)).toBe('.308 in')
    expect(mmLength(metric, 0.03)).toBe('0.03 mm')
    expect(mmLength(us, 0.03)).toBe('.001 in')
  })
})

describe('stepLabel', () => {
  // the main charge is 0, lower charges count down, higher ones up
  const labels = (n: number, d: 'up' | 'down' | 'around') =>
    Array.from({ length: n }, (_, i) => stepLabel(i, n, d))
  it('counts up from the main charge', () => {
    expect(labels(3, 'up')).toEqual(['0', '+1', '+2'])
  })
  it('counts down from the main charge', () => {
    expect(labels(3, 'down')).toEqual(['0', '−1', '−2'])
  })
  it('centres around the main charge, lowest first', () => {
    expect(labels(5, 'around')).toEqual(['−2', '−1', '0', '+1', '+2'])
  })
  it('gives the one step 0', () => {
    expect(labels(1, 'up')).toEqual(['0'])
    expect(labels(1, 'around')).toEqual(['0'])
  })
})

describe('tabsThatFit', () => {
  // the result tabs that fit their row; the rest go into the More menu
  it('keeps every tab that fits', () => {
    expect(resultTabsFit([50, 60, 70], 180)).toBe(3)
  })
  it('stops at the first tab past the room', () => {
    expect(resultTabsFit([50, 60, 70], 179)).toBe(2)
    expect(resultTabsFit([50, 60, 70], 49)).toBe(0)
  })
  it('keeps every tab before the row is measured', () => {
    expect(resultTabsFit([50, 60], 0)).toBe(2)
  })
})

describe('rangeHero', () => {
  const grain = 0.06479891e-3
  const fps = 0.3048
  it('gives charge and velocity in the preset units, the step only on a ladder', () => {
    const us = presetUnits('us')
    expect(rangeHero(us, 42.5 * grain, 2511 * fps, undefined, english.t)).toEqual({
      step: undefined,
      charge: { value: '42.5', unit: 'gr' },
      velocity: { value: '2511', unit: 'ft/s' },
    })
    expect(rangeHero(us, 42.5 * grain, 2511 * fps, '−1', english.t).step).toBe('Step −1')
  })
  it('follows the metric velocity unit', () => {
    expect(
      rangeHero(presetUnits('metric-grains'), 42.5 * grain, 765.3, '0', english.t).velocity,
    ).toEqual({
      value: '765',
      unit: 'm/s',
    })
  })
})

describe('rangeCardNote', () => {
  it('names a missing bullet record at once, never while the trajectory result computes', () => {
    expect(rangeCardNote(true, 'bravo-168', false, english.t)).toBe('')
    expect(rangeCardNote(true, undefined, false, english.t)).toBe(
      'The range card needs a bullet record.',
    )
    expect(rangeCardNote(false, undefined, true, english.t)).toBe('')
  })

  it('points at the Trajectory tab once the result stays away with a bullet record chosen', () => {
    expect(rangeCardNote(true, 'bravo-168', true, english.t)).toBe(
      'The range card needs a Trajectory result: see the Trajectory tab.',
    )
  })
})

describe('statusText', () => {
  it('writes a result status from the line of the units shown now, with its prefix', () => {
    expect(statusText({ prefix: '' }, 'Peak 4 bar.', english.t)).toBe('Peak 4 bar.')
    expect(statusText({ prefix: 'Simulation done. ' }, 'Peak 58 psi.', english.t)).toBe(
      'Simulation done. Peak 58 psi.',
    )
  })

  it('writes a stored text and prefix in the language shown now', () => {
    const german = translator(de as Catalogue, 'de')
    const done = { prefix: (t: Translator['t']) => t('Simulation done. ') }
    expect(statusText(done, 'Peak 4 bar.', english.t)).toBe('Simulation done. Peak 4 bar.')
    expect(statusText(done, 'Peak 4 bar.', german.t)).toBe('Simulation abgeschlossen. Peak 4 bar.')
    const running = { say: (t: Translator['t']) => t('Simulating') }
    expect(statusText(running, undefined, english.t)).toBe('Simulating')
    expect(statusText(running, undefined, german.t)).toBe('Simulation läuft')
  })

  it('shows another status as it is, and no result status without a result', () => {
    expect(statusText('Simulating', 'Peak 4 bar.', english.t)).toBe('Simulating')
    expect(statusText('The API answered 502.', undefined, english.t)).toBe('The API answered 502.')
    expect(statusText({ prefix: '' }, undefined, english.t)).toBe('')
  })
})

describe('sampled band', () => {
  const pressureRange = {
    nominalPressure: 3e8,
    lowPressure: 2.8e8,
    highPressure: 3.3e8,
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
  const sampled = {
    status: 'sampled' as const,
    samples: 500,
    seed: 1,
    failed: 0,
    budgetMs: 2500,
    pressure: { p05: 2.9e8, p50: 3e8, p95: 3.2e8 },
    velocity: { p05: 830, p50: 840, p95: 850 },
  }
  const body = (extra: Partial<InteriorResponse>) =>
    ({ pressureRange, ...extra }) as InteriorResponse

  it('shows the percentiles of a sampled band', () => {
    expect(resultBand(body({ sampled }))).toEqual({
      sampled: true,
      pressure: { low: 2.9e8, high: 3.2e8 },
      velocity: { low: 830, high: 850 },
    })
    expect(bandNotice(sampled, english.t)).toBe('input tolerances only')
  })

  it('keeps the printed report on the corner-case range whether or not the sampling answered', () => {
    expect(resultBand(body({ sampled }), true)).toEqual(resultBand(body({}), true))
    expect(resultBand(body({}), true).pressure).toEqual({ low: 2.8e8, high: 3.3e8 })
  })

  it('shows the corner-case range and says so when the sampling went over budget', () => {
    const over = { status: 'overBudget' as const, samples: 500, seed: 1, failed: 0, budgetMs: 2500 }
    expect(resultBand(body({ sampled: over }))).toEqual({
      sampled: false,
      pressure: { low: 2.8e8, high: 3.3e8 },
      velocity: undefined,
    })
    expect(bandNotice(over, english.t)).toBe('over budget')
  })

  it('says what each sampling answer covers, and why the corner-case range stands in for a band', () => {
    const units = presetUnits('metric-grains')
    expect(bandLine(body({ sampled }), units, english.t)).toBe(
      'Velocity 830 to 850 m/s. 5th to 95th percentile, input tolerances only.',
    )
    for (const [status, word] of [
      ['overBudget', 'over budget'],
      ['invalid', 'no valid draw'],
    ] as const)
      expect(
        bandLine(
          body({ sampled: { ...sampled, status, pressure: undefined, velocity: undefined } }),
          units,
          english.t,
        ),
      ).toBe(`Sampled bands ${word}: corner-case range shown.`)
    expect(bandLine(body({ sampled: { status: 'failed' } }), units, english.t)).toBe(
      'Sampled bands not finished: corner-case range shown.',
    )
    expect(bandLine(body({}), units, english.t)).toBeUndefined()
  })

  it('shows the corner-case range without a word for a result that did not ask for sampling', () => {
    expect(resultBand(body({})).sampled).toBe(false)
    expect(bandNotice(undefined, english.t)).toBeUndefined()
  })

  it('states the sample count, the seed and that the band covers the input tolerances only', () => {
    const ok = {
      body: body({
        sampled,
        result: { maxPressureTime: 1e-4, maxPressureTravel: 0.01 } as InteriorResponse['result'],
      }),
    } as Extract<Outcome, { kind: 'ok' }>
    const text = peakFacts(ok, presetUnits('metric-grains'), english.t)
    expect(text).toContain('500 draws (seed 1)')
    expect(text).toContain('The band covers the input tolerances only, no model error')
  })
})

describe('in German', () => {
  const german = translator(de as Catalogue, 'de')
  installCoreMessages()
  beforeEach(() => setShownLanguage('de'))
  afterEach(() => setShownLanguage('en'))
  const pressureRange = { nominalPressure: 4000e5, lowPressure: 3600e5, highPressure: 4400e5 }
  const sheet = (message: string) =>
    ({
      pressureRange,
      limits: [limit({ pressure: 4150e5, exceeded: true, nominalExceeded: false })],
      warnings: [
        {
          code: 'limitExceeded',
          spec: 'cip-308-win-2008-09-23',
          symbol: 'Pmax',
          method: 'transducer',
          message: 'in bar',
        },
        { code: 'chargeTooSmall', message },
        { code: 'noCartridge', message: 'No cartridge id was given, so no CIP Pmax was checked.' },
      ],
    }) as unknown as InteriorResponse
  const small =
    'Charge too small for the model: the simulated peak mean pressure, 250 bar, is below 2.2 times the start pressure (200 bar); results are outside the range the model was built for.'

  it('writes the warnings of an answer in German with the decimal comma', () => {
    const [line, charge, none] = shownWarnings(sheet(small), presetUnits('metric-grains'), german.t)
    expect(line).toEqual({
      text: 'Das obere Ende des simulierten Gasdruckbereichs, 4400 bar, liegt über CIP Pmax 4150 bar, Quelle CIP (2008-09-23, mechanisch-elektrischer Wandler); der Nennwert beträgt 4000 bar.',
      name: 'Bereich über CIP Pmax',
    })
    expect(charge).toEqual({
      text: 'Ladung zu klein für das Modell: Der simulierte höchste mittlere Druck, 250 bar, liegt unter dem 2,2-Fachen des Startdrucks (200 bar); die Ergebnisse liegen außerhalb des Bereichs, für den das Modell gebaut wurde.',
      name: 'Ladung zu klein für das Modell',
    })
    expect(none).toEqual({
      text: 'Es wurde keine Patronen-ID angegeben, daher wurde kein CIP-Pmax geprüft.',
      name: 'keine Patrone',
    })
  })

  it('converts the pressures of a message before it is translated', () => {
    const [, charge] = shownWarnings(sheet(small), presetUnits('us'), german.t)
    expect(charge?.text).toContain('3626 psi')
    expect(charge?.text).toContain('(2901 psi)')
  })

  it('writes the solid fill warning and the counts', () => {
    const fill = solidFillWarning(0.65 * 1600 * 3.4e-6, 1600, undefined, 3.4e-6, german.t)
    expect(fill).toEqual({
      text: 'Simulation: Der Feststoff-Füllgrad 0,65 liegt über 0,64; das Modell liegt außerhalb des Bereichs, für den es gebaut wurde.',
      name: 'Feststoff-Füllgrad über 0,64',
    })
    expect(warningCountText(1, german.tn)).toBe('1 Simulationswarnung')
    expect(warningCountText(2, german.tn)).toBe('2 Simulationswarnungen')
  })

  it('writes the notes of the range view and the sampled band in German', () => {
    expect(rangeCardNote(true, undefined, false, german.t)).toBe(
      'Die Schusstafel braucht einen Geschossdatensatz.',
    )
    expect(rangeHero(presetUnits('us'), 0.0027, 765, '−1', german.t).step).toBe('Schritt −1')
    expect(bandNotice({ status: 'invalid' } as never, german.t)).toBe('keine gültige Ziehung')
  })
})
