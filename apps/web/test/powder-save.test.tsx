import { MantineProvider } from '@mantine/core'
import {
  type ChronographString,
  type InteriorLoad,
  interior,
  powderModelValues,
} from '@open-reloading/core'
import { fromSi, type Powder, userRecord } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TuneNotes } from '../src/components/powder-tune.tsx'
import { english } from '../src/i18n/translate.ts'
import { dayText, localDay } from '../src/lib/dates.ts'
import { nth } from '../src/lib/nth.ts'
import { fileData, fromFile, powderDesigns } from '../src/lib/powder-designer.ts'
import type { PowderFitReply } from '../src/lib/powder-fit.ts'
import { answerPowderFit } from '../src/lib/powder-fit-answer.ts'
import { fitMark, loadFitMark } from '../src/lib/powder-record.ts'
import { fittedPowder } from '../src/lib/powder-save.ts'
import type { TuneString } from '../src/lib/powder-tune.ts'
import { presetUnits } from '../src/lib/units.ts'

/** Synthetic rifle load of the core fit tests: truth vivacity 0.45 1/s. */
const load = (vivacity = 0.45): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 6.9e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'vivacity',
      vivacity,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'twoStage', a: 0.8, m: 0.5, q: 0.5, z1: 0.8 },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 30e6,
})

const strings: TuneString[] = [2.6e-3, 2.65e-3, 2.7e-3, 2.8e-3, 2.9e-3].map((charge, i) => {
  const r = interior({ ...load(), charge })
  if (!r.valid) throw new Error(r.reason)
  const v = r.muzzleVelocity + nth([1.5, -2, 0.5, 1, -1], i)
  return { charge, shots: [v - 3, v, v + 3].map((value) => ({ velocity: { value } })) }
})
const chrono: ChronographString[] = strings.map((s) => ({
  charge: s.charge,
  velocities: s.shots.map((x) => x.velocity.value),
}))

const replies: PowderFitReply[] = []
answerPowderFit({ id: 1, load: load(0.38), strings: chrono }, (r) => replies.push(r))
const [fitted, ranged] = replies
if (fitted?.kind !== 'fit' || ranged?.kind !== 'range') throw new Error('no fit')

const date = new Date('2026-10-28T10:00:00Z')
const id = '0b9f6c1e-6a7d-4e0f-9b1a-2c3d4e5f6a7b'
const session = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
const save = (base?: Powder) =>
  fittedPowder({
    fit: fitted.fit,
    confidence: ranged.confidence,
    strings,
    base,
    sessions: [session, 's1'],
    id,
    name: 'My fitted powder',
    date,
  })

describe('saving a fit as a user powder', () => {
  const record = save()
  if (!record) throw new Error('no record')

  it('writes a valid powder record whose fit input is the strings of the fit', () => {
    expect(userRecord.parse(record)).toEqual(record)
    const fit = record.data.fit
    expect(record.data.provenanceKind).toBe('fitted')
    expect(fit?.input.map((p) => p.charge.value)).toEqual(
      strings.map((s) => fromSi('mass', s.charge)),
    )
    expect(fit?.input.map((p) => p.shots)).toEqual([3, 3, 3, 3, 3])
    expect(fit?.input.map((p) => p.muzzleVelocity.value)).toEqual(
      chrono.map((s) => s.velocities.reduce((a, x) => a + x, 0) / s.velocities.length),
    )
    expect(fit?.parameters).toEqual(['burnRate'])
    expect(fit?.date).toBe(date.toISOString())
    expect(fit?.confidence).toBe(ranged.confidence.label)
    expect(fit?.sessions).toEqual([`user:${session}`])
  })

  it('stores the fitted values, which the workbench lists as a user powder', () => {
    const [design] = powderDesigns([record])
    const vivacity = nth(fitted.fit.parameters, 0)
    expect(design?.powder.interior?.vivacity).toEqual({
      value: vivacity.value,
      standardUncertainty: vivacity.standardUncertainty,
    })
    expect(design?.powder.interior?.fitted).toEqual(['vivacity'])
    expect(design?.fit).toEqual(record.data.fit)
  })

  it("keeps the base powder's other fields and bore-resistance law, not its identity", () => {
    const resistance = { stress: { value: 10 }, oversize: 0.1, engraving: 0.2 }
    const base = {
      ...nth(powderDesigns([record]), 0).powder,
      id: 'base',
      name: 'Base',
      bulkDensity: { value: 0.95 },
    }
    const withBase = save({
      ...base,
      interior: base.interior && { ...base.interior, resistance, trainingRows: 40 },
    })
    expect(withBase?.data.draft?.bulkDensity).toEqual({ value: 0.95 })
    expect(withBase?.data.draft?.interior?.resistance).toEqual(resistance)
    expect(withBase?.data.draft?.interior?.trainingRows).toBeUndefined()
    expect(withBase?.data.draft).not.toHaveProperty('name')
    expect(userRecord.safeParse(withBase).success).toBe(true)
  })

  it('keeps the fit through a designer save until a fitted value is edited', () => {
    const system = presetUnits('metric-grains')
    const opened = fromFile(record.data, record.name, system)
    expect(fileData(opened).fit).toEqual(record.data.fit)
    const key = 'interior.vivacity.value'
    const edited = {
      ...opened,
      fields: { ...opened.fields, [key]: { text: '0.5', si: 0.5 } },
    }
    expect(fileData(edited).fit).toBeUndefined()
  })
})

