import { describe, expect, it } from 'vitest'
import {
  type Action,
  type Design,
  draftSpec,
  draws,
  evaluate,
  fieldSpecs,
  fileData,
  fromFile,
  fromRecord,
  type History,
  historyOf,
  newDesign,
  reduce,
  sliderMax,
} from '../src/lib/cartridge-designer.ts'
import { seededRandom } from '../src/lib/ellipse.ts'
import { fieldValueFromText } from '../src/lib/field-spec.ts'
import { presetUnits } from '../src/lib/units.ts'
import { verified } from './drawing-rules.ts'
import { sheetRecord } from './records.ts'

const metric = presetUnits('metric-grams')
const us = presetUnits('us')
const win308 = () => fromRecord(sheetRecord('cip-308-win-2008-09-23'), metric)

/** Types `text` in the field `key` in metric units (mm, degrees). */
const type = (key: string, text: string): Action => {
  const q = fieldSpecs.find((s) => s.key === key)?.quantity ?? 'length'
  return { type: 'field', key, value: fieldValueFromText(q, metric, text) }
}
const run = (start: Design, ...actions: Action[]) =>
  actions.reduce<History>(reduce, historyOf(start))

describe('start', () => {
  it('a record start fills the fields from the record, each from the record', () => {
    const d = win308()
    expect(d.fields['cartridge.L3']).toEqual({ text: '51.18', si: 51.18e-3 })
    // shown rounded, the SI value the record's
    expect(d.fields['chamber.alpha1'].text).toBe('71.4')
    expect(d.table).toBe('I')
    const e = evaluate(d, metric)
    expect(e.states['cartridge.L3']).toEqual({ kind: 'record' })
    expect(e.states['chamber.G1']).toEqual({ kind: 'record' })
    // printed in neither column of the 308 Win. sheet
    expect(e.states['cartridge.r0']).toEqual({ kind: 'notPrinted' })
    expect(e.refusal).toBeUndefined()
    expect(e.spec).toBeDefined()
  })

  it('keeps the record values, without pressures, and draws them unchanged', () => {
    for (const r of verified) {
      const s = sheetRecord(r.id)
      const draft = draftSpec(fromRecord(s, metric))
      // the record's own objects: printed text, tolerance and limit stay
      expect(draft.values).toEqual(s.values.filter((v) => v.side))
      for (const [k, v] of draft.values.entries()) expect(v).toBe(s.values.filter((x) => x.side)[k])
      expect(draft.table).toBe(s.table)
    }
  })

  it('starts from a record that draws', () => {
    const s = sheetRecord('cip-308-win-2008-09-23')
    expect(draws(s)).toBe(true)
    expect(draws({ ...s, values: [] })).toBe(false)
  })

  it('a new cartridge is empty and gives a reason instead of a drawing', () => {
    const e = evaluate(newDesign(), metric)
    expect(e.spec).toBeUndefined()
    expect(e.refusal).toEqual({
      reason:
        'Cartridge not drawn: missing R1, R, P1, L3, H2. Chamber not drawn: missing R1, R, P1, L3, H2. Enter at least R1, R, P1, L3 and H2 of the cartridge or the chamber to draw.',
      field: 'cartridge.R1',
    })
  })

  it('"New cartridge" keeps the base values of both sides and clears the rest', () => {
    const h = run(win308(), { type: 'new' })
    const d = h.present
    expect(d.origin).toBeUndefined()
    expect(d.fields['cartridge.L3'].text).toBe('51.18')
    expect(d.fields['chamber.H2'].text).toBe('8.74')
    expect(d.fields['cartridge.L1'].text).toBe('')
    const e = evaluate(d, metric)
    expect(e.spec).toBeDefined()
    expect(e.states['cartridge.L3']).toEqual({ kind: 'entered', changed: false })
    expect(e.states['cartridge.L1']).toEqual({ kind: 'empty' })
  })
})

describe('changes', () => {
  it('marks a changed value with the record value and draws it without its printed text', () => {
    const h = run(win308(), type('cartridge.L3', '52'))
    const e = evaluate(h.present, metric, h.last)
    expect(e.states['cartridge.L3']).toEqual({ kind: 'entered', changed: true, record: 51.18e-3 })
    const L3 = e.spec?.values.find((v) => v.side === 'cartridge' && v.symbol === 'L3')
    expect(L3).toEqual({ side: 'cartridge', symbol: 'L3', quantity: 'length', value: 52 })
  })

  it('leaves a cleared value out and a new value in', () => {
    const h = run(win308(), type('cartridge.L6', ''), type('cartridge.r0', '0.5'))
    const values = draftSpec(h.present).values
    expect(values.some((v) => v.side === 'cartridge' && v.symbol === 'L6')).toBe(false)
    expect(values).toContainEqual({
      side: 'cartridge',
      symbol: 'r0',
      quantity: 'length',
      value: 0.5,
    })
  })

  it('stores typed inches back in mm, 12 significant digits', () => {
    const h = run(fromRecord(sheetRecord('cip-308-win-2008-09-23'), us), {
      type: 'field',
      key: 'cartridge.L3',
      value: fieldValueFromText('length', us, '2'),
    })
    const L3 = draftSpec(h.present).values.find((v) => v.side === 'cartridge' && v.symbol === 'L3')
    expect(L3?.value).toBe(50.8)
  })

  it('switches units of every step and keeps the drawing', () => {
    const h = run(win308(), type('cartridge.L3', '52'))
    const before = draftSpec(h.present)
    const after = reduce(h, { type: 'units', system: us })
    expect(after.present.fields['cartridge.L3'].text).toBe('2.0472')
    expect(after.past[0].fields['cartridge.L3'].text).toBe('2.015')
    expect(draftSpec(after.present)).toEqual(before)
  })
})

