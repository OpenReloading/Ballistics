import { checkSpec } from '@openreloading/data/plausibility'
import {
  drawnTables,
  type Figure,
  figureModel,
  recordFigures,
  regions,
  type Side,
  screenEm,
  screenWidth,
  sideName,
  storedValue,
} from '@openreloading/drawing/cartridge'
import { chamberOf } from '@openreloading/drawing/seating'
import {
  type CartridgeOverrides,
  type SpecValue,
  toSi,
  type UserCartridge,
} from '@openreloading/schema'
import type { CartridgeDetail } from './api-types.ts'
import { drawable } from './cartridge-sheet.ts'
import {
  close,
  type FieldSpec,
  type Fields,
  type FieldValue,
  fieldError,
  fieldOf,
  siToStored,
  storedToSi,
} from './field-spec.ts'
import { designReduce, type History as H, historyOf, pushHistory } from './history.ts'
import { exactFieldText, type UnitSystem } from './units.ts'
import type { ResolvedCartridge } from './variants.ts'

/** The field groups of the designer, in order. */
export const groups = {
  head: 'Head, rim and groove',
  body: 'Body',
  shoulder: 'Shoulder',
  neck: 'Neck and length',
  throat: 'Throat and leade',
} as const

export type Group = keyof typeof groups

const both: Side[] = ['cartridge', 'chamber']
const cartridge: Side[] = ['cartridge']
const chamber: Side[] = ['chamber']

/**
 * The CIP symbols the outline reads (`cipProfile` of `@openreloading/drawing/cartridge`), outside
 * table VII: meaning, sides, group and the end of the slider range in mm or degrees.
 */
const symbols: [string, string, Side[], Group, number, 'length' | 'angle'][] = [
  ['R1', 'rim diameter at the head', both, 'head', 35, 'length'],
  ['R', 'rim thickness', both, 'head', 10, 'length'],
  [
    'E',
    'head to the start of P1; in the chamber the depth of the rim recess',
    both,
    'head',
    10,
    'length',
  ],
  ['E1', 'extractor groove diameter', cartridge, 'head', 35, 'length'],
  ['e', 'extractor groove width at E1', cartridge, 'head', 10, 'length'],
  [
    'delta',
    'groove front cone angle from the axis (table III: belt cone)',
    cartridge,
    'head',
    90,
    'angle',
  ],
  ['R3', 'belt diameter (table III)', both, 'head', 35, 'length'],
  ['f', 'rim chamfer length along the axis', cartridge, 'head', 10, 'length'],
  ['beta', 'rim chamfer angle from the head face', cartridge, 'head', 90, 'angle'],
  ['r0', 'radius of the rim corner at the head face', cartridge, 'head', 10, 'length'],
  ['P1', 'body diameter at E', both, 'body', 35, 'length'],
  ['P0', 'body diameter at L0 (double taper)', both, 'body', 35, 'length'],
  ['L0', 'head to P0', both, 'body', 200, 'length'],
  ['P2', 'shoulder diameter at L1', both, 'shoulder', 35, 'length'],
  ['L1', 'head to the shoulder start (P2)', both, 'shoulder', 200, 'length'],
  ['L2', 'head to the neck start (H1)', both, 'shoulder', 200, 'length'],
  ['H1', 'neck diameter at L2', both, 'shoulder', 35, 'length'],
  ['alpha', 'included shoulder angle', both, 'shoulder', 180, 'angle'],
  ['S', 'head to where the shoulder cone meets the axis', both, 'shoulder', 200, 'length'],
  ['r1', 'radius at the shoulder start', both, 'shoulder', 30, 'length'],
  ['r2', 'radius at the neck start', both, 'shoulder', 30, 'length'],
  ['H2', 'neck diameter at the mouth', both, 'neck', 35, 'length'],
  ['L3', 'case length', both, 'neck', 200, 'length'],
  ['L6', 'cartridge length', cartridge, 'neck', 200, 'length'],
  ['G1', 'bullet diameter', cartridge, 'neck', 35, 'length'],
  ['G1', 'throat diameter', chamber, 'throat', 35, 'length'],
  ['h', 'length of the cone from H2 down to G1, from L3', chamber, 'throat', 10, 'length'],
  ['alpha1', 'included angle of the h cone', chamber, 'throat', 180, 'angle'],
  ['s', 'L3 to the leade start (freebore)', chamber, 'throat', 50, 'length'],
  ['i', 'leade angle', chamber, 'throat', 90, 'angle'],
  ['G', 'L3 to the end of the leade', chamber, 'throat', 50, 'length'],
  ['F', 'bore diameter', chamber, 'throat', 35, 'length'],
]

