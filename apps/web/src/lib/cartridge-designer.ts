import type { I18n } from '@lingui/core'
import { checkSpec } from '@rangefoundry/catalog/plausibility'
import {
  type CartridgeOverrides,
  type SpecValue,
  toSi,
  type UserCartridge,
} from '@rangefoundry/schema'
import {
  drawnTables,
  type Figure,
  recordFigures,
  storedValue,
} from '@rangefoundry/svg-drawings/cartridge'
import { linguiOf, loadEnglish } from '../i18n/lingui.ts'
import { localizeNumber } from '../i18n/number.ts'
import { english, type Translator } from '../i18n/translate.ts'
import englishMessages from '../locales/en/lib/cartridge-designer.json' with { type: 'json' }
import type { CartridgeDetail } from './api-types.ts'
import {
  both,
  type CartridgeFieldSpec,
  caseVolume,
  type Design,
  type DraftSpec,
  draftSpec,
  fieldSpecs,
  keyOf,
  layOut,
  type Origin,
  originOf,
  specOf,
  storedFieldValue,
  tooLarge,
} from './cartridge-draft.ts'
import { drawable } from './cartridge-sheet.ts'
import { fieldError } from './field-error.ts'
import { close, type FieldSpec, type FieldValue, fieldOf } from './field-spec.ts'
import { designReduce, type History as H, historyOf, mapHistory, pushHistory } from './history.ts'
import { nth } from './nth.ts'
import { exactFieldText, type UnitSystem } from './units.ts'

loadEnglish(englishMessages)

/** The symbols every side needs to draw (`cipProfile`). */
const baseSymbols = ['R1', 'R', 'P1', 'L3', 'H2']
const empty: FieldValue = { text: '', si: undefined }

/** Whether the record draws at least one figure. */
export const draws = (c: CartridgeDetail) =>
  recordFigures(drawable(c)).some((f) => f.drawn.length > 0)

/** The design of a cartridge record, every value from the record. */
export function fromRecord(c: CartridgeDetail, system: UnitSystem): Design {
  return fromOrigin(originOf(c), system)
}

/** Overrides are what differs from the base (`null` for one cleared); what the designer has no field for keeps its opened value. */
export function fileData(design: Design): UserCartridge {
  if (design.locked) return design.locked.data
  const { origin, basedOn, table } = design
  const { values: keptValues = [], table: _table, ...others } = design.kept ?? {}
  const overrides: CartridgeOverrides = others
  if (!origin || table !== origin.table) overrides.table = table
  const values = [
    ...keptValues.filter((v) => !specOf.has(keyOf(v) ?? '')),
    ...valueOverrides(design),
  ]
  if (values.length > 0) overrides.values = values
  return {
    origin: 'user',
    ...(basedOn && { basedOn }),
    ...(basedOn && origin?.revision && { basedOnRevision: origin.revision }),
    ...(Object.keys(overrides).length > 0 && { overrides }),
  }
}

/** The design of an origin as stored, as on a reset. */
function fromOrigin(origin: Origin, system: UnitSystem): Design {
  return {
    table: origin.table ?? 'I',
    fields: Object.fromEntries(
      fieldSpecs.map((s) => [s.key, fieldOf(system, s, origin.si[s.key])]),
    ),
    origin,
    basedOn: `catalogue:${origin.id}`,
  }
}

/** A new cartridge: the base values of `from` on both sides, every other field empty. */
export function newDesign(from?: Design): Design {
  return {
    table: from && from.table !== 'VII' ? from.table : 'I',
    fields: Object.fromEntries(
      fieldSpecs.map((s) => [
        s.key,
        (baseSymbols.includes(s.symbol) && from?.fields[s.key]) || empty,
      ]),
    ),
  }
}

/** A value outside the fields (a variant, a pressure) is the base's and not listed. */
function valueOverrides({ fields, origin }: Design): NonNullable<CartridgeOverrides['values']> {
  const out: NonNullable<CartridgeOverrides['values']> = []
  for (const s of fieldSpecs) {
    const si = fields[s.key]?.si
    const was = origin?.si[s.key]
    const entry = { side: s.side, symbol: s.symbol, quantity: s.quantity as 'length' | 'angle' }
    if (si === undefined) {
      if (was !== undefined) out.push({ ...entry, value: null })
    } else if (!(origin && close(si, was))) out.push({ ...entry, value: storedFieldValue(s, si) })
  }
  return out
}

/** The tables a design may take: the ones the outline draws, table VII only for its own records. */
export const tables = [...drawnTables]

export type Action =
  | { type: 'field'; key: string; value: FieldValue }
  | { type: 'table'; value: string }
  | { type: 'name'; value: string }
  | { type: 'start'; design: Design }
  | { type: 'new' }
  | { type: 'reset'; system: UnitSystem }
  | { type: 'revert'; key: string; system: UnitSystem }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'units'; system: UnitSystem }

