import { face } from '@open-reloading/drawing'
import { bulletFigureModel, bulletOutline } from '@open-reloading/drawing/bullet'
import { applyOverrides, type Bullet, bullet, type UserBullet } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { computedBulletRows } from '../src/lib/bullet.ts'
import {
  type Action,
  choiceOptions,
  type Design,
  designerSpecs,
  designShape,
  evaluate,
  fieldInUse,
  fileData,
  fromRecord,
  fromUser,
  type History,
  historyOf,
  newDesign,
  reduce,
  sliderMax,
} from '../src/lib/bullet-designer.ts'
import { seededRandom } from '../src/lib/ellipse.ts'
import { fieldValueFromText } from '../src/lib/field-spec.ts'
import { presetUnits } from '../src/lib/units.ts'
import type { ResolvedBullet } from '../src/lib/variants.ts'
import { matchBullet, targetBullet } from './fixtures/bullets.ts'

describe('choice lists', () => {
  it('are subsets of the record schema enums', () => {
    const schema = {
      'base.type': bullet.shape.base.unwrap().shape.type.unwrap().options,
      'ogive.form': bullet.shape.ogive.unwrap().shape.form.unwrap().options,
      'tip.type': bullet.shape.tip.unwrap().shape.type.options,
    }
    for (const [key, options] of Object.entries(choiceOptions)) {
      expect(options.length).toBeGreaterThan(0)
      for (const o of options) expect(schema[key as keyof typeof schema]).toContain(o)
    }
    expect(Object.keys(choiceOptions)).toEqual(Object.keys(schema))
  })
})

/** What `resolveBullet` gives for a base found (`base`) or none. */
const resolvedOf = (data: UserBullet, base?: Bullet): ResolvedBullet => ({
  base: base ? { status: 'found', record: base } : { status: 'none' },
  record: applyOverrides<Partial<Bullet>>(base ?? {}, data.overrides),
})

const metric = presetUnits('metric-grams')
const us = presetUnits('us')

/** Types `text` in the field `key` in metric units (mm, g). */
const type = (key: string, text: string): Action => {
  const q = designerSpecs.find((s) => s.key === key)?.quantity ?? 'length'
  return { type: 'field', key, value: fieldValueFromText(q, metric, text) }
}
const run = (start: Design, ...actions: Action[]) =>
  actions.reduce<History>(reduce, historyOf(start))

describe('start', () => {
  it('a new bullet starts at .308 in exactly', () => {
    expect(newDesign(us).fields.diameter.text).toBe('0.308')
    // shown rounded to the unit's decimals, held exactly
    expect(newDesign(metric).fields.diameter.text).toBe('7.82')
    expect(newDesign(metric).fields.diameter.si).toBeCloseTo(0.308 * 25.4e-3, 12)
  })

  it('a new bullet keeps only the calibre and mass, and draws with an assumed length of 4 d', () => {
    const from = fromRecord(targetBullet, metric)
    const d = newDesign(metric, from)
    expect(d.fields.diameter).toEqual(from.fields.diameter)
    expect(d.fields.mass).toEqual(from.fields.mass)
    expect(d.fields.length.text).toBe('')
    expect(d.origin).toBeUndefined()
    const e = evaluate(d, metric)
    expect(e.drawing).toBeDefined()
    expect(e.states.length).toEqual({ kind: 'assumed', si: 4 * 7.823e-3, basis: '4 d' })
    expect(e.states.diameter).toEqual({ kind: 'entered', changed: false, record: undefined })
    // the assumed length is not dimensioned
    expect(e.drawing?.given).not.toContain('length')
  })

  it('a catalogue start fills the fields from the record, each from the catalogue', () => {
    const d = fromRecord(targetBullet, metric)
    expect(d.fields.length).toEqual({ text: '32', si: 32e-3 })
    // shown rounded, held as recorded
    expect(d.fields.noseLength.text).toBe('20')
    expect(d.fields.noseLength.si).toBeCloseTo(20e-3, 12)
    expect(
      fromRecord(targetBullet, metric, new Map([['example-a', 'Example A']])).manufacturerName,
    ).toBe('Example A')
    expect(d.manufacturerName).toBe('')
    const e = evaluate(d, metric)
    for (const k of ['diameter', 'mass', 'length', 'noseLength', 'bearingLength', 'baseToOgive'])
      expect(e.states[k]).toEqual({ kind: 'record' })
    // stored values come back as stored, not with the noise of the SI round trip
    expect(e.drawing?.screen.layers.bullet.labels.find((l) => l.owner === 'd')?.text).toBe(
      '∅d 7.823',
    )
    // the computed values of the bullet page
    const r = targetBullet
    expect(e.computed).toEqual(computedBulletRows(r))
  })

  it('shows a field that has a value whatever the choices, else only where it applies', () => {
    const d = fromRecord(targetBullet, metric)
    expect(fieldInUse('base.length', d)).toBe(true)
    expect(fieldInUse('base.angle', d)).toBe(false)
    expect(fieldInUse('tip.length', d)).toBe(false)
    // a catalogue value cleared keeps its field on screen
    const cleared = reduce(historyOf(d), type('base.length', '')).present
    expect(fieldInUse('base.length', cleared)).toBe(true)
    expect(
      fieldInUse('tip.length', { ...d, choices: { ...d.choices, 'tip.type': 'polymer-tip' } }),
    ).toBe(true)
  })
})

