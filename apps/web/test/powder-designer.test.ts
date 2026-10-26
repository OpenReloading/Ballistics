import { powder as powderSchema, type UserPowder, type UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { fieldValueFromText } from '../src/lib/field-spec.ts'
import { historyOf } from '../src/lib/history.ts'
import {
  checkDesign,
  type Design,
  fileData,
  fromFile,
  newDesign,
  powderDesignNote,
  powderDesigns,
  powderOf,
  reduce,
  specOf,
} from '../src/lib/powder-designer.ts'
import { presetUnits } from '../src/lib/units.ts'
import { parseUserDataFile, userDataText } from '../src/lib/user-data.ts'
import { defined, missing } from './defined.ts'

const metric = presetUnits('metric-grams')
const us = presetUnits('us')
const id = '5d4c3b2a-1f0e-4d9c-8b7a-6a5f4e3d2c1b'

/** A complete design in stored units: every field the designer offers. */
const sample: UserPowder = {
  origin: 'user',
  provenanceKind: 'fitted',
  draft: {
    aliases: ['Sample S-2'],
    grainForm: 'extruded',
    propellantBase: 'double',
    note: 'Entered by hand.',
    bulkDensity: { value: 0.9 },
    composition: [
      { name: 'Nitrocellulose', cas: '9004-70-0', min: 55, max: 65 },
      { name: 'Nitroglycerin', min: 25, max: 35 },
      { name: 'Additives', min: 5, max: 15 },
    ],
    thermochemistry: {
      loadingDensity: { value: 0.2 },
      flameTemperature: { value: 2900, min: 2850, max: 2950 },
      impetus: { value: 1.05e6, min: 1.0e6, max: 1.1e6 },
      gamma: { value: 1.22, min: 1.2, max: 1.24 },
      molarMass: { value: 25, min: 24, max: 26 },
      covolume: { value: 0.001, min: 0.00095, max: 0.00105 },
    },
    interior: {
      model: 'm3',
      fitted: ['vivacity', 'energy'],
      vivacity: { value: 0.6 },
      energy: { value: 3.8e6 },
      gamma: 1.24,
      covolume: { value: 0.001 },
      density: { value: 1.6 },
      pressureExponent: 0.85,
      referencePressure: { value: 1000 },
      ignitionPressure: { value: 150 },
      startPressure: { value: 300 },
      propellantTemperature: { value: 21 },
      burnForm: { kind: 'twoStage', a: { value: 0.4 }, m: 0.5, q: 0.1, z1: 0.8 },
    },
  },
}

const draft = (data = sample, system = metric) => fromFile(data, 'Sample powder', system)

/** `d` with the field `key` set to the text `text`, as typing it in the form does. */
const typed = (d: Design, key: string, text: string, system = metric) =>
  reduce(historyOf(d), {
    type: 'field',
    key,
    value: fieldValueFromText(specOf(key).quantity, system, text),
  }).present

describe('checkDesign', () => {
  it('builds a powder that the powder schema accepts', () => {
    const built = checkDesign(draft(), id)
    if (!('powder' in built)) throw new Error(JSON.stringify(built.problems))
    expect(powderSchema.safeParse(built.powder).success).toBe(true)
    expect(built.powder).toMatchObject({
      id,
      name: 'Sample powder',
      grainForm: 'extruded',
      provenance: { kind: 'fitted' },
    })
    expect(built.powder.interior?.burnForm.z1).toBe(0.8)
    expect(built.powder.thermochemistry?.flameTemperature).toEqual({
      value: 2900,
      min: 2850,
      max: 2950,
    })
  })

  it('reports an empty draft at the provenance kind, and nothing else is needed', () => {
    const built = checkDesign(newDesign(), id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(built.problems).toEqual([expect.objectContaining({ key: 'provenanceKind' })])
  })

  it('takes a name alone with a provenance kind', () => {
    const d = fromFile({ origin: 'user', provenanceKind: 'measured' }, 'Plain', metric)
    expect('powder' in checkDesign(d, id)).toBe(true)
  })

  it('shows the zod message at the field of a value out of range', () => {
    const built = checkDesign(typed(draft(), 'interior.gamma', '0.9'), id)
    if (!('problems' in built)) throw new Error('built a powder')
    const at = built.problems.filter((p) => p.key === 'interior.gamma')
    expect(at).toHaveLength(1)
    expect(defined(at[0]).message).toMatch(/>\s*1/)
  })

  it('shows the zod message at the field of a burn form the schema refuses', () => {
    const built = checkDesign(typed(draft(), 'interior.burnForm.z1', '1.5'), id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(built.problems.some((p) => p.key === 'interior.burnForm.z1')).toBe(true)
  })

  it('reports each empty field of a started burn law as required', () => {
    const d = fromFile(
      {
        origin: 'user',
        provenanceKind: 'fitted',
        draft: { interior: { model: 'm3', fitted: ['vivacity'], gamma: 1.2 } },
      },
      'Started',
      metric,
    )
    const built = checkDesign(d, id)
    if (!('problems' in built)) throw new Error('built a powder')
    const required = built.problems.filter((p) => p.message === 'Required.').map((p) => p.key)
    expect(required).toContain('interior.vivacity.value')
    expect(required).toContain('interior.burnForm.a.value')
    expect(required).not.toContain('interior.gamma')
  })

  it('needs the kind fitted for a burn law, and a fitted parameter', () => {
    const measured = checkDesign(draft({ ...sample, provenanceKind: 'measured' }), id)
    if (!('problems' in measured)) throw new Error('built a powder')
    expect(measured.problems).toContainEqual({
      key: 'provenanceKind',
      message: 'The burn law needs the kind "Fitted to data".',
    })
    const none = draft()
    none.fitted = []
    const built = checkDesign(none, id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(built.problems.some((p) => p.key === 'fitted')).toBe(true)
  })

  it('needs a composition for the thermochemistry and ranges that admit 100 %', () => {
    const noComposition = draft({ ...sample, draft: { ...sample.draft, composition: [] } })
    const built = checkDesign(noComposition, id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(built.problems.map((p) => p.message)).toContain('Thermochemistry: needs a composition')
    const low = draft({
      ...sample,
      draft: { ...sample.draft, composition: [{ name: 'Only', min: 10, max: 20 }] },
    })
    const sum = checkDesign(low, id)
    if (!('problems' in sum)) throw new Error('built a powder')
    expect(sum.problems.some((p) => p.message.includes('summing to 100 %'))).toBe(true)
  })

  it('shows a range of an ingredient that needs min <= max at its row', () => {
    const start = draft()
    const d = typed(start, `comp.${defined(start.rows[0]).id}.min`, '70')
    const built = checkDesign(d, id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(
      built.problems.some((p) => p.key?.startsWith('comp.') && /min <= max/.test(p.message)),
    ).toBe(true)
  })
})

describe('the draft file', () => {
  const record = (d: Design): UserRecord => ({
    kind: 'powder',
    id,
    name: d.name || 'Draft',
    saved: '2026-10-26T10:00:00.000Z',
    data: fileData(d),
  })

  it('gives the same draft after export and import, in any unit system', () => {
    for (const system of [metric, us]) {
      const parsed = parseUserDataFile(userDataText([record(draft(sample, system))]))
      if (!parsed.ok) throw new Error(parsed.reason)
      const [back = missing()] = parsed.records
      if (back.kind !== 'powder') throw new Error(back.kind)
      expect(back.data).toEqual(sample)
      expect(back.name).toBe('Sample powder')
      expect(fileData(fromFile(back.data, back.name, system === us ? metric : us))).toEqual(sample)
    }
  })

  it('keeps an unfinished draft and leaves blank rows and fields out', () => {
    const d = typed(newDesign(), 'interior.gamma', '1.3')
    const data = fileData(d)
    expect(data).toEqual({ origin: 'user', draft: { interior: { model: 'm3', gamma: 1.3 } } })
    expect(parseUserDataFile(userDataText([record(d)])).ok).toBe(true)
  })

  it('builds the powder of a stored record', () => {
    const built = powderOf(sample, 'Stored', id)
    expect('powder' in built && built.powder.interior?.energy.value).toBe(3.8e6)
  })
})

describe('the user design mark', () => {
  it('names the design and says it is no catalogue record', () => {
    expect(powderDesignNote('Sample powder')).toBe(
      'Powder values from the user design Sample powder, not a catalogue record.',
    )
  })

  it('offers the valid designs of the records, in order', () => {
    const records: UserRecord[] = [
      { kind: 'powder', id, name: 'Good', saved: '2026-10-26T10:00:00.000Z', data: sample },
      {
        kind: 'powder',
        id: '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57',
        name: 'No kind yet',
        saved: '2026-10-26T10:00:00.000Z',
        data: { origin: 'user' },
      },
    ]
    expect(powderDesigns(records).map((d) => [d.id, d.name])).toEqual([[id, 'Good']])
  })
})