describe('checks', () => {
  it('shows a CIP plausibility finding at both fields and keeps the drawing', () => {
    const h = run(win308(), type('cartridge.P1', '12.5'))
    const e = evaluate(h.present, metric, h.last)
    expect(e.spec).toBeDefined()
    expect(e.checks['cartridge.P1']).toContain(
      'cartridge P1 = 12.5 mm exceeds chamber P1 = 11.99 mm',
    )
    expect(e.checks['chamber.P1']).toEqual(e.checks['cartridge.P1'])
  })

  it('shows the length order at the cartridge lengths and the case fit at both L3', () => {
    const e = evaluate(run(win308(), type('cartridge.L3', '52.5')).present, metric)
    expect(e.checks['cartridge.L3']).toContain(
      'cartridge L3 = 52.5 mm exceeds chamber L3 = 51.44 mm',
    )
    expect(e.checks['chamber.L3']).toContain(e.checks['cartridge.L3'][0])
    const order = evaluate(run(win308(), type('cartridge.L2', '38')).present, metric)
    expect(order.checks['cartridge.L1']).toContain(
      'cartridge L1 = 39.62 mm is not below L2 = 38 mm',
    )
    expect(order.checks['cartridge.L2']).toEqual(order.checks['cartridge.L1'])
  })

  it('shows an outline note at the fields of its symbols', () => {
    // the shoulder angle 2 atan((P2 - H1) / 2 / (L2 - L1)) no longer matches alpha 40 deg
    const e = evaluate(run(win308(), type('cartridge.L2', '45')).present, metric)
    expect(e.spec).toBeDefined()
    expect(e.notes['cartridge.alpha']?.join(' ')).toMatch(/alpha/)
    // a note is help, not an error
    expect(e.checks['cartridge.alpha']).toBeUndefined()
  })

  it('finds no CIP plausibility rule broken on the unchanged 308 Win.', () => {
    const e = evaluate(win308(), metric)
    expect(Object.values(e.checks).flat().join(' ')).not.toMatch(/exceeds|is not below/)
  })
})

describe('refusals', () => {
  it('keeps the drawing out and names the field on invalid text', () => {
    const h = run(win308(), type('cartridge.L3', '-1'))
    const e = evaluate(h.present, metric, h.last)
    expect(e.spec).toBeUndefined()
    expect(e.refusal).toEqual({
      reason: 'Cartridge L3 must be at least 0 mm.',
      field: 'cartridge.L3',
    })
  })

  it('refuses lengths past the designer range, whose layout would take seconds', () => {
    const h = run(win308(), type('cartridge.P1', '60'))
    expect(evaluate(h.present, metric, h.last).refusal).toEqual({
      reason: 'Cartridge P1 must be at most 50 mm in the designer.',
      field: 'cartridge.P1',
    })
  })

  it('names the missing base symbols when no side draws', () => {
    const h = run(win308(), type('cartridge.P1', ''), type('chamber.P1', ''))
    const e = evaluate(h.present, metric, h.last)
    expect(e.spec).toBeUndefined()
    expect(e.refusal).toEqual({
      reason:
        'Cartridge not drawn: missing P1. Chamber not drawn: missing P1. Enter at least R1, R, P1, L3 and H2 of the cartridge or the chamber to draw.',
      field: 'chamber.P1',
    })
  })

  it('draws one side while the other misses a base value', () => {
    const e = evaluate(run(win308(), type('chamber.P1', '')).present, metric)
    expect(e.spec).toBeDefined()
    expect(e.refusal).toBeUndefined()
  })
})