describe('the fit mark', () => {
  it('names the strings and the day of the fit, or hand-tuned', () => {
    expect(fitMark(5, date.toISOString(), false, (d) => d, english)).toBe(
      `simulation parameters fitted to 5 strings, ${localDay(date)}`,
    )
    expect(fitMark(5, date.toISOString(), true, (d) => d, english)).toBe(
      'simulation parameters, hand-tuned',
    )
  })

  it('reads hand-tuned on the workbench once a typed value moves a fitted parameter', () => {
    const record = save()
    const design = record && nth(powderDesigns([record]), 0)
    const origin = design && powderModelValues(design.powder)
    if (!design || !origin) throw new Error('no design')
    const system = presetUnits('metric-grains')
    const mark = (values: Record<string, number>) =>
      loadFitMark(design, origin, values, system, (d) => d, english)
    expect(mark(origin)).toBe(`simulation parameters fitted to 5 strings, ${localDay(date)}`)
    // a value typed as the field shows it is no move
    const typed = Number(origin.vivacity?.toPrecision(3))
    expect(mark({ ...origin, vivacity: typed })).toContain('fitted to 5 strings')
    expect(mark({ ...origin, vivacity: (origin.vivacity ?? 0) * 1.05 })).toBe(
      'simulation parameters, hand-tuned',
    )
    // an input of the fit is no fitted parameter
    expect(mark({ ...origin, gamma: 1.3 })).toContain('fitted to 5 strings')
    expect(loadFitMark({ powder: design.powder }, origin, origin, system, dayText, english)).toBe(
      undefined,
    )
  })
})

describe('the save on the tuning screen', () => {
  const disabledSave = /disabled=""><span[^>]*><span[^>]*>Save as a powder/
  const html = renderToStaticMarkup(
    <MantineProvider>
      <TuneNotes
        loaded={undefined}
        interior={load(0.38)}
        fit={{ fit: fitted, range: ranged, running: false }}
        strings={strings}
        save={{ sessions: ['s1'] }}
      />
    </MantineProvider>,
  )

  it('offers the save with the fitted mark and no control for the burn form', () => {
    expect(html).toContain('Save as a powder')
    expect(html).not.toMatch(disabledSave)
    expect(html).toContain(
      `simulation parameters fitted to 5 strings, ${dayText(localDay(new Date()))}`,
    )
    expect(html.match(/role="slider"/g)).toHaveLength(1)
    expect(html).not.toMatch(/form\.a|Burn form|Initial slope/)
  })

  it('offers no save before the pressure range has arrived', () => {
    const waiting = renderToStaticMarkup(
      <MantineProvider>
        <TuneNotes
          loaded={undefined}
          interior={load(0.38)}
          fit={{ fit: fitted, running: true }}
          strings={strings}
          save={{ sessions: [] }}
        />
      </MantineProvider>,
    )
    expect(waiting).toMatch(disabledSave)
  })
})