/** A number field of the designer; `key` is `<side>.<symbol>`. */
export interface CartridgeFieldSpec extends FieldSpec {
  side: Side
  symbol: string
  meaning: string
  group: Group
  /** End of the slider range, SI. */
  range: number
  /** Largest length accepted, SI: the layout time grows with the size of the drawing. */
  limit?: number
}

export const fieldSpecs: CartridgeFieldSpec[] = symbols.flatMap(
  ([symbol, meaning, sides, group, range, q]) =>
    sides.map((side) => ({
      key: `${side}.${symbol}`,
      label: `${sideName[side]} ${symbol}`,
      quantity: q,
      min: 0,
      ...(q === 'angle'
        ? { max: 180 }
        : { limit: range === 35 ? 50e-3 : storedToSi(q, 2.5 * range) }),
      side,
      symbol,
      meaning,
      group,
      range: storedToSi(q, range),
    })),
)

const specOf = new Map(fieldSpecs.map((s) => [s.key, s]))

/** The symbols every side needs to draw (`cipProfile`). */
const baseSymbols = ['R1', 'R', 'P1', 'L3', 'H2']

/** The record a design started from: its values and their SI values by field key. */
export interface Origin {
  id: string
  title: string
  table?: string
  values: SpecValue[]
  si: Record<string, number | undefined>
}

export interface Design {
  /** The CIP table whose drawing rules apply (table III: belt). */
  table: string
  fields: Fields
  origin?: Origin
  /** The catalogue cartridge the design is based on, `catalogue:<id>`, kept through files. */
  basedOn?: string
  /** Why the design is read only (its base is not there), with the record as stored, which Save keeps as it is. */
  locked?: { reason: string; data: UserCartridge }
}

const keyOf = (v: SpecValue) => (v.side && !v.variant ? `${v.side}.${v.symbol}` : undefined)
const empty: FieldValue = { text: '', si: undefined }

/** Whether the record draws at least one figure. */
export const draws = (c: CartridgeDetail) =>
  recordFigures(drawable(c)).some((f) => f.drawn.length > 0)

/** The design of a cartridge record, every value from the record. */
export function fromRecord(c: CartridgeDetail, system: UnitSystem): Design {
  return fromOrigin(originOf(c), system)
}

/** The SI value of each field a list of values gives. */
function siOf(values: readonly SpecValue[]): Origin['si'] {
  const si: Origin['si'] = {}
  for (const v of values) {
    const key = keyOf(v)
    const s = key && specOf.get(key)
    if (s && v.value !== undefined)
      si[s.key] = storedToSi(s.quantity as 'length' | 'angle', v.value)
  }
  return si
}

/** The origin a design is measured against: a cartridge record's values. */
const originOf = (c: Pick<CartridgeDetail, 'id' | 'name' | 'table' | 'values'>): Origin => ({
  id: c.id,
  title: `CIP ${c.name}`,
  table: c.table,
  values: c.values,
  si: siOf(c.values),
})

/**
 * The design of a saved user cartridge: the resolved values, measured against its base (the
 * origin) so each field says whether it follows the record or is changed. A base that is not there
 * gives a read only design that Save leaves as stored.
 */
export function fromUser(
  data: UserCartridge,
  { base, record, problem }: ResolvedCartridge,
  system: UnitSystem,
): Design {
  const si = siOf(record.values)
  const origin = base.status === 'found' ? originOf(base.record) : undefined
  return {
    table: record.table ?? 'I',
    fields: Object.fromEntries(fieldSpecs.map((s) => [s.key, fieldOf(system, s, si[s.key])])),
    ...(origin && { origin }),
    ...(data.basedOn && { basedOn: data.basedOn }),
    ...(problem && { locked: { reason: problem, data } }),
  }
}

/**
 * The user cartridge a design saves: its base and the overrides, the table where it differs and the
 * values that differ from the base (a value cleared against the base is one with `null`). Without
 * a base the table and every given value. A read only design gives its stored data back.
 */