export type History = H<Design>
export { historyOf } from './history.ts'

export function reduce(h: History, a: Action): History {
  switch (a.type) {
    case 'table':
      return pushHistory(h, { ...h.present, table: a.value })
    case 'name':
      // the name is no drawing input: not an undo step, and every step keeps it
      return mapHistory(h, (d) => ({ ...d, name: a.value }))
    case 'new':
      return historyOf(newDesign(h.present))
    case 'reset': {
      // the record's values, the name typed for the design stays
      const r = designReduce(h, a, fieldSpecs, fromOrigin)
      return r === h ? h : { ...r, present: { ...r.present, name: h.present.name } }
    }
    default:
      return designReduce(h, a, fieldSpecs, fromOrigin)
  }
}

/** `changed`: entered against a record, whose value `record` carries. */
export type FieldState =
  | { kind: 'record' }
  | { kind: 'entered'; changed: boolean; record?: number | undefined }
  | { kind: 'cleared'; record: number }
  | { kind: 'derived'; si: number }
  | { kind: 'notPrinted' }
  | { kind: 'empty' }

/** A value derived from the drawn outline, SI; `basis` states its assumptions. */
export interface Derived {
  key: string
  label: string
  quantity: 'length' | 'angle' | 'capacity'
  si: number
  basis?: string
}

export interface Evaluation {
  /** The spec drawn and its figures, laid out once; none when the input is refused. */
  spec?: DraftSpec
  figures?: Figure[]
  /** Why there is no drawing for this input, and the field to show it at. */
  refusal?: { reason: string; field: string } | undefined
  states: Record<string, FieldState>
  /** CIP plausibility findings by field key, shown as the field's error. */
  checks: Record<string, string[]>
  /** Outline notes by field key, shown in the field's help: a note does not make a value invalid. */
  notes: Record<string, string[]>
  derived: Derived[]
}

export const missingHint = /*i18n*/ {
  id: 'cartridgeDesigner.enterLeastToDraw',
  message: 'Enter at least R1, R, P1, L3 and H2 of the cartridge or the chamber to draw.',
}

const sideSymbol = {
  cartridge: /*i18n*/ { id: 'cartridgeDesigner.cartridgeSymbol', message: 'Cartridge {symbol}' },
  chamber: /*i18n*/ { id: 'cartridgeDesigner.chamberSymbol', message: 'Chamber {symbol}' },
} as const

/** The field's label in the language of `i18n`: the side and the symbol. */
export const fieldLabel = (s: CartridgeFieldSpec, i18n: I18n) =>
  i18n._({ ...sideSymbol[s.side], values: { symbol: s.symbol } })

const labeledSpecs = new WeakMap<CartridgeFieldSpec, FieldSpec>()

/** The field with that label as a message, so the field and its messages show it in the language shown; one object per field, for the memoized field. */
export function labeled(s: CartridgeFieldSpec): FieldSpec {
  const known = labeledSpecs.get(s)
  if (known) return known
  const spec = { ...s, label: { ...sideSymbol[s.side], values: { symbol: s.symbol } } }
  labeledSpecs.set(s, spec)
  return spec
}

/** Where each field's value comes from, against the record the design started from. */
function fieldStates({ fields, origin }: Design): Evaluation['states'] {
  const states: Evaluation['states'] = {}
  for (const s of fieldSpecs) {
    const si = fields[s.key]?.si
    const o = origin?.si[s.key]
    states[s.key] =
      si === undefined
        ? o !== undefined
          ? { kind: 'cleared', record: o }
          : { kind: origin ? 'notPrinted' : 'empty' }
        : close(si, o)
          ? { kind: 'record' }
          : {
              kind: 'entered',
              changed: origin !== undefined,
              ...(o !== undefined && { record: o }),
            }
  }
  return states
}

/** The first invalid or too large field (`last` first); none when every field is valid. */
function refuseInvalid(
  { fields }: Design,
  system: UnitSystem,
  last: string | undefined,
  t: Translator['t'],
  i18n: I18n,
): Evaluation['refusal'] {
  const tooLargeText = (s: CartridgeFieldSpec) => {
    if (s.limit === undefined || !tooLarge(s, fields)) return
    return i18n._({
      id: 'cartridgeDesigner.atMostInDesigner',
      message: '{label} must be at most {max} {unit} in the designer.',
      values: {
        label: fieldLabel(s, i18n),
        max: localizeNumber(exactFieldText(s.quantity, system, s.limit)),
        unit: system[s.quantity].symbol,
      },
    })
  }
  const invalid = fieldSpecs
    .map(
      (s) =>
        [s.key, fieldError(labeled(s), fields[s.key], system, t, i18n) ?? tooLargeText(s)] as const,
    )
    .filter(([, e]) => e !== undefined)
  const bad = invalid.find(([k]) => k === last) ?? invalid[0]
  if (bad) return { reason: bad[1] as string, field: bad[0] }
}

