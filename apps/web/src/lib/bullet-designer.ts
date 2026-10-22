import {
  type BulletDimensions,
  type BulletModel,
  type BulletProfile,
  bulletFigureModel,
  bulletProfile,
  bulletScreenEm,
} from '@openreloading/drawing/bullet'
import type { BulletDesign } from '@openreloading/schema'
import type { BulletRecord } from './api-types.ts'
import { computedBulletRows } from './bullet.ts'
import {
  close,
  type FieldSpec,
  type Fields,
  type FieldValue,
  fieldError,
  fieldOf,
  storedToSi,
} from './field-spec.ts'
import { designReduce, editHistory, type History as H, historyOf, pushHistory } from './history.ts'
import { type ManufacturerNames, noManufacturerNames, productLabel } from './manufacturers.ts'
import type { FieldRow } from './record-fields.ts'
import { drawingLengthUnit, kilogramsPerGrain, metersPerInch, type UnitSystem } from './units.ts'

/** The field groups of the designer, in order. */
export const groups = {
  identity: 'Identity',
  size: 'Mass, diameter and length',
  nose: 'Nose',
  shank: 'Shank',
  base: 'Base',
  tip: 'Tip',
} as const

export type Group = keyof typeof groups

/** A number field of the designer; `key` is the record path. */
export interface DesignerSpec extends FieldSpec {
  group: Group
}

const len = (key: string, label: string, group: Group): DesignerSpec => ({
  key,
  label,
  quantity: 'length',
  group,
  min: 0,
})

export const designerSpecs: DesignerSpec[] = [
  { ...len('diameter', 'Diameter', 'size'), required: true },
  { key: 'mass', label: 'Mass', quantity: 'mass', group: 'size', min: 0 },
  len('length', 'Length', 'size'),
  len('noseLength', 'Nose length', 'nose'),
  len('ogive.radius', 'Ogive radius', 'nose'),
  {
    key: 'ogive.radiusRatio',
    label: 'Ogive Rt/R',
    quantity: 'ratio',
    group: 'nose',
    min: 0,
    max: 1,
  },
  len('meplatDiameter', 'Meplat diameter', 'nose'),
  len('bearingLength', 'Bearing length', 'shank'),
  len('baseToOgive', 'Base to ogive', 'shank'),
  len('cannelure.start', 'Cannelure start', 'shank'),
  len('cannelure.width', 'Cannelure width', 'shank'),
  len('cannelure.depth', 'Cannelure depth', 'shank'),
  len('base.length', 'Boat-tail length', 'base'),
  len('base.diameter', 'Base diameter', 'base'),
  {
    key: 'base.angle',
    label: 'Boat-tail angle',
    quantity: 'angle',
    group: 'base',
    min: 0,
    max: 90,
  },
  len('tip.length', 'Polymer tip length', 'tip'),
  len('tip.mouthDiameter', 'Hollow-point mouth diameter', 'tip'),
]

/** The choices, keyed by record path, with their options ('' for not given). */
export const choiceOptions = {
  'base.type': ['flat', 'boat-tail', 'rebated-boat-tail'],
  'ogive.form': ['tangent', 'secant', 'hybrid', 'round-nose', 'flat-nose'],
  'tip.type': ['hollow-point', 'polymer-tip', 'soft-point', 'full-metal-jacket', 'open-meplat'],
} as const

export type ChoiceKey = keyof typeof choiceOptions
export type Choices = Record<ChoiceKey, string>

const noChoices: Choices = { 'base.type': '', 'ogive.form': '', 'tip.type': '' }

/** The catalogue record a design started from: SI values and choices. */
export interface Origin {
  id: string
  title: string
  manufacturerName: string
  name: string
  si: Record<string, number | undefined>
  choices: Choices
}

export interface Design {
  manufacturerName: string
  name: string
  choices: Choices
  fields: Fields
  origin?: Origin
  /** The catalogue record the design started from, kept through files. */
  parent?: BulletDesign['parent']
}

const factor = (s: FieldSpec) => storedToSi[s.quantity as keyof typeof storedToSi]

/** A value of `o` by its dot path. */
const at = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown> | undefined)?.[k], o)