export function fileData(design: Design): UserCartridge {
  if (design.locked) return design.locked.data
  const { origin, basedOn, table } = design
  const overrides: CartridgeOverrides = {}
  if (!origin || table !== origin.table) overrides.table = table
  const values = valueOverrides(design)
  if (values.length > 0) overrides.values = values
  return {
    origin: 'user',
    ...(basedOn && { basedOn }),
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

/** A field value in stored units (mm, degrees); 12 significant digits drop the SI round-trip noise. */
const storedFieldValue = (s: CartridgeFieldSpec, si: number) =>
  Number(siToStored(s.quantity as 'length' | 'angle', si).toPrecision(12))

/**
 * The values of a design: a value still equal to the record's is the record's own object (printed
 * text, tolerance, limit), a changed one carries the entered value only, a cleared one is left
 * out; values with a variant or without a field stay, values without a side (pressures) go.
 */
function draftValues({ fields, origin }: Design): SpecValue[] {
  const out: SpecValue[] = []
  const seen = new Set<string>()
  const entered = (s: CartridgeFieldSpec, si: number): SpecValue => ({
    side: s.side,
    symbol: s.symbol,
    quantity: s.quantity as 'length' | 'angle',
    value: storedFieldValue(s, si),
  })
  for (const v of origin?.values ?? []) {
    if (!v.side) continue
    const key = keyOf(v)
    const s = key && specOf.get(key)
    if (!s) {
      out.push(v)
      continue
    }
    seen.add(s.key)
    const si = fields[s.key]?.si
    if (si === undefined) {
      if (origin?.si[s.key] === undefined) out.push(v)
    } else out.push(close(si, origin?.si[s.key]) ? v : entered(s, si))
  }
  for (const s of fieldSpecs) {
    const si = fields[s.key]?.si
    if (!seen.has(s.key) && si !== undefined) out.push(entered(s, si))
  }
  return out
}

/**
 * The values a design overrides: a field entered where the base has another value or none, and a
 * field cleared against a base value as the entry with `null`. A value the design left out of its
 * fields (a variant, a pressure) is the base's and not listed.
 */
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

/** The spec the drawing reads: a CIP-shaped record with the design's table and values. */
export const draftSpec = (design: Design) => ({
  id: 'designer',
  standard: 'CIP',
  name: 'design',
  table: design.table,
  values: draftValues(design),
})

type DraftSpec = ReturnType<typeof draftSpec>

/** The tables a design may take: the ones the outline draws, table VII only for its own records. */
export const tables = [...drawnTables]

export type Action =
  | { type: 'field'; key: string; value: FieldValue }
  | { type: 'table'; value: string }
  | { type: 'start'; design: Design }
  | { type: 'new' }
  | { type: 'reset'; system: UnitSystem }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'units'; system: UnitSystem }

export type History = H<Design>
export { historyOf } from './history.ts'

export function reduce(h: History, a: Action): History {
  switch (a.type) {
    case 'table':
      return pushHistory(h, { ...h.present, table: a.value })
    case 'new':
      return historyOf(newDesign(h.present))
    default:
      return designReduce(h, a, fieldSpecs, fromOrigin)
  }
}

/**
 * Where a field's value comes from: the record, entered (`changed` against the record, with its
 * value), cleared against the record, derived by the drawing, not printed in the record, or not given.
 */
export type FieldState =
  | { kind: 'record' }
  | { kind: 'entered'; changed: boolean; record?: number }
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
  refusal?: { reason: string; field: string }
  states: Record<string, FieldState>
  /** CIP plausibility findings by field key, shown as the field's error. */
  checks: Record<string, string[]>
  /** Outline notes by field key, shown in the field's help: a note does not make a value invalid. */
  notes: Record<string, string[]>
  derived: Derived[]
}

export const missingHint =
  'Enter at least R1, R, P1, L3 and H2 of the cartridge or the chamber to draw.'

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
): Evaluation['refusal'] {
  const tooLarge = (s: CartridgeFieldSpec) => {
    const si = fields[s.key]?.si
    if (s.limit === undefined || si === undefined || si <= s.limit) return
    return `${s.label} must be at most ${exactFieldText(s.quantity, system, s.limit)} ${system[s.quantity].symbol} in the designer.`
  }
  const invalid = fieldSpecs
    .map((s) => [s.key, fieldError(s, fields[s.key], system) ?? tooLarge(s)] as const)
    .filter(([, e]) => e !== undefined)
  const bad = invalid.find(([k]) => k === last) ?? invalid[0]
  if (bad) return { reason: bad[1] as string, field: bad[0] }
}