describe('field states', () => {
  it('marks a changed value with the catalogue value', () => {
    const h = run(fromRecord(targetBullet, metric), type('length', '33'))
    const e = evaluate(h.present, metric, 'length')
    expect(e.states.length).toEqual({ kind: 'entered', changed: true, record: 32e-3 })
  })

  it('gives derived and assumed values for empty fields', () => {
    const h = run(
      newDesign(metric),
      type('length', '31'),
      { type: 'choice', key: 'base.type', value: 'boat-tail' },
      type('base.length', '4'),
      type('base.angle', '8'),
      type('noseLength', '18'),
    )
    const e = evaluate(h.present, metric)
    expect(e.drawing).toBeDefined()
    // bearing = 31 - 4 - 18 mm
    expect(e.states.bearingLength).toMatchObject({ kind: 'derived' })
    expect((e.states.bearingLength as { si: number }).si).toBeCloseTo(9e-3, 9)
    // base diameter from length and angle
    const db = 0.308 * 25.4 - 2 * 4 * Math.tan((8 * Math.PI) / 180)
    expect(e.states['base.diameter']).toMatchObject({ kind: 'derived' })
    expect((e.states['base.diameter'] as { si: number }).si).toBeCloseTo(db * 1e-3, 9)
    // no form, radius or Rt/R: the nose is an assumed tangent ogive
    expect(e.states['ogive.radiusRatio']).toEqual({ kind: 'assumed', si: 1 })
    expect(e.states.meplatDiameter).toEqual({ kind: 'assumed', si: 0 })
  })

  it('derives the nose length from a tangent ogive radius, n = sqrt(2 R k - k^2)', () => {
    const h = run(
      newDesign(metric),
      type('length', '31'),
      { type: 'choice', key: 'ogive.form', value: 'tangent' },
      type('ogive.radius', '60'),
    )
    const e = evaluate(h.present, metric)
    const k = (0.308 * 25.4) / 2
    const n = Math.sqrt(2 * 60 * k - k ** 2)
    expect(e.states.noseLength).toMatchObject({ kind: 'derived' })
    expect((e.states.noseLength as { si: number }).si).toBeCloseTo(n * 1e-3, 9)
    // and the radius drawn is the one entered: Rt/R 1
    expect((e.states['ogive.radiusRatio'] as { si: number }).si).toBeCloseTo(1, 9)
    expect(e.drawing?.given).toContain('ogive.radius')
    expect(e.drawing?.given).not.toContain('noseLength')
  })

  it('derives the ogive radius from the nose length', () => {
    const h = run(newDesign(metric), type('length', '31'), type('noseLength', '18'))
    const e = evaluate(h.present, metric)
    const k = (0.308 * 25.4) / 2
    expect((e.states['ogive.radius'] as { si: number }).si).toBeCloseTo(
      ((18 ** 2 + k ** 2) / (2 * k)) * 1e-3,
      9,
    )
  })
})

describe('refusals', () => {
  it('shows an outline refusal at the field edited last when the refusal names it', () => {
    const h = run(newDesign(metric), type('length', '30'), type('noseLength', '35'))
    const e = evaluate(h.present, metric, 'noseLength')
    expect(e.drawing).toBeUndefined()
    expect(e.refusal).toEqual({
      reason: expect.stringContaining('nose length 35 mm is above the length'),
      field: 'noseLength',
    })
    // the same input after editing the length shows it at the length
    expect(evaluate(h.present, metric, 'length').refusal?.field).toBe('length')
  })

  it('shows invalid text at its field and gives no drawing', () => {
    const h = run(newDesign(metric), type('length', '-3'))
    expect(evaluate(h.present, metric, 'length').refusal).toEqual({
      reason: 'Length must be at least 0 mm.',
      field: 'length',
    })
    const empty = run(newDesign(metric), type('diameter', ''))
    expect(evaluate(empty.present, metric).refusal).toEqual({
      reason: 'Enter a number for Diameter.',
      field: 'diameter',
    })
  })

  it('asks for the other cannelure value', () => {
    const h = run(newDesign(metric), type('cannelure.start', '10'))
    expect(evaluate(h.present, metric).refusal).toEqual({
      reason: 'A cannelure needs a start and a width.',
      field: 'cannelure.width',
    })
  })
})

