import { MantineProvider } from '@mantine/core'
import { type InteriorLoad, interior } from '@open-reloading/core'
import { fromSi, type SessionRecord, userRecord } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { load as rifleLoad } from '../../../packages/core/test/powder-load.ts'
import { AddString, TuneNotes } from '../src/components/powder-tune.tsx'
import { nth } from '../src/lib/nth.ts'
import { fileData, fromFile, powderDesigns } from '../src/lib/powder-designer.ts'
import { type PowderFitReply, temperatureFit, withSensitivity } from '../src/lib/powder-fit.ts'
import { answerPowderFit } from '../src/lib/powder-fit-answer.ts'
import { fittedPowder } from '../src/lib/powder-save.ts'
import { fitStrings, sessionStrings, type TuneString } from '../src/lib/powder-tune.ts'
import { presetUnits } from '../src/lib/units.ts'

const sensitivity = { reference: 294.15, cold: 0.002, hot: 0.003 }

/** Synthetic rifle load of the core fit tests with a temperature sensitivity. */
const load = (vivacity = 0.45, factor = 1): InteriorLoad => {
  const l = rifleLoad(vivacity)
  return {
    ...l,
    propellant: {
      ...l.propellant,
      temperatureSensitivity: {
        ...sensitivity,
        cold: sensitivity.cold * factor,
        hot: sensitivity.hot * factor,
      },
    },
  }
}

/** Strings of the truth load (sensitivities scaled by 1.5) at 263.15 K and 313.15 K. */
const strings: TuneString[] = [263.15, 313.15].flatMap((temperature) =>
  [2.6e-3, 2.75e-3, 2.9e-3].map((charge, i) => {
    const r = interior({ ...load(0.45, 1.5), charge, propellantTemperature: temperature })
    if (!r.valid) throw new Error(r.reason)
    const v = r.muzzleVelocity + nth([1, -1, 0.5], i)
    return {
      charge,
      temperature,
      shots: [v - 2, v, v + 2].map((value) => ({ velocity: { value } })),
    }
  }),
)

function fitOf(start: InteriorLoad, s: readonly TuneString[]) {
  const replies: PowderFitReply[] = []
  const ladder = fitStrings(s)
  const options =
    temperatureFit(start, ladder) === 'fit'
      ? { parameters: ['burnRate' as const, 'temperatureFactor' as const] }
      : undefined
  answerPowderFit({ id: 1, load: start, strings: ladder, options }, (r) => replies.push(r))
  const [fitted, ranged] = replies
  if (fitted?.kind !== 'fit' || ranged?.kind !== 'range') throw new Error('no fit')
  return { fitted, ranged }
}

const save = (f: ReturnType<typeof fitOf>) =>
  fittedPowder({
    fit: f.fitted.fit,
    confidence: f.ranged.confidence,
    strings,
    sessions: [],
    id: '0b9f6c1e-6a7d-4e0f-9b1a-2c3d4e5f6a7b',
    name: 'Fitted',
    date: new Date('2026-10-28T10:00:00Z'),
  })

const notes = (interiorLoad: InteriorLoad, s: readonly TuneString[]) =>
  renderToStaticMarkup(
    <MantineProvider>
      <TuneNotes loaded={undefined} interior={interiorLoad} fit={{ running: true }} strings={s} />
    </MantineProvider>,
  )

const addForm = (oneTemperature: boolean) =>
  renderToStaticMarkup(
    <MantineProvider>
      <AddString onAdd={() => {}} oneTemperature={oneTemperature} />
    </MantineProvider>,
  )

const oneTemperature = 'needs strings at two or more powder temperatures'
const askSensitivity = 'the powder has no temperature sensitivity'