/** Whether a field is in use: it has a value, or it applies to the chosen base, nose form and tip. */
export function fieldInUse(
  key: string,
  { choices: c, fields, origin }: Pick<Design, 'choices' | 'fields' | 'origin'>,
) {
  // a value, or one in the catalogue record, keeps the field while it is cleared
  if (fields[key]?.text.trim() || origin?.si[key] !== undefined) return true
  const tail = c['base.type'] === 'boat-tail' || c['base.type'] === 'rebated-boat-tail'
  if (key.startsWith('base.')) return tail
  if (key.startsWith('ogive.'))
    return c['ogive.form'] !== 'round-nose' && c['ogive.form'] !== 'flat-nose'
  if (key === 'tip.length') return c['tip.type'] === 'polymer-tip'
  if (key === 'tip.mouthDiameter') return c['tip.type'] === 'hollow-point'
  return true
}

/**
 * The design of a catalogue record, every stored value from the catalogue; the manufacturer's name
 * from `names`.
 */
export function fromRecord(
  r: BulletRecord,
  system: UnitSystem,
  names: ManufacturerNames = noManufacturerNames,
): Design {
  const si: Origin['si'] = {}
  for (const s of designerSpecs) {
    const q = at(r, s.key) as { value: number } | undefined
    si[s.key] = q && q.value * factor(s)
  }
  const choices: Choices = {
    'base.type': r.base?.type ?? '',
    'ogive.form': r.ogive?.form ?? '',
    'tip.type': r.tip?.type ?? '',
  }
  const origin: Origin = {
    id: r.id,
    title: productLabel(r, names),
    manufacturerName: names.get(r.manufacturer) ?? '',
    name: r.name,
    si,
    choices,
  }
  return fromOrigin(origin, system)
}

/** The design of an origin as stored, as on a reset. */
function fromOrigin(origin: Origin, system: UnitSystem): Design {
  return {
    manufacturerName: origin.manufacturerName,
    name: origin.name,
    choices: { ...origin.choices },
    fields: Object.fromEntries(
      designerSpecs.map((s) => [s.key, fieldOf(system, s, origin.si[s.key])]),
    ),
    origin,
    parent: { id: origin.id, title: origin.title },
  }
}

/** The design of a saved file: its values as entered, no catalogue record. */
export function fromFile(d: BulletDesign, system: UnitSystem): Design {
  return {
    manufacturerName: d.manufacturerName,
    name: d.name,
    choices: { ...noChoices, ...d.choices },
    fields: Object.fromEntries(
      designerSpecs.map((s) => [s.key, fieldOf(system, s, d.siValues[s.key])]),
    ),
    parent: d.parent,
  }
}

/** The file data of a design: every SI value given. */
export const fileData = ({
  manufacturerName,
  name,
  choices,
  fields,
  parent,
}: Design): BulletDesign => ({
  manufacturerName,
  name,
  choices,
  siValues: Object.fromEntries(
    Object.entries(fields).flatMap(([k, f]) => (f.si === undefined ? [] : [[k, f.si]])),
  ),
  ...(parent && { parent }),
})

/** A saved design as the shape the seating preview seats (mm), as the designer draws it; undefined without a length or drawing. */
export function designShape(d: BulletDesign, system: UnitSystem): BulletDimensions | undefined {
  if (d.siValues.length === undefined) return
  return evaluate(fromFile(d, system), system).drawing?.shape
}

/** Start values of a new bullet: .308 in (7.8232 mm), 168 gr. */
const newBulletStart = { diameter: 0.308 * metersPerInch, mass: 168 * kilogramsPerGrain }

/** A new bullet: the caliber and mass of `from` (else the start values), every other field empty. */
export function newDesign(system: UnitSystem, from?: Design): Design {
  return {
    manufacturerName: '',
    name: '',
    choices: { ...noChoices },
    fields: Object.fromEntries(
      designerSpecs.map((s) => [
        s.key,
        s.key === 'diameter' || s.key === 'mass'
          ? (from?.fields[s.key] ?? fieldOf(system, s, newBulletStart[s.key]))
          : { text: '', si: undefined },
      ]),
    ),
  }
}

export type History = H<Design>
export { historyOf } from './history.ts'

export type Action =
  | { type: 'field'; key: string; value: FieldValue }
  | { type: 'text'; key: 'manufacturerName' | 'name'; value: string }
  | { type: 'choice'; key: ChoiceKey; value: string }
  | { type: 'start'; design: Design }
  | { type: 'new'; system: UnitSystem }
  | { type: 'reset'; system: UnitSystem }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'units'; system: UnitSystem }