describe('derived values', () => {
  it('gives neck length, shoulder angle, body taper and an approximate case volume', () => {
    const e = evaluate(win308(), metric)
    const by = Object.fromEntries(e.derived.map((d) => [d.key, d]))
    expect(by['cartridge.neck'].si).toBeCloseTo((51.18 - 43.48) * 1e-3, 9)
    // 2 atan((11.53 - 8.72) / 2 / (43.48 - 39.62)): the stored alpha is 40 deg
    expect(by['cartridge.shoulder'].si).toBeCloseTo(2 * Math.atan(2.81 / 2 / 3.86), 9)
    expect(by['cartridge.taper'].si).toBeGreaterThan(0)
    expect(by['cartridge.taper'].si).toBeLessThan(Math.PI / 180)
    // 308 Win. cases hold about 3.5 to 3.7 cm3 of water to the mouth
    expect(by.volume.si).toBeGreaterThan(3.2e-6)
    expect(by.volume.si).toBeLessThan(4.2e-6)
    expect(by.volume.basis).toMatch(/wall .* \(H2 - G1\) \/ 2/)
  })

  it('leaves out what the design does not give', () => {
    const e = evaluate(fromRecord(sheetRecord('cip-9-mm-luger-2008-09-23'), metric), metric)
    const keys = e.derived.map((d) => d.key)
    expect(keys).not.toContain('cartridge.shoulder')
    expect(keys).toContain('volume')
  })
})

describe('history', () => {
  it('undoes a run of edits to one field in one step, and redoes it', () => {
    const h = run(win308(), type('cartridge.L3', '5'), type('cartridge.L3', '52'))
    expect(h.past).toHaveLength(1)
    const back = reduce(h, { type: 'undo' })
    expect(back.present.fields['cartridge.L3'].text).toBe('51.18')
    expect(reduce(back, { type: 'redo' }).present.fields['cartridge.L3'].text).toBe('52')
  })

  it('resets to the record as one step', () => {
    const h = run(win308(), type('cartridge.L3', '52'), type('chamber.G1', '7.9'), {
      type: 'reset',
      system: metric,
    })
    expect(h.present.fields['cartridge.L3'].text).toBe('51.18')
    expect(h.past).toHaveLength(3)
  })

  it('changes the table of the drawing rules as one step', () => {
    const h = run(win308(), { type: 'table', value: 'III' })
    expect(draftSpec(h.present).table).toBe('III')
    expect(reduce(h, { type: 'undo' }).present.table).toBe('I')
  })
})

describe('slider ranges', () => {
  it('hold still while a value moves inside them and widen past them', () => {
    const d = win308()
    const L3 = fieldSpecs.find((s) => s.key === 'cartridge.L3')
    expect(L3 && sliderMax(L3, d)).toBeCloseTo(200e-3, 12)
    const long = run(d, type('cartridge.L3', '250')).present
    expect(L3 && sliderMax(L3, long)).toBeCloseTo(250e-3, 12)
  })
})

describe('random edits', () => {
  for (const [seed, start] of [
    [1, 'cip-308-win-2008-09-23'],
    [2, 'cip-300-win-mag-2002-05-15'],
    [3, 'cip-9-mm-luger-2008-09-23'],
  ] as const)
    it(`always give a drawing or a reason (${start})`, () => {
      const next = seededRandom(seed)
      let h = historyOf(fromRecord(sheetRecord(start), metric))
      let drawn = 0
      for (let k = 0; k < 150; k++) {
        const s = fieldSpecs[Math.floor(next() * fieldSpecs.length)]
        // mostly near the present value (else a tenth of the slider range), sometimes extreme
        const now =
          (h.present.fields[s.key].si ?? s.range / 10) *
          (s.quantity === 'angle' ? 180 / Math.PI : 1e3)
        const r = next()
        const text =
          r < 0.08
            ? ''
            : r < 0.12
              ? '0'
              : r < 0.15
                ? '-3'
                : r < 0.18
                  ? '1e6'
                  : String(Number((now * (0.5 + next())).toFixed(3)))
        h = reduce(h, type(s.key, text))
        const e = evaluate(h.present, metric, h.last)
        expect(e.spec !== undefined || e.refusal !== undefined).toBe(true)
        if (e.spec) drawn++
        if (e.refusal) {
          expect(e.refusal.reason.length).toBeGreaterThan(0)
          // as a user would: take the refused step back and go on
          h = reduce(h, { type: 'undo' })
        }
      }
      // the sequence draws, not only refuses
      expect(drawn).toBeGreaterThan(75)
    })
})

describe('record boundaries', () => {
  it('New and a start begin a new undo history, so an undone state never reaches another record', () => {
    const edited = run(win308(), type('cartridge.L1', '39'))
    const opened = reduce(edited, { type: 'start', design: win308() })
    expect(opened.past).toHaveLength(0)
    expect(reduce(opened, { type: 'undo' }).present).toBe(opened.present)
    const fresh = reduce(opened, { type: 'new' })
    expect(fresh.past).toHaveLength(0)
    expect(reduce(fresh, { type: 'undo' }).present).toBe(fresh.present)
  })
})

describe('drafts', () => {
  it('a design keeps its parent record through a file round trip and a reset', () => {
    const data = fileData(win308())
    expect(data.parent).toEqual({ id: '308-win', title: win308().origin?.title })
    const opened = fromFile(data, 'Design', metric)
    expect(fileData(opened).parent).toEqual(data.parent)
    const reset = reduce(historyOf(opened), { type: 'reset', system: metric }).present
    expect(reset.parent).toEqual(data.parent)
    expect(reduce(historyOf(win308()), { type: 'new' }).present.parent).toBeUndefined()
  })
})
