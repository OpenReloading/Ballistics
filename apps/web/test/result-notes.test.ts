import { describe, expect, it } from 'vitest'
import {
  derived,
  type Outcome,
  resultNotes,
  unlistedCartridge,
  warningsText,
} from '../src/components/workbench-outcome.ts'
import { english } from '../src/i18n/translate.ts'
import type { InteriorResponse } from '../src/lib/api-types.ts'
import { presetUnits } from '../src/lib/units.ts'

type Ok = Extract<Outcome, { kind: 'ok' }>
const units = presetUnits('metric-grains')

/** A result that raises every source of the notes: warnings, the unmeasured volume, the case fill without bulk density, the three designs and the sampled band. */
const ok = (extra: Partial<Ok> = {}) =>
  ({
    body: {
      result: { peakBreechPressure: 3e8, muzzleTime: 1e-3, tenPercentPressureTime: 1e-4 },
      pressureRange: { nominalPressure: 3e8, lowPressure: 2.8e8, highPressure: 3.3e8 },
      warnings: [],
      sampled: {
        status: 'sampled',
        samples: 500,
        seed: 1,
        failed: 0,
        budgetMs: 2500,
        pressure: { p05: 2.9e8, p50: 3e8, p95: 3.2e8 },
        velocity: { p05: 830, p50: 840, p95: 850 },
      },
    } as unknown as InteriorResponse,
    load: {
      charge: 2e-3,
      chamber: { volume: 3.4e-6 },
      propellant: { density: 1600 },
    } as Ok['load'],
    bulkDensity: undefined,
    powderChosen: true,
    volumeMeasured: false,
    cartridgeDesign: 'Wildcat',
    powderDesign: 'My powder',
    design: 'My bullet',
    ...extra,
  }) as Ok

const warnings = [
  { text: 'Simulation: peak above the limit.', name: 'above CIP Pmax' },
  { text: 'Simulation: a warning without a short name.' },
]