describe('history', () => {
  it('a run of edits to one field is one undo step', () => {
    const h0 = run(newDesign(metric), type('length', '30'), type('length', '31'))
    const h1 = reduce(h0, type('meplatDiameter', '1'))
    const back = reduce(reduce(h1, { type: 'undo' }), { type: 'undo' })
    expect(back.present.fields.length.text).toBe('')
    expect(back.present.fields.meplatDiameter.text).toBe('')
    const once = reduce(h1, { type: 'undo' })
    expect(once.present.fields.length.text).toBe('31')
    expect(once.present.fields.meplatDiameter.text).toBe('')
    const again = reduce(once, { type: 'redo' })
    expect(again.present.fields.meplatDiameter.text).toBe('1')
    // a new edit after an undo drops the redo steps
    expect(reduce(once, type('length', '29')).future).toEqual([])
  })

  it('resets to the catalogue values as one undoable step', () => {
    const start = fromRecord(targetBullet, metric)
    const h = run(start, type('length', '35'), type('noseLength', '21'), {
      type: 'reset',
      system: metric,
    })
    expect(h.present.fields).toEqual(start.fields)
    expect(reduce(h, { type: 'undo' }).present.fields.noseLength.text).toBe('21')
  })

  it('a unit switch rewrites the text of every step and keeps the SI values', () => {
    const h = run(newDesign(metric), type('length', '30'), type('meplatDiameter', '1'))
    const u = reduce(h, { type: 'units', system: us })
    expect(u.present.fields.length).toEqual({ text: '1.1811', si: 30e-3 })
    expect(u.past.at(-1)?.fields.length.text).toBe('1.1811')
    expect(u.present.fields.mass.text).toBe('168')
    // the same outline, its labels in inches
    const [inch, mm] = [evaluate(u.present, us).drawing, evaluate(h.present, metric).drawing]
    expect(inch?.profile).toEqual(mm?.profile)
    expect(inch?.screen.scale.note).toBe('Dimensions in inches')
    expect(mm?.screen.scale.note).toBe('Dimensions in mm')
  })
})

it('slider ranges follow the diameter and widen to a larger value', () => {
  const d = newDesign(metric)
  expect(sliderMax('length', d)).toBeCloseTo(8 * 8e-3, 12)
  expect(sliderMax('noseLength', d)).toBeCloseTo(8 * 8e-3, 12)
  const big = reduce(historyOf(d), type('noseLength', '90')).present
  expect(sliderMax('noseLength', big)).toBeCloseTo(90e-3, 12)
})

it('extreme typed values give a drawing or a reason, never a throw', () => {
  const cases: [string, string][][] = [
    [['length', '100000']],
    [['diameter', '0.0001']],
    [
      ['diameter', '0.0001'],
      ['length', '100000'],
    ],
    [['length', '1e-6']],
    [
      ['noseLength', '0.0001'],
      ['length', '30'],
    ],
    [
      ['ogive.radius', '1e9'],
      ['length', '30'],
    ],
    [
      ['ogive.radius', '0.001'],
      ['length', '30'],
    ],
    [
      ['ogive.radiusRatio', '0.0000001'],
      ['length', '30'],
    ],
    [
      ['meplatDiameter', '7.8199'],
      ['length', '30'],
    ],
    // just past the length tolerance (0.05 mm) and the Rt/R tolerance (0.01)
    [
      ['length', '30'],
      ['noseLength', '18'],
      ['bearingLength', '12.06'],
    ],
    [
      ['length', '30'],
      ['noseLength', '18'],
      ['ogive.radiusRatio', '0.98'],
      ['ogive.radius', '51'],
    ],
  ]
  for (const edits of cases) {
    const h = run(newDesign(metric), ...edits.map(([k, t]) => type(k, t)))
    const e = evaluate(h.present, metric, edits.at(-1)?.[0])
    expect(e.drawing !== undefined || e.refusal !== undefined, JSON.stringify(edits)).toBe(true)
  }
})