/**
 * The figures of `spec` and those with a drawn side, or the refusal when the page's screen layout
 * cannot lay them out or no side draws.
 */
function refuseUnlayable(
  spec: DraftSpec,
  { fields }: Design,
  last: string | undefined,
): { list: Figure[]; shown: Figure[] } | { refusal: NonNullable<Evaluation['refusal']> } {
  let list: Figure[]
  let shown: Figure[]
  try {
    list = recordFigures(spec)
    shown = list.filter((f) => f.drawn.length)
    if (shown.length) {
      // the screen layout of the page (without its detail letters), so a design it cannot lay out is refused here
      const em = screenEm(shown.map((f) => f.drawn))
      const across = Math.max(...shown.map((f) => screenWidth(f.drawn, em)))
      for (const f of shown) {
        const m = figureModel(
          f.drawn,
          'screen',
          em,
          across,
          f.drawn.length === 2 ? regions(spec.values) : [],
        )
        const finite = [...m.frame, ...f.drawn.flatMap(({ p }) => p.points.flat())].every(
          Number.isFinite,
        )
        if (!finite) throw new Error('not finite')
      }
    }
  } catch {
    return {
      refusal: {
        reason: 'These dimensions do not form an outline.',
        field: last ?? fieldSpecs[0].key,
      },
    }
  }
  if (!shown.length) {
    const notes = list.flatMap((f) => f.notes)
    const missing = notes.filter((n) => n.code === 'missing').map((n) => n.text)
    const keys = both.flatMap((side) =>
      baseSymbols.map((symbol) => `${side}.${symbol}`).filter((k) => fields[k]?.si === undefined),
    )
    return {
      refusal: {
        reason: [...missing, missingHint].join(' '),
        field: keys.find((k) => k === last) ?? keys[0] ?? fieldSpecs[0].key,
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

/**
 * The drawing, field states, checks and derived values of a design. `last` is the field edited
 * last: a refusal naming it shows there. Invalid field text and designs no side draws give no
 * drawing, so the page keeps its last one.
 */
export function evaluate(design: Design, system: UnitSystem, last?: string): Evaluation {
  const states = fieldStates(design)
  const done = (refusal: Evaluation['refusal']): Evaluation => ({
    refusal,
    states,
    checks: {},
    notes: {},
    derived: [],
  })

  const invalid = refuseInvalid(design, system, last)
  if (invalid) return done(invalid)

  const spec = draftSpec(design)
  const laid = refuseUnlayable(spec, design, last)
  if ('refusal' in laid) return done(laid.refusal)
  const { list, shown } = laid

  const checks = plausibilityChecks(spec)
  const notes = outlineNotes(shown)
  const derived = design.table === 'VII' ? [] : derive(shown[0], spec.values)
  for (const { side, p } of shown[0].drawn)
    if (
      side === 'cartridge' &&
      p.derivedE !== undefined &&
      design.fields['cartridge.e']?.si === undefined
    )
      states['cartridge.e'] = { kind: 'derived', si: toSi('length', p.derivedE) }
  return { spec, figures: list, states, checks, notes, derived }
}

/** Neck length, shoulder angle and body taper of each drawn side, from stored values (mm, degrees); SI out. */
function derivedAngles(figure: Figure, values: SpecValue[]): Derived[] {
  const out: Derived[] = []
  for (const { side, p } of figure.drawn) {
    const v = (symbol: string) => storedValue(values, side, symbol)?.value
    const [L1, L2, L3, P1, P2, H1] = ['L1', 'L2', 'L3', 'P1', 'P2', 'H1'].map(v)
    const name = sideName[side]
    if (L3 !== undefined && L2 !== undefined && L3 > L2)
      out.push({
        key: `${side}.neck`,
        label: `${name} neck length`,
        basis: 'L3 - L2',
        quantity: 'length',
        si: toSi('length', L3 - L2),
      })
    if (P2 !== undefined && H1 !== undefined && L1 !== undefined && L2 !== undefined && L2 > L1)
      out.push({
        key: `${side}.shoulder`,
        label: `${name} shoulder angle`,
        basis: 'included, 2 atan((P2 - H1) / 2 / (L2 - L1))',
        quantity: 'angle',
        si: 2 * Math.atan((P2 - H1) / 2 / (L2 - L1)),
      })
    // P1 at its drawn station, after the head
    const zP1 = P1 === undefined ? undefined : p.points.find(([r]) => r === P1 / 2)?.[1]
    if (P1 !== undefined && P2 !== undefined && L1 !== undefined && zP1 !== undefined && L1 > zP1)
      out.push({
        key: `${side}.taper`,
        label: `${name} body taper`,
        basis: 'included angle from P1 at its drawn station to P2 at L1',
        quantity: 'angle',
        si: 2 * Math.atan((P1 - P2) / 2 / (L1 - zP1)),
      })
  }
  return out
}

/**
 * Case volume of the drawn cartridge, approximate: its outline less a wall from the head end to the
 * mouth, stored values (mm, degrees) in, SI out; none without a drawn cartridge.
 */
function approximateCaseVolume(figure: Figure, values: SpecValue[]): Derived | undefined {
  const c = figure.drawn.find((d) => d.side === 'cartridge')
  if (!c) return undefined
  const v = (symbol: string) => storedValue(values, 'cartridge', symbol)?.value
  const [H2, G1, L3] = ['H2', 'G1', 'L3'].map(v) as [number, number | undefined, number]
  const head = v('E') ?? v('R') ?? 0
  const fromNeck = G1 !== undefined && H2 > G1
  const wall = fromNeck ? (H2 - G1) / 2 : 0.3
  let mm3 = 0
  const pts = c.p.points
  for (let k = 1; k < pts.length; k++) {
    const [[ra, za], [rb, zb]] = [pts[k - 1], pts[k]]
    const lo = Math.max(za, head)
    const hi = Math.min(zb, L3)
    if (hi <= lo) continue
    const at = (z: number) => Math.max(0, ra + ((rb - ra) * (z - za)) / (zb - za) - wall)
    const [a, b] = [at(lo), at(hi)]
    mm3 += (Math.PI * (hi - lo) * (a * a + a * b + b * b)) / 3
  }
  return {
    key: 'volume',
    label: 'Case volume (approximate)',
    quantity: 'capacity',
    // mm3 is mm2 times mm
    si: toSi('length', toSi('area', mm3)),
    basis: `the cartridge outline less a wall of ${fromNeck ? `(H2 - G1) / 2 = ${Number(wall.toFixed(3))} mm` : '0.3 mm (assumed, no G1)'} everywhere, from the head end (E, else R) at ${head} mm to the mouth; cartridge maxima, not a measured capacity`,
  }
}

/**
 * Neck length, shoulder angle and body taper per drawn side, and the case volume of the drawn
 * cartridge, all from stored values in mm and degrees; SI out.
 */
function derive(figure: Figure, values: SpecValue[]): Derived[] {
  const volume = approximateCaseVolume(figure, values)
  return [...derivedAngles(figure, values), ...(volume ? [volume] : [])]
}

/** Slider range of a field, SI: fixed per symbol, widened by a larger value. */
export const sliderMax = (s: CartridgeFieldSpec, design: Design) =>
  Math.max(s.range, design.fields[s.key]?.si ?? 0)

/**
 * What a saved cartridge design gives the workbench: the spec its preview draws and seats in, the
 * bore diameter (chamber F) and the approximate case volume, SI, all from the design's resolved
 * values (its base with the overrides applied). Undefined where the design does not draw, is a shotshell (table
 * VII) or lacks the cartridge L3 the seating needs.
 */
export function workbenchDesign(
  d: UserCartridge,
  resolved: ResolvedCartridge,
  name: string,
  system: UnitSystem,
) {
  if (resolved.problem) return
  const design = fromUser(d, resolved, system)
  const { spec, derived } = evaluate(design, system)
  if (!spec || spec.table === 'VII' || !chamberOf(spec.values)) return
  return {
    spec,
    title: `user design ${name}`,
    boreDiameter: design.fields['chamber.F']?.si,
    caseVolume: derived.find((x) => x.key === 'volume')?.si,
  }
}