export function reduce(h: History, a: Action): History {
  switch (a.type) {
    case 'text':
      return editHistory(h, { ...h.present, [a.key]: a.value }, a.key)
    case 'choice':
      // one step per choice; the choice is the field edited last, where a refusal naming it shows
      return pushHistory(
        h,
        { ...h.present, choices: { ...h.present.choices, [a.key]: a.value } },
        a.key,
      )
    case 'new':
      return historyOf(newDesign(a.system, h.present))
    default:
      return designReduce(h, a, designerSpecs, fromOrigin)
  }
}

/**
 * Where a field's value comes from: the catalogue record, entered (`changed` when the record has
 * another value or none), or, for an empty field, derived or assumed by the drawing.
 */
export type FieldState =
  | { kind: 'record' }
  | { kind: 'entered'; changed: boolean; record?: number }
  | { kind: 'derived' | 'assumed'; si: number; basis?: string }
  | { kind: 'empty' }

export interface Drawing {
  profile: BulletProfile
  screen: BulletModel
  /** The shape drawn, mm and degrees, with derived values filled. */
  shape: BulletDimensions
  /** Field paths the drawing dimensions. */
  given: string[]
}

interface Evaluation {
  drawing?: Drawing
  /** Why there is no drawing for this input, and the field to show it at. */
  refusal?: { reason: string; field: string }
  states: Record<string, FieldState>
  /** The computed rows of a bullet page (sectional density, Miller twist with a given length); none without a mass and diameter. */
  computed: FieldRow[]
}

/** Assumed length without one: 4 diameters, a stated proportion. */
const assumedLengthDiameters = 4

/** The meplat share of d the outline assumes for a nose form and tip (`bulletOutline`). */
const meplatShare = (c: Choices) =>
  c['ogive.form'] === 'flat-nose'
    ? 0.6
    : ['hollow-point', 'open-meplat', 'soft-point'].includes(c['tip.type'])
      ? 0.15
      : 0

/** Given field values in stored units (mm, g, degrees), keyed like `designerSpecs`. */
type StoredValues = Record<string, number | undefined>

/** The given values in stored units (mm, g, degrees) and the state of each field. */
function fieldStates({ fields, origin }: Design): {
  v: StoredValues
  states: Evaluation['states']
} {
  const states: Evaluation['states'] = {}
  const v: StoredValues = {}
  for (const s of designerSpecs) {
    const si = fields[s.key]?.si
    // 12 significant digits drop the noise of the SI round trip (7.823e-3 / 1e-3)
    v[s.key] = si === undefined ? undefined : Number((si / factor(s)).toPrecision(12))
    if (si === undefined) states[s.key] = { kind: 'empty' }
    else if (origin && close(si, origin.si[s.key])) states[s.key] = { kind: 'record' }
    else
      states[s.key] = {
        kind: 'entered',
        changed: origin !== undefined,
        record: origin?.si[s.key],
      }
  }
  return { v, states }
}

/** The first refusal of invalid field text (`last` first) or a half-given cannelure; none when valid. */
function validateInputs(
  design: Design,
  v: StoredValues,
  system: UnitSystem,
  last: string | undefined,
): Evaluation['refusal'] {
  // the mass is not drawn: its error shows at the field only
  const invalid = designerSpecs
    .map((s) => [s.key, fieldError(s, design.fields[s.key], system)] as const)
    .filter(([k, e]) => e !== undefined && k !== 'mass')
  const bad = invalid.find(([k]) => k === last) ?? invalid[0]
  if (bad) return { reason: bad[1] as string, field: bad[0] }
  const startOnly = v['cannelure.start'] !== undefined && v['cannelure.width'] === undefined
  const widthOnly = v['cannelure.width'] !== undefined && v['cannelure.start'] === undefined
  if (startOnly || widthOnly)
    return {
      reason: 'A cannelure needs a start and a width.',
      field: startOnly ? 'cannelure.width' : 'cannelure.start',
    }
}

/**
 * The length (assumed as `assumedLengthDiameters` diameters without one) and the nose length (from
 * the ogive radius when not given), stored units.
 */