/** Or the refusal when the screen layout cannot lay them out or no side draws. */
function refuseUnlayable(
  spec: DraftSpec,
  { fields }: Design,
  last: string | undefined,
  i18n: I18n,
): { list: Figure[]; shown: Figure[] } | { refusal: NonNullable<Evaluation['refusal']> } {
  const laid = layOut(spec)
  if (!laid)
    return {
      refusal: {
        reason: i18n._({
          id: 'cartridgeDesigner.noOutline',
          message: 'These dimensions do not form an outline.',
        }),
        field: last ?? nth(fieldSpecs, 0).key,
      },
    }
  const { list, shown } = laid
  if (!shown.length) {
    const notes = list.flatMap((f) => f.notes)
    const missing = notes.filter((n) => n.code === 'missing').map((n) => n.text)
    const keys = both.flatMap((side) =>
      baseSymbols.map((symbol) => `${side}.${symbol}`).filter((k) => fields[k]?.si === undefined),
    )
    return {
      refusal: {
        reason: [...missing, i18n._(missingHint)].join(' '),
        field: keys.find((k) => k === last) ?? keys[0] ?? nth(fieldSpecs, 0).key,
      },
    }
  }
  return { list, shown }
}

/** Adds `text` once to the texts of field `key`; keys of no field are left out. */
const addText = (to: Record<string, string[]>, key: string, text: string) => {
  if (!specOf.has(key)) return
  to[key] = [...new Set([...(to[key] ?? []), text])]
}

/** CIP plausibility findings of `spec` by field key, without the pressure ratios a design has no values for. */
function plausibilityChecks(spec: DraftSpec): Evaluation['checks'] {
  const checks: Evaluation['checks'] = {}
  const findings = checkSpec(spec as unknown as Parameters<typeof checkSpec>[0]).filter(
    (f) => !f.finding.includes('@') && !f.finding.startsWith('pk-') && !f.finding.startsWith('pe-'),
  )
  for (const { finding, message } of findings) {
    const [rule, of = ''] = finding.split(':')
    const keys =
      rule === 'diameter-fit'
        ? both.map((side) => `${side}.${of}`)
        : rule === 'length-order'
          ? of.split('-').map((symbol) => `cartridge.${symbol}`)
          : rule === 'case-fits-chamber'
            ? ['cartridge.L3', 'chamber.L3']
            : []
    for (const k of keys) addText(checks, k, message)
  }
  return checks
}

/** Outline notes of the drawn figures by field key. */
function outlineNotes(shown: Figure[]): Evaluation['notes'] {
  const notes: Evaluation['notes'] = {}
  for (const f of shown) {
    for (const { side, p } of f.drawn)
      for (const n of p.notes)
        for (const symbol of n.symbols) addText(notes, `${side}.${symbol}`, n.text)
    for (const n of f.notes.filter((x) => x.code === 'closedFront'))
      addText(notes, 'cartridge.L3', n.text)
  }
  return notes
}

/** A refusal naming `last` shows at that field; a design no side draws gives no drawing, so the page keeps its last one. */
export function evaluate(
  design: Design,
  system: UnitSystem,
  last?: string,
  t: Translator['t'] = english.t,
  i18n: I18n = linguiOf('en'),
): Evaluation {
  const states = fieldStates(design)
  const done = (refusal: Evaluation['refusal']): Evaluation => ({
    refusal,
    states,
    checks: {},
    notes: {},
    derived: [],
  })

  const invalid = refuseInvalid(design, system, last, t, i18n)
  if (invalid) return done(invalid)

  const spec = draftSpec(design)
  const laid = refuseUnlayable(spec, design, last, i18n)
  if ('refusal' in laid) return done(laid.refusal)
  const { list, shown } = laid

  const checks = plausibilityChecks(spec)
  const notes = outlineNotes(shown)
  const lead = nth(shown, 0)
  const derived = design.table === 'VII' ? [] : derive(lead, spec.values, i18n)
  for (const { side, p } of lead.drawn)
    if (
      side === 'cartridge' &&
      p.derivedE !== undefined &&
      design.fields['cartridge.e']?.si === undefined
    )
      states['cartridge.e'] = { kind: 'derived', si: toSi('length', p.derivedE) }
  return { spec, figures: list, states, checks, notes, derived }
}