describe('resultNotes', () => {
  it('reaches every source once, warnings first, then messages, then notes', () => {
    const notes = resultNotes(ok(), warnings, units, english.t)
    expect(notes).toEqual([
      { kind: 'warning', line: 'above CIP Pmax', text: 'Simulation: peak above the limit.' },
      { kind: 'warning', line: 'Simulation: a warning without a short name.', text: undefined },
      {
        kind: 'message',
        line: 'Chamber volume not measured',
        text: expect.stringMatching(/^The volume comes from a record/),
      },
      {
        kind: 'message',
        line: 'Case fill: needs bulk density',
        text: 'The powder record gives no bulk density. Choose a powder record that gives one.',
      },
      {
        kind: 'note',
        line: 'Case values from the user design Wildcat, not a catalogue record.',
      },
      {
        kind: 'note',
        line: 'Powder values from the user design My powder, not a catalogue record.',
      },
      {
        kind: 'note',
        line: 'Computed with the bullet mass of the user design My bullet, not a catalogue record.',
      },
      {
        kind: 'note',
        line: 'Velocity 830 to 850 m/s. 5th to 95th percentile, input tolerances only.',
      },
    ])
    expect(new Set(notes.map((n) => n.line)).size).toBe(notes.length)
  })

  it('names what clears a missing case fill', () => {
    const fill = (o: Ok) =>
      resultNotes(o, [], units, english.t).find((n) => n.line.startsWith('Case fill'))
    expect(fill(ok({ powderChosen: false }))?.text).toBe(
      'Choose a powder record in the Powder card.',
    )
    expect(
      fill(ok({ bulkDensity: 900, load: { ...ok().load, chamber: { volume: 0 } } as Ok['load'] })),
    ).toMatchObject({ line: 'Case fill: needs a chamber volume' })
  })

  it('is empty for a measured run without designs, warnings or band', () => {
    const plain = ok({
      volumeMeasured: true,
      bulkDensity: 900,
      cartridgeDesign: undefined,
      powderDesign: undefined,
      design: undefined,
    })
    const { sampled: _, ...body } = plain.body
    expect(resultNotes({ ...plain, body }, [], units, english.t)).toEqual([])
  })

  it('warns when the powder record lists other cartridges only', () => {
    const plain = { volumeMeasured: true, bulkDensity: 900, cartridgeDesign: undefined }
    const listed = (o: Ok) =>
      resultNotes(o, [], units, english.t).filter((n) => n.line.includes('the manufacturer lists'))
    expect(listed(ok({ ...plain, unlisted: '308 Win.' }))).toEqual([
      {
        kind: 'warning',
        line: '308 Win. is not among the cartridges the manufacturer lists this powder for.',
      },
    ])
    expect(listed(ok(plain))).toEqual([])
  })

  it('warns of possible gas leakage when a plain-base cast bullet is harder than the peak upsets', () => {
    const plain = { volumeMeasured: true, bulkDensity: 900, cartridgeDesign: undefined }
    const at = (peak: number, castHardness: number | undefined) =>
      ok({
        ...plain,
        castHardness,
        body: { ...ok().body, result: { ...ok().body.result, peakBreechPressure: peak } },
      })
    const leak = (o: Ok) =>
      derived(o, english.t).own.filter((w) => w.name === 'possible gas leakage')
    // Brinell 18 is about 176 MPa
    expect(leak(at(1.5e8, 18))).toHaveLength(1)
    expect(leak(at(2.32e8, 18))).toEqual([])
    expect(leak(at(1.5e8, undefined))).toEqual([])
    expect(warningsText(at(1.5e8, 18), english.t)).toContain('gas may leak past its base')
  })

  it('marks a run on the default temperature coefficient, and gives the cold side as an interval', () => {
    const plain = { volumeMeasured: true, bulkDensity: 900, cartridgeDesign: undefined }
    const lines = (o: Ok) => resultNotes(o, [], units, english.t).map((n) => n.line)
    expect(
      lines(ok({ ...plain, sensitivityDefault: { form: 'ball', coldInterval: [0, 0.003] } })),
    ).toContain('Default temperature coefficient of ball powder: the powder record gives none.')
    const cold = lines(
      ok({
        ...plain,
        sensitivityDefault: {
          form: 'extruded',
          coldInterval: [0, 0.003],
          coldPeak: [3.1e8, 3.4e8],
        },
      }),
    )
    expect(
      cold.some((l) =>
        /^Cold side: peak pressure .+ to .+ with the default coefficient\.$/.test(l),
      ),
    ).toBe(true)
    expect(lines(ok(plain)).some((l) => l.startsWith('Default temperature'))).toBe(false)
  })

  it('notes a round count of the firearm: the velocity may be lower than simulated', () => {
    const plain = { volumeMeasured: true, bulkDensity: 900, cartridgeDesign: undefined }
    const worn = (o: Ok) =>
      resultNotes(o, [], units, english.t).filter((n) => n.line.startsWith('The barrel has fired'))
    expect(worn(ok({ ...plain, roundCount: 4000 }))).toEqual([
      expect.objectContaining({
        kind: 'note',
        line: 'The barrel has fired 4000 rounds: the velocity may be lower than simulated.',
        text: expect.stringContaining('0.29 % of its velocity per 1000 rounds'),
      }),
    ])
    expect(worn(ok(plain))).toEqual([])
    expect(worn(ok({ ...plain, roundCount: 0 }))).toEqual([])
    // a typed throat wear already carries the wear: no note
    const typed = ok({ ...plain, roundCount: 4000 })
    const load = { ...typed.load, chamber: { ...typed.load.chamber, throatWear: 1e-3 } }
    expect(worn({ ...typed, load })).toEqual([])
  })

  it('counts the unlisted cartridge as a warning, so a result with only that one is announced', () => {
    const plain = { volumeMeasured: true, bulkDensity: 900, cartridgeDesign: undefined }
    expect(warningsText(ok(plain), english.t)).toBe('')
    expect(warningsText(ok({ ...plain, unlisted: '308 Win.' }), english.t)).toBe('308 Win.')
  })

  it('names the cartridge only when the list leaves it out', () => {
    const cartridge = { id: '308-win', name: '308 Win.' }
    expect(unlistedCartridge({ listedCartridges: ['6-5-creedmoor'] }, cartridge)).toBe('308 Win.')
    expect(unlistedCartridge({ listedCartridges: ['308-win'] }, cartridge)).toBeUndefined()
    expect(unlistedCartridge({}, cartridge)).toBeUndefined()
    expect(unlistedCartridge({ listedCartridges: ['308-win'] }, undefined)).toBeUndefined()
  })
})

describe('temperature of a powder without a temperature coefficient', () => {
  /** The shown step at 273.15 K for a powder whose record was fitted at 294.15 K, the run's own message among the notes. */
  const note = (extra: Partial<Ok>) =>
    resultNotes(ok(extra), [], units, english.t).filter(
      (n) => n.line === 'No temperature coefficient',
    )

  it('says that the run ignores a powder temperature other than the fit temperature', () => {
    const load = { ...ok().load, propellantTemperature: 273.15 }
    expect(note({ load, noCoefficient: { reference: 294.15 } })).toEqual([
      {
        kind: 'message',
        line: 'No temperature coefficient',
        text: expect.stringMatching(/^The run ignores the powder temperature .*its fit\.$/),
      },
    ])
  })

  it('says nothing at the fit temperature, nor for a powder with a coefficient', () => {
    const [at, other] = [294.15, 273.15]
    const load = (T: number) => ({ ...ok().load, propellantTemperature: T })
    expect(note({ load: load(at), noCoefficient: { reference: 294.15 } })).toEqual([])
    expect(note({ load: load(other) })).toEqual([])
  })
})