function completeShape(v: StoredValues, choices: Choices) {
  const d = v.diameter as number
  const form = choices['ogive.form']
  const round = form === 'round-nose' || form === 'flat-nose'
  const radius = v['ogive.radius']
  const ratio = v['ogive.radiusRatio']
  const assumedLength = v.length === undefined ? `${assumedLengthDiameters} d` : undefined
  const L = v.length ?? assumedLengthDiameters * d
  let n = v.noseLength
  let noseFromRadius = false
  if (n === undefined && radius !== undefined && radius > 0 && !round) {
    // the nose length whose tangent radius rt = (n² + k²) / 2k is Rt/R × R
    const q = ratio ?? (form === 'secant' || form === 'hybrid' ? undefined : 1)
    const m = (v.meplatDiameter ?? meplatShare(choices) * d) / 2
    const k = d / 2 - m
    const n2 = q === undefined ? -1 : 2 * q * radius * k - k ** 2
    if (k > 0 && n2 > 0) {
      n = Math.sqrt(n2)
      noseFromRadius = true
    }
  }
  return { L, assumedLength, n, noseFromRadius }
}

/** The bullet shape of the given values, mm and degrees, with length `L` and nose length `n`. */
function shapeFromValues(
  v: StoredValues,
  choices: Choices,
  L: number,
  n: number | undefined,
): BulletDimensions {
  const form = choices['ogive.form']
  const radius = v['ogive.radius']
  const ratio = v['ogive.radiusRatio']
  const tipType = choices['tip.type']
  return {
    diameter: v.diameter as number,
    length: L,
    ...(n !== undefined && { noseLength: n }),
    ...(v.baseToOgive !== undefined && { baseToOgive: v.baseToOgive }),
    ...(v.bearingLength !== undefined && { bearingLength: v.bearingLength }),
    ...(v.meplatDiameter !== undefined && { meplatDiameter: v.meplatDiameter }),
    base: {
      ...(choices['base.type'] && {
        type: choices['base.type'] as NonNullable<BulletDimensions['base']>['type'],
      }),
      ...(v['base.length'] !== undefined && { length: v['base.length'] }),
      ...(v['base.diameter'] !== undefined && { diameter: v['base.diameter'] }),
      ...(v['base.angle'] !== undefined && { angle: v['base.angle'] }),
    },
    ogive: {
      ...(form && { form }),
      ...(radius !== undefined && { radius }),
      ...(ratio !== undefined && { radiusRatio: ratio }),
    },
    ...(tipType && {
      tip: {
        type: tipType,
        ...(v['tip.length'] !== undefined && { length: v['tip.length'] }),
        ...(v['tip.mouthDiameter'] !== undefined && { mouthDiameter: v['tip.mouthDiameter'] }),
      },
    }),
    ...(v['cannelure.start'] !== undefined && {
      cannelure: {
        start: v['cannelure.start'],
        width: v['cannelure.width'] as number,
        ...(v['cannelure.depth'] !== undefined && { depth: v['cannelure.depth'] }),
      },
    }),
  }
}

/**
 * Values the drawing derived or assumed for each field, stored units, with the basis of an
 * assumption where one is stated.
 */
function derivedFills(
  o: BulletProfile['outline'],
  v: StoredValues,
  choices: Choices,
  { L, assumedLength, noseFromRadius }: ReturnType<typeof completeShape>,
): Record<string, [number, 'derived' | 'assumed', string?]> {
  const d = v.diameter as number
  const form = choices['ogive.form']
  const round = form === 'round-nose' || form === 'flat-nose'
  const radius = v['ogive.radius']
  const ratio = v['ogive.radiusRatio']
  const tag = (i: number) => (o.tags[i] === 'approximate' ? 'assumed' : 'derived')
  // a boat tail starts at a base edge inside the shank radius; its top is the next point
  const tail = o.points[1][0] < d / 2 - 1e-12
  const t = tail ? o.points[2][1] : 0
  const baseAssumed = o.approximate.some(([z]) => z === 0)
  const tipIndex = o.points.findIndex(([, z]) => z === L)
  const m = o.points[tipIndex][0]
  const k = d / 2 - m
  const rt = (o.noseLength ** 2 + k ** 2) / (2 * k)
  const q = ratio ?? (radius ? rt / radius : form === 'secant' || form === 'hybrid' ? 0.5 : 1)
  const noseShapeAssumed =
    o.noseAssumed || (ratio === undefined && radius === undefined && form !== 'tangent')
  const fill: Record<string, [number, 'derived' | 'assumed', string?]> = {
    length: [L, 'assumed', assumedLength],
    noseLength: [o.noseLength, noseFromRadius ? 'derived' : o.noseAssumed ? 'assumed' : 'derived'],
    bearingLength: [o.bearingLength, o.noseAssumed || baseAssumed ? 'assumed' : 'derived'],
    meplatDiameter: [2 * m, tag(tipIndex)],
  }
  if (tail) {
    const tagT = tag(2)
    const tagB = tag(1)
    fill['base.length'] = [t, tagT]
    fill['base.diameter'] = [2 * o.points[1][0], tagB]
    const top = o.points[2]
    fill['base.angle'] = [
      (Math.atan((top[0] - o.points[1][0]) / t) * 180) / Math.PI,
      tagT === 'assumed' || tagB === 'assumed' ? 'assumed' : 'derived',
    ]
  }
  if (!round && k > 0 && q > 0) {
    fill['ogive.radius'] = [rt / q, noseShapeAssumed ? 'assumed' : 'derived']
    fill['ogive.radiusRatio'] = [q, noseShapeAssumed ? 'assumed' : 'derived']
  }
  if (o.tipStart !== undefined) fill['tip.length'] = [L - o.tipStart, 'assumed']
  if (choices['tip.type'] === 'hollow-point') {
    const mouth = o.points.filter(([, z]) => z === L).map(([r]) => r)
    fill['tip.mouthDiameter'] = [2 * Math.min(...mouth.filter((r) => r > 0), m), 'assumed']
  }
  if (v['cannelure.start'] !== undefined && v['cannelure.depth'] === undefined)
    fill['cannelure.depth'] = [0.02 * d, 'assumed', '0.02 d']
  return fill
}