const derivedLabels = {
  cartridge: {
    neck: /*i18n*/ {
      id: 'cartridgeDesigner.cartridgeNeckLength',
      message: 'Cartridge neck length',
    },
    shoulder: /*i18n*/ {
      id: 'cartridgeDesigner.cartridgeShoulderAngle',
      message: 'Cartridge shoulder angle',
    },
    taper: /*i18n*/ { id: 'cartridgeDesigner.cartridgeBodyTaper', message: 'Cartridge body taper' },
  },
  chamber: {
    neck: /*i18n*/ { id: 'cartridgeDesigner.chamberNeckLength', message: 'Chamber neck length' },
    shoulder: /*i18n*/ {
      id: 'cartridgeDesigner.chamberShoulderAngle',
      message: 'Chamber shoulder angle',
    },
    taper: /*i18n*/ { id: 'cartridgeDesigner.chamberBodyTaper', message: 'Chamber body taper' },
  },
} as const

/** Neck length, shoulder angle and body taper of each drawn side, from stored values (mm, degrees); SI out. */
function derivedAngles(figure: Figure, values: SpecValue[], i18n: I18n): Derived[] {
  const out: Derived[] = []
  for (const { side, p } of figure.drawn) {
    const v = (symbol: string) => storedValue(values, side, symbol)?.value
    const [L1, L2, L3, P1, P2, H1] = ['L1', 'L2', 'L3', 'P1', 'P2', 'H1'].map(v)
    const label = derivedLabels[side]
    if (L3 !== undefined && L2 !== undefined && L3 > L2)
      out.push({
        key: `${side}.neck`,
        label: i18n._(label.neck),
        basis: 'L3 - L2',
        quantity: 'length',
        si: toSi('length', L3 - L2),
      })
    if (P2 !== undefined && H1 !== undefined && L1 !== undefined && L2 !== undefined && L2 > L1)
      out.push({
        key: `${side}.shoulder`,
        label: i18n._(label.shoulder),
        basis: i18n._({
          id: 'cartridgeDesigner.included2AtanP2',
          message: 'included, 2 atan((P2 - H1) / 2 / (L2 - L1))',
        }),
        quantity: 'angle',
        si: 2 * Math.atan((P2 - H1) / 2 / (L2 - L1)),
      })
    // P1 at its drawn station, after the head
    const zP1 = P1 === undefined ? undefined : p.points.find(([r]) => r === P1 / 2)?.[1]
    if (P1 !== undefined && P2 !== undefined && L1 !== undefined && zP1 !== undefined && L1 > zP1)
      out.push({
        key: `${side}.taper`,
        label: i18n._(label.taper),
        basis: i18n._({
          id: 'cartridgeDesigner.includedAngleP1Drawn',
          message: 'included angle from P1 at its drawn station to P2 at L1',
        }),
        quantity: 'angle',
        si: 2 * Math.atan((P1 - P2) / 2 / (L1 - zP1)),
      })
  }
  return out
}

/** Approximate: the outline less a wall from head to mouth; mm and degrees in, SI out. */
function approximateCaseVolume(
  figure: Figure,
  values: SpecValue[],
  i18n: I18n,
): Derived | undefined {
  const volume = caseVolume(figure, values)
  if (!volume) return undefined
  const { si, head, fromNeck, wall } = volume
  return {
    key: 'volume',
    label: i18n._({
      id: 'cartridgeDesigner.caseVolumeApproximate',
      message: 'Case volume (approximate)',
    }),
    quantity: 'capacity',
    si,
    basis: i18n._({
      id: 'cartridgeDesigner.cartridgeOutlineLessWall',
      message:
        'the cartridge outline less a wall of {wall} everywhere, from the head end (E, else R) at {head, decimal} mm to the mouth; cartridge maxima, not a measured capacity',
      values: {
        wall: fromNeck
          ? i18n._({
              id: 'cartridgeDesigner.wallFromG1',
              message: '(H2 - G1) / 2 = {wall, decimal} mm',
              values: { wall: Number(wall.toFixed(3)) },
            })
          : i18n._({ id: 'cartridgeDesigner.wallAssumed', message: '0.3 mm (assumed, no G1)' }),
        head,
      },
    }),
  }
}

/** Stored values in mm and degrees, SI out. */
function derive(figure: Figure, values: SpecValue[], i18n: I18n): Derived[] {
  const volume = approximateCaseVolume(figure, values, i18n)
  return [...derivedAngles(figure, values, i18n), ...(volume ? [volume] : [])]
}

/** The name a design is saved under: the name typed, else its base's title, else `fallback`. */
export const designFileName = (d: Pick<Design, 'name' | 'origin'>, fallback = 'Cartridge design') =>
  d.name?.trim() || d.origin?.title || fallback