describe('the temperature factor from strings at several temperatures', () => {
  it('reads the powder temperature of a session string, in K', () => {
    const session = {
      kind: 'session',
      data: {
        strings: [
          {
            variation: { kind: 'charge', value: { value: 2.6 } },
            propellantTemperature: { value: -10 },
            shots: [{ velocity: { value: 800 } }],
          },
        ],
      },
    } as unknown as SessionRecord
    const [s] = sessionStrings([session])
    expect(s?.temperature).toBeCloseTo(263.15, 9)
    expect(fitStrings(sessionStrings([session]))[0]?.propellantTemperature).toBeCloseTo(263.15, 9)
  })

  const twoTemperatures = fitOf(load(0.38), strings)
  const factor = twoTemperatures.fitted.fit.parameters.find((p) => p.name === 'temperatureFactor')

  it('fits the factor at two temperatures and saves each temperature in the fit points', () => {
    expect(factor?.value).toBeCloseTo(1.5, 1)
    expect(twoTemperatures.fitted.rule).toBeUndefined()
    const record = save(twoTemperatures)
    expect(userRecord.safeParse(record).success).toBe(true)
    expect(record?.data.fit?.parameters).toEqual(['burnRate', 'temperatureFactor'])
    expect(record?.data.fit?.input.map((p) => p.temperature.value)).toEqual(
      strings.map((s) => fromSi('temperature', s.temperature ?? 0)),
    )
    expect(notes(load(0.38), strings)).not.toContain(oneTemperature)
    expect(addForm(false)).not.toContain(oneTemperature)
  })

  it('keeps the scaled sensitivities in the saved draft through a parse', () => {
    const parsed = userRecord.parse(save(twoTemperatures))
    const saved = powderDesigns([parsed])[0]?.powder.temperatureSensitivity
    expect(saved?.reference.value).toBe(sensitivity.reference)
    expect(saved?.cold.value).toBeCloseTo(sensitivity.cold * (factor?.value ?? 0), 12)
    expect(saved?.hot.value).toBeCloseTo(sensitivity.hot * (factor?.value ?? 0), 12)
    if (parsed.kind !== 'powder') throw new Error('not a powder')
    const resaved = fileData(fromFile(parsed.data, parsed.name, presetUnits('metric-grams')))
    expect(resaved.draft?.temperatureSensitivity).toEqual(parsed.data.draft?.temperatureSensitivity)
  })

  it('fits without the factor at one temperature and says two are needed', () => {
    const one = strings.slice(0, 3)
    expect(temperatureFit(load(), fitStrings(one))).toBe('one')
    const { fitted } = fitOf(load(0.38), one)
    expect(fitted.fit.parameters.map((p) => p.name)).toEqual(['burnRate'])
    // the note sits beside the temperature field of the add form, not among the notes
    expect(notes(load(0.38), one)).not.toContain(oneTemperature)
    expect(addForm(true)).toContain(oneTemperature)
  })

  it('asks for a sensitivity and fits no factor when the draft has none', () => {
    const flat = load(0.38, 0)
    expect(temperatureFit(flat, fitStrings(strings))).toBe('sensitivity')
    const { propellant } = load(0.38)
    const { temperatureSensitivity: _, ...without } = propellant
    expect(temperatureFit({ ...flat, propellant: without }, fitStrings(strings))).toBe(
      'sensitivity',
    )
    const { fitted } = fitOf(flat, strings)
    expect(fitted.fit.parameters.map((p) => p.name)).toEqual(['burnRate'])
    const html = notes(flat, strings)
    expect(html).toContain(askSensitivity)
    expect(html).toContain('Temperature sensitivity (1/K)')
  })

  it('fits the factor from a sensitivity typed for a load without one', () => {
    const typed = withSensitivity(load(0.38, 0), 0.0025)
    expect(typed.propellant.temperatureSensitivity).toEqual({
      reference: 294.15,
      cold: 0.0025,
      hot: 0.0025,
    })
    expect(withSensitivity(load(0.38, 0), 0)).toEqual(load(0.38, 0))
    const { fitted } = fitOf(typed, strings)
    expect(fitted.fit.parameters.map((p) => p.name)).toEqual(['burnRate', 'temperatureFactor'])
  })

  it('holds the factor at 1 with a warning when the strings do not resolve it', () => {
    const { fitted } = fitOf(withSensitivity(load(0.38, 0), 1e-12), strings)
    expect(fitted.rule).toBe('temperature')
    expect(fitted.fit.parameters.map((p) => p.name)).toEqual(['burnRate'])
  })
})
