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

  it('says a value out of range in plain words with its limit, at its field', () => {
    const built = checkDesign(typed(draft(), 'interior.gamma', '0.9'), id)
    if (!('problems' in built)) throw new Error('built a powder')
    const at = built.problems.filter((p) => p.key === 'interior.gamma')
    expect(at).toEqual([{ key: 'interior.gamma', message: 'Gamma must be above 1.' }])
  })

  it('says an ingredient percentage above 100 in plain words', () => {
    const start = draft()
    const row = defined(start.rows[0]).id
    const built = checkDesign(typed(start, `comp.${row}.max`, '120'), id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(built.problems).toContainEqual({
      key: `comp.${row}.max`,
      message: 'Ingredient 1 max percent must be at most 100.',
    })
    expect(built.problems.every((p) => !/expected|Too big/.test(p.message))).toBe(true)
  })

  it('refuses a vivacity that is not above 0', () => {
    const built = checkDesign(typed(draft(), 'interior.vivacity.value', '-3'), id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(built.problems).toContainEqual({
      key: 'interior.vivacity.value',
      message: 'Vivacity must be greater than 0.',
    })
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
    const required = built.problems
      .filter((p) => p.message.startsWith('Enter a number for '))
      .map((p) => p.key)
    expect(required).toContain('interior.vivacity.value')
    expect(required).toContain('interior.burnForm.a.value')
    expect(required).not.toContain('interior.gamma')
  })

  it('needs the kind fitted for a burn law, and a fitted parameter', () => {
    const measured = checkDesign(draft({ ...sample, provenanceKind: 'measured' }), id)
    if (!('problems' in measured)) throw new Error('built a powder')
    expect(measured.problems).toContainEqual({
      key: 'provenanceKind',
      message: 'Set Values came about by to Fitted to data.',
    })
    const none = draft()
    none.fitted = []
    const built = checkDesign(none, id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(built.problems).toContainEqual({
      key: 'fitted',
      message: 'Tick at least one fitted parameter.',
    })
  })

  it('lists everything a hand-entered burn law lacks at once', () => {
    const d = draft({
      origin: 'user',
      provenanceKind: 'published',
      draft: {
        thermochemistry: defined(sample.draft?.thermochemistry),
        interior: { ...defined(sample.draft?.interior), fitted: [] as never },
      },
    })
    d.fitted = []
    const built = checkDesign(d, id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(built.problems).toEqual([
      { key: 'fitted', message: 'Tick at least one fitted parameter.' },
      { key: 'provenanceKind', message: 'Set Values came about by to Fitted to data.' },
      { message: 'Add at least one ingredient.' },
    ])
  })

  it('asks for the value alone of a missing thermochemistry range, not its Min and Max', () => {
    const d = draft({
      ...sample,
      draft: {
        ...sample.draft,
        thermochemistry: { loadingDensity: { value: 0.2 }, gamma: { value: 1.22 } as never },
      },
    })
    const built = checkDesign(d, id)
    if (!('problems' in built)) throw new Error('built a powder')
    const keys = built.problems.map((p) => p.key)
    expect(keys).toContain('thermochemistry.impetus.value')
    expect(keys.some((k) => /\.(min|max)$/.test(k ?? ''))).toBe(false)
  })

  it('numbers the ingredients as the form does and lists every problem of a row', () => {
    const start = draft({
      ...sample,
      draft: { ...sample.draft, composition: [{ name: 'Nitrocellulose', min: 90, max: 100 }] },
    })
    const blank = { id: 'blank-row', name: '', cas: '' }
    const third = { id: 'third-row', name: '', cas: '' }
    const rows = { ...start, rows: [...start.rows, blank, third] }
    const d = typed(typed(rows, 'comp.third-row.min', 'x'), 'comp.third-row.max', '5')
    const built = checkDesign(d, id)
    if (!('problems' in built)) throw new Error('built a powder')
    const messages = built.problems.map((p) => p.message)
    expect(messages).toContain('Enter a number for Ingredient 3 min percent.')
    expect(messages).toContain('Enter Ingredient 3 name.')
  })

  it('builds an empty Min or Max of a thermochemistry range as its value', () => {
    const d = draft({
      ...sample,
      draft: {
        ...sample.draft,
        thermochemistry: {
          ...defined(sample.draft?.thermochemistry),
          gamma: { value: 1.22 } as never,
          impetus: { value: 1.05e6, min: 1.0e6 } as never,
        },
      },
    })
    const built = checkDesign(d, id)
    if (!('powder' in built)) throw new Error(JSON.stringify(built.problems))
    expect(built.powder.thermochemistry?.gamma).toEqual({ value: 1.22, min: 1.22, max: 1.22 })
    expect(built.powder.thermochemistry?.impetus).toEqual({
      value: 1.05e6,
      min: 1.0e6,
      max: 1.05e6,
    })
    // the draft keeps what was entered
    expect(fileData(d).draft?.thermochemistry?.gamma).toEqual({ value: 1.22 })
  })

  it('needs a composition for the thermochemistry and ranges that admit 100 %', () => {
    const noComposition = draft({ ...sample, draft: { ...sample.draft, composition: [] } })
    const built = checkDesign(noComposition, id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(built.problems.map((p) => p.message)).toContain('Add at least one ingredient.')
    const low = draft({
      ...sample,
      draft: { ...sample.draft, composition: [{ name: 'Only', min: 10, max: 20 }] },
    })
    const sum = checkDesign(low, id)
    if (!('problems' in sum)) throw new Error('built a powder')
    expect(sum.problems.map((p) => p.message)).toContain(
      'Composition: the Min percentages must add up to 100 or less, and the Max percentages to 100 or more.',
    )
  })

  it('shows a range of an ingredient that needs min <= max at its row', () => {
    const start = draft()
    const d = typed(start, `comp.${defined(start.rows[0]).id}.min`, '70')
    const built = checkDesign(d, id)
    if (!('problems' in built)) throw new Error('built a powder')
    expect(built.problems).toContainEqual({
      key: `comp.${defined(start.rows[0]).id}.min`,
      message: 'Ingredient 1: Min must not be above Max.',
    })
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

  it('stores a half-typed number that the finished record would refuse', () => {
    const d = typed(typed(newDesign(), 'interior.gamma', '1'), 'interior.burnForm.z1', '0')
    const data = fileData(d)
    expect(data.draft?.interior?.gamma).toBe(1)
    expect(parseUserDataFile(userDataText([record(d)])).ok).toBe(true)
  })

  it('keeps the burn-law values of an opened record that it has no input for', () => {
    const resistance = { stress: { value: 2e6 }, oversize: 0.1, engraving: 0.2 }
    const opened: UserPowder = {
      ...sample,
      draft: {
        ...sample.draft,
        interior: { ...sample.draft?.interior, resistance, trainingRows: 40 },
      },
    }
    const back = fileData(fromFile(opened, 'Opened', metric))
    expect(back.draft?.interior?.resistance).toEqual(resistance)
    expect(back.draft?.interior?.trainingRows).toBe(40)
  })

  it('is not done while a field holds text that reads as no number', () => {
    const d = typed(fromFile(sample, 'Sample powder', metric), 'bulkDensity.value', '1,4x')
    const checked = checkDesign(d, id)
    expect('problems' in checked && checked.problems.map((p) => p.key)).toContain(
      'bulkDensity.value',
    )
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
      {
        kind: 'powder',
        id: '8b3e0d21-6c4f-4a79-8e52-1d9f3c7b2a68',
        name: 'Negative vivacity',
        saved: '2026-10-26T10:00:00.000Z',
        data: {
          ...sample,
          draft: {
            ...sample.draft,
            interior: { ...defined(sample.draft?.interior), vivacity: { value: -3 } },
          },
        },
      },
    ]
    expect(powderDesigns(records).map((d) => [d.id, d.name])).toEqual([[id, 'Good']])
  })
})