/**
 * The drawing, the field states and the computed values of a design. `last` is the field edited
 * last: a refusal naming it shows there. Invalid field text and refused dimensions give no drawing,
 * so the page keeps its last one.
 */
export function evaluate(design: Design, system: UnitSystem, last?: string): Evaluation {
  const { choices } = design
  const { v, states } = fieldStates(design)
  const sdOk = v.mass !== undefined && v.diameter !== undefined && v.diameter > 0
  const computed = sdOk
    ? computedBulletRows({
        mass: { value: v.mass as number },
        diameter: { value: v.diameter as number },
        ...(v.length !== undefined && v.length > 0 && { length: { value: v.length } }),
        ...(choices['tip.type'] && { tip: { type: choices['tip.type'] } }),
      })
    : []
  const done = (refusal: Evaluation['refusal']): Evaluation => ({ refusal, states, computed })

  const refusal = validateInputs(design, v, system, last)
  if (refusal) return done(refusal)

  const completed = completeShape(v, choices)
  const shape = shapeFromValues(v, choices, completed.L, completed.n)
  const given = designerSpecs.map((s) => s.key).filter((k) => v[k] !== undefined)
  const p = bulletProfile(shape, (f) => given.includes(f), 'entered')
  if ('reason' in p) {
    const field =
      p.fields.find((f) => f === last) ??
      p.fields.find((f) => v[f] !== undefined || f in choices) ??
      p.fields[0]
    return done({ reason: p.reason, field })
  }

  // values the drawing derived or assumed for empty fields in use, stored units
  const fill = derivedFills(p.outline, v, choices, completed)
  for (const s of designerSpecs) {
    const f = fill[s.key]
    if (v[s.key] === undefined && f && fieldInUse(s.key, design) && Number.isFinite(f[0]))
      states[s.key] = { kind: f[1], si: f[0] * factor(s), ...(f[2] && { basis: f[2] }) }
  }

  const unit = drawingLengthUnit(system)
  const em = bulletScreenEm(p, unit)
  return {
    drawing: {
      profile: p,
      screen: bulletFigureModel(p, 'screen', em, 0, unit),
      shape,
      given,
    },
    states,
    computed,
  }
}

/**
 * Slider range of a field, SI: fixed for the diameter and mass, else in diameters (rounded up to
 * whole mm), so the ranges hold still while the length or the diameter is typed.
 */
export function sliderMax(key: string, design: Design): number {
  // the diameter rounded up to whole mm, so the ranges also hold while the diameter is typed
  const d = Math.ceil((design.fields.diameter?.si ?? newBulletStart.diameter) * 1e3) * 1e-3
  const max: Record<string, number> = {
    diameter: 20e-3,
    mass: 60e-3,
    length: 8 * d,
    'ogive.radius': 25 * d,
    'ogive.radiusRatio': 1,
    meplatDiameter: d,
    'base.diameter': d,
    'tip.mouthDiameter': d,
    'base.angle': (30 * Math.PI) / 180,
    'cannelure.width': d,
    'cannelure.depth': d / 10,
  }
  // lengths along the axis: up to the length range
  return Math.max(max[key] ?? 8 * d, design.fields[key]?.si ?? 0)
}