it('random edit sequences always leave a drawing to show', () => {
  const rnd = seededRandom(118)
  const choices = [
    ['base.type', ['', 'flat', 'boat-tail', 'rebated-boat-tail']],
    ['ogive.form', ['', 'tangent', 'secant', 'hybrid', 'round-nose', 'flat-nose']],
    ['tip.type', ['', 'hollow-point', 'polymer-tip', 'soft-point', 'open-meplat']],
  ] as const
  for (const start of [newDesign(metric), fromRecord(matchBullet, metric)]) {
    let h = historyOf(start)
    let last = evaluate(start, metric).drawing
    expect(last).toBeDefined()
    let drawn = 0
    for (let i = 0; i < 1500; i++) {
      const r = rnd()
      let a: Action
      if (r < 0.15) {
        const [key, opts] = choices[Math.floor(rnd() * choices.length)]
        a = { type: 'choice', key, value: opts[Math.floor(rnd() * opts.length)] }
      } else if (r < 0.2) a = { type: rnd() < 0.5 ? 'undo' : 'redo' }
      else {
        const spec = designerSpecs[Math.floor(rnd() * designerSpecs.length)]
        const key = spec.key
        // parts along the axis up to the current length, as a user would set them
        const length = h.present.fields.length.si ?? 4 * (h.present.fields.diameter.si ?? 0)
        const axial =
          spec.quantity === 'length' && !['length', 'diameter', 'ogive.radius'].includes(key)
        const max = metric[spec.quantity].fromSi(
          axial ? Math.min(sliderMax(key, h.present), length) : sliderMax(key, h.present),
        )
        // clearing a field often, so the sequence leaves refused states again
        // the required diameter stays a number here; its empty and invalid text is tested above
        const pick = key === 'diameter' ? 1 : rnd()
        const text = pick < 0.35 ? '' : pick < 0.38 ? 'x' : String(+(rnd() * max).toFixed(3))
        a = type(key, text)
      }
      h = reduce(h, a)
      const e = evaluate(h.present, metric, 'key' in a ? a.key : undefined)
      // a drawing, or a stated reason at a field while the last drawing stays
      if (e.drawing) {
        // the page lays out the print drawing from the same profile
        expect(bulletFigureModel(e.drawing.profile, 'print', face.printEm).frame).toHaveLength(4)
        ;[last, drawn] = [e.drawing, drawn + 1]
      } else expect(e.refusal?.reason).toBeTruthy()
      expect(last).toBeDefined()
    }
    // the sequence reaches many drawable states, not only refusals
    expect(drawn).toBeGreaterThan(20)
  }
})

describe('record boundaries', () => {
  it('New and a start begin a new undo history, so an undone state never reaches another record', () => {
    const edited = run(newDesign(metric), type('length', '30'))
    const opened = reduce(edited, {
      type: 'start',
      design: fromRecord(matchBullet, metric),
    })
    expect(opened.past).toHaveLength(0)
    expect(reduce(opened, { type: 'undo' }).present).toBe(opened.present)
    const fresh = reduce(opened, { type: 'new', system: metric })
    expect(fresh.past).toHaveLength(0)
    expect(reduce(fresh, { type: 'undo' }).present).toBe(fresh.present)
  })
})

describe('drafts', () => {
  it('a design keeps its base record through a file round trip and a reset', () => {
    const start = fromRecord(targetBullet, metric)
    const data = fileData(start)
    expect(data.basedOn).toBe(`catalogue:${targetBullet.id}`)
    const opened = fromUser(data, resolvedOf(data, targetBullet), metric)
    expect(fileData(opened)).toEqual(data)
    const reset = reduce(historyOf(opened), { type: 'reset', system: metric }).present
    expect(reset.basedOn).toBe(data.basedOn)
    expect(
      fileData(reduce(historyOf(start), { type: 'new', system: metric }).present).basedOn,
    ).toBeUndefined()
  })

  it('saves only what differs from the base: an untouched design has no overrides', () => {
    expect(fileData(fromRecord(targetBullet, metric)).overrides).toBeUndefined()
    const edited = run(fromRecord(targetBullet, metric), type('length', '30')).present
    expect(fileData(edited).overrides).toEqual({ length: { value: 30 } })
  })

  it('saves a cleared field and a cleared choice as null, an entered choice and a name as given', () => {
    const start = fromRecord(matchBullet, metric)
    expect(start.choices['ogive.form']).not.toBe('')
    const cleared = run(
      start,
      type('length', ''),
      { type: 'choice', key: 'ogive.form', value: '' },
      { type: 'choice', key: 'tip.type', value: 'polymer-tip' },
      { type: 'text', key: 'name', value: 'Mine' },
    ).present
    const { overrides } = fileData(cleared)
    expect(overrides).toMatchObject({
      length: null,
      ogive: { form: null },
      tip: { type: 'polymer-tip' },
      name: 'Mine',
    })
    // opened again, the resolved design is the edited one and saves the same overrides
    const again = fromUser(fileData(cleared), resolvedOf(fileData(cleared), matchBullet), metric)
    expect(again.fields.length.si).toBeUndefined()
    expect(again.choices['ogive.form']).toBe('')
    expect(again.name).toBe('Mine')
    expect(fileData(again)).toEqual(fileData(cleared))
  })

  it('saves every given field of a design without a base, as quantities in stored units', () => {
    const d = run(newDesign(metric), type('length', '30')).present
    expect(fileData(d)).toEqual({
      origin: 'user',
      manufacturerName: '',
      overrides: {
        diameter: { value: 7.8232 },
        mass: { value: 10.88621688 },
        length: { value: 30 },
      },
    })
  })

  it('opens a design whose base is gone read only and saves its data as stored', () => {
    const data: UserBullet = {
      origin: 'user',
      manufacturerName: 'Me',
      basedOn: 'catalogue:gone',
      overrides: { mass: { value: 9 } },
    }
    const base = { status: 'missing', ref: 'catalogue:gone' } as const
    const problem = 'The base record catalogue:gone is no longer in the catalogue.'
    const d = fromUser(data, { base, record: applyOverrides({}, data.overrides), problem }, metric)
    expect(d.locked?.reason).toBe(problem)
    expect(fileData(d)).toBe(data)
  })

  it('keeps 100 undo steps', () => {
    let h = historyOf(newDesign(metric))
    for (let i = 0; i < 120; i++)
      h = reduce(h, { type: 'choice', key: 'tip.type', value: String(i) })
    expect(h.past.length).toBe(100)
  })

  it('draws a design as the seating preview shape, in mm and degrees', () => {
    const d = fileData(fromRecord(targetBullet, metric))
    const shape = designShape(resolvedOf(d, targetBullet), metric)
    const r = targetBullet
    expect(shape?.diameter).toBeCloseTo(r.diameter.value, 9)
    expect(shape?.length).toBeCloseTo(r.length?.value as number, 9)
    expect(shape?.base?.length).toBeCloseTo(r.base?.length?.value as number, 9)
    const noLength = { diameter: targetBullet.diameter }
    expect(designShape({ base: { status: 'none' }, record: noLength }, metric)).toBeUndefined()
  })
})

describe('hollow base', () => {
  const hollow = () => {
    const start = newDesign(metric)
    return run(
      { ...start, choices: { ...start.choices, 'base.type': 'conical-hollow-base' } },
      type('length', '30'),
      type('base.cavityDiameter', '5'),
    ).present
  }

  it('shows the cavity diameter and the tail fields for a hollow base only', () => {
    const d = hollow()
    for (const key of ['base.cavityDiameter', 'base.length', 'base.diameter', 'base.angle'])
      expect(fieldInUse(key, d)).toBe(true)
    const flat = newDesign(metric)
    expect(
      fieldInUse('base.cavityDiameter', {
        ...flat,
        choices: { ...flat.choices, 'base.type': 'boat-tail' },
      }),
    ).toBe(false)
  })

  it('draws the cavity and seats the design with it', () => {
    const d = hollow()
    const e = evaluate(d, metric)
    expect(e.drawing).toBeDefined()
    expect(e.drawing?.given).toContain('base.cavityDiameter')
    const shape = designShape(resolvedOf(fileData(d)), metric)
    expect(shape?.base).toMatchObject({ type: 'conical-hollow-base' })
    expect(shape?.base?.cavityDiameter).toBeCloseTo(5, 9)
    const o = shape && bulletOutline(shape)
    expect(o && !('reason' in o) && o.cavity).toMatchObject({ radius: 2.5 })
  })

  it('refuses a cavity as wide as the base at the cavity field', () => {
    const d = hollow()
    const e = evaluate(
      reduce(historyOf(d), type('base.cavityDiameter', '9')).present,
      metric,
      'base.cavityDiameter',
    )
    expect(e.drawing).toBeUndefined()
    expect(e.refusal?.field).toBe('base.cavityDiameter')
  })
})
