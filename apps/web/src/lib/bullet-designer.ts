import {
  type BulletDimensions,
  type BulletModel,
  type BulletProfile,
  bulletFigureModel,
  bulletProfile,
  bulletScreenEm,
} from '@open-reloading/drawing/bullet'
import {
  type Bullet,
  baseTypes,
  fromSi,
  ogiveForms,
  tipTypes,
  type UserBullet,
} from '@open-reloading/schema'
import { untranslated } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { computedBulletRows } from './bullet.ts'
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
import { designReduce, editHistory, type History as H, historyOf, pushHistory } from './history.ts'
import { type ManufacturerNames, noManufacturerNames, productLabel } from './manufacturers.ts'
import { nth } from './nth.ts'
import type { FieldRow } from './record-fields.ts'
import { drawingLengthUnit, kilogramsPerGrain, metersPerInch, type UnitSystem } from './units.ts'
import { dropPath, type ResolvedBullet, revisionOf, setPath } from './variants.ts'

/** The field groups of the designer, in order. */
export const groups = {
  identity: msg('Identity'),
  size: msg('Mass, diameter and length'),
  nose: msg('Nose'),
  shank: msg('Shank'),
  base: msg('Base'),
  tip: msg('Tip'),
}

export type Group = keyof typeof groups

/** A number field of the designer; `key` is the record path. */
export interface DesignerSpec extends FieldSpec {
  label: Message
  group: Group
  /**
   * SI range of a plausible bullet value: outside it the field asks to check the unit, a soft
   * flag that blocks nothing (the ranges of issue #788).
   */
  plausible?: [number, number]
}

const len = (key: string, label: Message, group: Group): DesignerSpec => ({
  key,
  label,
  quantity: 'length',
  group,
  min: 0,
})

/** The SI range of `low` to `high` units of `perUnit` SI each. */
const range = (low: number, high: number, perUnit: number): [number, number] => [
  low * perUnit,
  high * perUnit,
]

export const designerSpecs: DesignerSpec[] = [
  {
    ...len('diameter', msg('Diameter'), 'size'),
    required: true,
    plausible: range(0.05, 1.5, metersPerInch),
  },
  {
    key: 'mass',
    label: msg('Mass'),
    quantity: 'mass',
    group: 'size',
    min: 0,
    positive: true,
    plausible: range(5, 1000, kilogramsPerGrain),
  },
  len('length', msg('Length'), 'size'),
  len('noseLength', msg('Nose length'), 'nose'),
  len('ogive.radius', msg('Ogive radius'), 'nose'),
  {
    key: 'ogive.radiusRatio',
    label: msg('Ogive Rt/R'),
    quantity: 'ratio',
    group: 'nose',
    min: 0,
    max: 1,
  },
  len('meplatDiameter', msg('Meplat diameter'), 'nose'),
  len('bearingLength', msg('Bearing length'), 'shank'),
  len('baseToOgive', msg('Base to ogive'), 'shank'),
  len('cannelure.start', msg('Cannelure start'), 'shank'),
  len('cannelure.width', msg('Cannelure width'), 'shank'),
  len('cannelure.depth', msg('Cannelure depth'), 'shank'),
  len('base.length', msg('Boat-tail length'), 'base'),
  len('base.diameter', msg('Base diameter'), 'base'),
  len('base.cavityDiameter', msg('Cavity diameter'), 'base'),
  len('base.cavityDepth', msg('Cavity depth'), 'base'),
  {
    key: 'base.angle',
    label: msg('Boat-tail angle'),
    quantity: 'angle',
    group: 'base',
    min: 0,
    max: 90,
  },
  len('tip.length', msg('Polymer tip length'), 'tip'),
  len('tip.mouthDiameter', msg('Hollow-point mouth diameter'), 'tip'),
]

/** Whether the SI value `si` of the field `s` is outside its plausible range: a unit to check. */
export const implausible = (s: DesignerSpec, si: number | undefined) =>
  si !== undefined && s.plausible !== undefined && (si < s.plausible[0] || si > s.plausible[1])

/** The choices, keyed by record path, with their options ('' for not given): the record schema's enums. */
export const choiceOptions = {
  'base.type': baseTypes.options,
  'ogive.form': ogiveForms.options,
  'tip.type': tipTypes.options,
} as const

export type ChoiceKey = keyof typeof choiceOptions
type Choices = Record<ChoiceKey, string>

const noChoices: Choices = { 'base.type': '', 'ogive.form': '', 'tip.type': '' }

/** The catalogue record a design started from: SI values and choices. */
interface Origin {
  id: string
  title: string
  /** The `revision` of the catalogue record, as the API answered it. */
  revision?: string | undefined
  /** The base's manufacturer, `catalogue:<id>`. */
  manufacturer: string
  name: string
  si: Record<string, number | undefined>
  choices: Choices
}

export interface Design {
  /** The manufacturer, `catalogue:<id>` or `user:<id>`; undefined while none is named. */
  manufacturer?: string | undefined
  name: string
  choices: Choices
  fields: Fields
  origin?: Origin | undefined
  /** The catalogue bullet the design is based on, `catalogue:<id>`, kept through files. */
  basedOn?: string
  /** The base changed since the design was saved: the fields not overridden follow it. */
  baseChanged?: boolean
  /** The overrides as saved: Save keeps those of a field the designer has no input for. */
  kept?: UserBullet['overrides']
  /** Why the design is read only (its base is not there), with the record as stored, which Save keeps as it is. */
  locked?: { reason: string; data: UserBullet }
}

const stored = (s: FieldSpec) => s.quantity as Parameters<typeof storedToSi>[0]

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
  const hollow =
    c['base.type'] === 'conical-hollow-base' || c['base.type'] === 'rounded-hollow-base'
  const tail = c['base.type'] === 'boat-tail' || c['base.type'] === 'rebated-boat-tail'
  if (key === 'base.cavityDiameter' || key === 'base.cavityDepth') return hollow
  if (key.startsWith('base.')) return tail || hollow
  if (key.startsWith('ogive.'))
    return c['ogive.form'] !== 'round-nose' && c['ogive.form'] !== 'flat-nose'
  if (key === 'tip.length') return c['tip.type'] === 'polymer-tip'
  if (key === 'tip.mouthDiameter') return c['tip.type'] === 'hollow-point'
  return true
}

/** The designer values of a bullet record (or the part of one the overrides give): SI values and choices. */
function valuesOf(r: Partial<Bullet>): Pick<Origin, 'si' | 'choices'> {
  const si: Origin['si'] = {}
  for (const s of designerSpecs) {
    const q = at(r, s.key) as { value: number } | undefined
    si[s.key] = q && storedToSi(stored(s), q.value)
  }
  return {
    si,
    choices: {
      'base.type': r.base?.type ?? '',
      'ogive.form': r.ogive?.form ?? '',
      'tip.type': r.tip?.type ?? '',
    },
  }
}

/** The origin a design is measured against: a catalogue bullet, titled with the manufacturer's name from `names`. */
function originOf(r: Bullet, names: ManufacturerNames): Origin {
  return {
    id: r.id,
    title: productLabel(r, names),
    ...(revisionOf(r) && { revision: revisionOf(r) }),
    manufacturer: `catalogue:${r.manufacturer}`,
    name: r.name,
    ...valuesOf(r),
  }
}

/** The design of a catalogue record, every stored value from the catalogue; `names` title it. */
export function fromRecord(
  r: Bullet,
  system: UnitSystem,
  names: ManufacturerNames = noManufacturerNames,
): Design {
  return fromOrigin(originOf(r, names), system)
}

/** The design of an origin as stored, as on a reset. */
function fromOrigin(origin: Origin, system: UnitSystem): Design {
  return {
    manufacturer: origin.manufacturer,
    name: origin.name,
    choices: { ...origin.choices },
    fields: Object.fromEntries(
      designerSpecs.map((s) => [s.key, fieldOf(system, s, origin.si[s.key])]),
    ),
    origin,
    basedOn: `catalogue:${origin.id}`,
  }
}

/**
 * The design of a saved user bullet: the resolved record's values, measured against its base (the
 * origin) so each field says whether it follows the catalogue or is changed. A base that is not
 * there gives a read only design that Save leaves as stored.
 */
export function fromUser(
  data: UserBullet,
  { base, record, problem, changed }: ResolvedBullet,
  system: UnitSystem,
  names: ManufacturerNames = noManufacturerNames,
): Design {
  const { si, choices } = valuesOf(record)
  const origin = base.status === 'found' ? originOf(base.record, names) : undefined
  return {
    ...(data.manufacturer && { manufacturer: data.manufacturer }),
    name: record.name ?? '',
    choices: { ...noChoices, ...choices },
    fields: Object.fromEntries(designerSpecs.map((s) => [s.key, fieldOf(system, s, si[s.key])])),
    ...(origin && { origin }),
    ...(data.basedOn && { basedOn: data.basedOn }),
    ...(changed && { baseChanged: true }),
    ...(data.overrides && { kept: data.overrides }),
    ...(problem && { locked: { reason: problem, data } }),
  }
}

/** The stored value of a field, in mm, g or degrees: 12 significant digits drop the noise of the SI round trip. */
const storedOf = (s: FieldSpec, si: number) => Number(siToStored(stored(s), si).toPrecision(12))

/** Sets the override of every designer field that differs from `origin`, and clears the others. */
function fieldOverrides(
  overrides: Record<string, unknown>,
  fields: Design['fields'],
  origin: Design['origin'],
) {
  for (const s of designerSpecs) {
    const si = fields[s.key]?.si
    const was = origin?.si[s.key]
    dropPath(overrides, s.key)
    if (si === undefined) {
      if (was !== undefined) setPath(overrides, s.key, null)
    } else if (!(origin && close(si, was))) setPath(overrides, s.key, { value: storedOf(s, si) })
  }
}

/** Sets the override of every choice that differs from `origin`, and clears the others. */
function choiceOverrides(
  overrides: Record<string, unknown>,
  choices: Design['choices'],
  origin: Design['origin'],
) {
  for (const k of Object.keys(choiceOptions) as ChoiceKey[]) {
    dropPath(overrides, k)
    if (choices[k] !== (origin?.choices[k] ?? '')) setPath(overrides, k, choices[k] || null)
  }
}

/**
 * The user bullet a design saves: its manufacturer, the base and the overrides, which are the
 * fields that differ from the base (a field cleared against a base value is `null`). Without a base
 * every given field is an override. The overrides it was opened with stay for every field the
 * designer has no input for. A read only design gives its stored data back.
 */
export function fileData({
  manufacturer,
  name,
  choices,
  fields,
  origin,
  basedOn,
  kept,
  locked,
}: Design): UserBullet {
  if (locked) return locked.data
  const overrides: Record<string, unknown> = structuredClone(kept ?? {})
  fieldOverrides(overrides, fields, origin)
  choiceOverrides(overrides, choices, origin)
  delete overrides.name
  if (name !== (origin?.name ?? '')) overrides.name = name || null
  return {
    origin: 'user',
    ...(manufacturer && { manufacturer }),
    ...(basedOn && { basedOn }),
    ...(basedOn && origin?.revision && { basedOnRevision: origin.revision }),
    ...(Object.keys(overrides).length > 0 && { overrides: overrides as UserBullet['overrides'] }),
  }
}

/**
 * A user bullet's resolved record as the shape the seating preview seats (mm), as the designer
 * draws it; undefined without a length or drawing.
 */
export function designShape(
  { base, record, problem }: ResolvedBullet,
  system: UnitSystem,
): BulletDimensions | undefined {
  if (problem || record.length === undefined) return
  const design = fromUser({ origin: 'user' }, { base, record }, system)
  return evaluate(design, system).drawing?.shape
}

/** Start values of a new bullet: .308 in (7.8232 mm), 168 gr. */
const newBulletStart = { diameter: 0.308 * metersPerInch, mass: 168 * kilogramsPerGrain }

/** A new bullet: the caliber and mass of `from` (else the start values), every other field empty. */
export function newDesign(system: UnitSystem, from?: Design): Design {
  return {
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
  | { type: 'text'; key: 'name'; value: string }
  | { type: 'manufacturer'; value: string | undefined }
  | { type: 'choice'; key: ChoiceKey; value: string }
  | { type: 'start'; design: Design }
  | { type: 'new'; system: UnitSystem }
  | { type: 'reset'; system: UnitSystem }
  | { type: 'revert'; key: string; system: UnitSystem }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'units'; system: UnitSystem }

export function reduce(h: History, a: Action): History {
  switch (a.type) {
    case 'text':
      return editHistory(h, { ...h.present, [a.key]: a.value }, a.key)
    case 'manufacturer':
      return editHistory(h, { ...h.present, manufacturer: a.value }, 'manufacturer')
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
  | { kind: 'entered'; changed: boolean; record?: number | undefined }
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
  refusal?: { reason: string; field: string } | undefined
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
    // 12 significant digits drop the noise of the SI round trip (7.823 mm in m and back)
    v[s.key] = si === undefined ? undefined : Number(siToStored(stored(s), si).toPrecision(12))
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
  t: Translator['t'],
): Evaluation['refusal'] {
  // the mass is not drawn: its error shows at the field only
  const invalid = designerSpecs
    .map((s) => [s.key, fieldError(s, design.fields[s.key], system, t)] as const)
    .filter(([k, e]) => e !== undefined && k !== 'mass')
  const bad = invalid.find(([k]) => k === last) ?? invalid[0]
  if (bad) return { reason: bad[1] as string, field: bad[0] }
  const startOnly = v['cannelure.start'] !== undefined && v['cannelure.width'] === undefined
  const widthOnly = v['cannelure.width'] !== undefined && v['cannelure.start'] === undefined
  if (startOnly || widthOnly)
    return {
      reason: t('A cannelure needs a start and a width.'),
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

function baseShape(v: StoredValues, choices: Choices): NonNullable<BulletDimensions['base']> {
  return {
    ...(choices['base.type'] && {
      type: choices['base.type'] as NonNullable<BulletDimensions['base']>['type'],
    }),
    ...(v['base.length'] !== undefined && { length: v['base.length'] }),
    ...(v['base.diameter'] !== undefined && { diameter: v['base.diameter'] }),
    ...(v['base.angle'] !== undefined && { angle: v['base.angle'] }),
    ...(v['base.cavityDiameter'] !== undefined && { cavityDiameter: v['base.cavityDiameter'] }),
    ...(v['base.cavityDepth'] !== undefined && { cavityDepth: v['base.cavityDepth'] }),
  }
}

function tipShape(
  v: StoredValues,
  type: NonNullable<BulletDimensions['tip']>['type'],
): NonNullable<BulletDimensions['tip']> {
  return {
    type,
    ...(v['tip.length'] !== undefined && { length: v['tip.length'] }),
    ...(v['tip.mouthDiameter'] !== undefined && { mouthDiameter: v['tip.mouthDiameter'] }),
  }
}

function cannelureShape(v: StoredValues): Pick<BulletDimensions, 'cannelure'> {
  if (v['cannelure.start'] === undefined) return {}
  return {
    cannelure: {
      start: v['cannelure.start'],
      width: v['cannelure.width'] as number,
      ...(v['cannelure.depth'] !== undefined && { depth: v['cannelure.depth'] }),
    },
  }
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
    base: baseShape(v, choices),
    ogive: {
      ...(form && { form }),
      ...(radius !== undefined && { radius }),
      ...(ratio !== undefined && { radiusRatio: ratio }),
    },
    ...(tipType && { tip: tipShape(v, tipType) }),
    ...cannelureShape(v),
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
): Fill {
  const d = v.diameter as number
  const tag = (i: number) => (o.tags[i] === 'approximate' ? 'assumed' : 'derived')
  const baseAssumed = o.approximate.some(([z]) => z === 0)
  const tipIndex = o.points.findIndex(([, z]) => z === L)
  const m = nth(o.points, tipIndex)[0]
  const fill: Fill = {
    length: [L, 'assumed', assumedLength],
    noseLength: [o.noseLength, noseFromRadius ? 'derived' : o.noseAssumed ? 'assumed' : 'derived'],
    bearingLength: [o.bearingLength, o.noseAssumed || baseAssumed ? 'assumed' : 'derived'],
    meplatDiameter: [2 * m, tag(tipIndex)],
    ...(o.cavity?.typed === false && { 'base.cavityDepth': [o.cavity.depth, 'assumed', '0.5 dc'] }),
  }
  boatTailFills(fill, o, d, tag)
  ogiveFills(fill, o, v, choices, m)
  if (o.tipStart !== undefined) fill['tip.length'] = [L - o.tipStart, 'assumed']
  if (choices['tip.type'] === 'hollow-point') {
    const mouth = o.points.filter(([, z]) => z === L).map(([r]) => r)
    fill['tip.mouthDiameter'] = [2 * Math.min(...mouth.filter((r) => r > 0), m), 'assumed']
  }
  if (v['cannelure.start'] !== undefined && v['cannelure.depth'] === undefined)
    fill['cannelure.depth'] = [0.02 * d, 'assumed', '0.02 d']
  return fill
}

type Fill = Record<string, [number, 'derived' | 'assumed', (string | undefined)?]>

function boatTailFills(
  fill: Fill,
  o: BulletProfile['outline'],
  d: number,
  tag: (i: number) => 'derived' | 'assumed',
) {
  // a boat tail starts at a base edge inside the shank radius; its top is the next point
  const e = o.baseEdge
  const base = nth(o.points, e)
  if (!(base[0] < d / 2 - 1e-12)) return
  const top = nth(o.points, e + 1)
  const t = top[1]
  const tagT = tag(e + 1)
  const tagB = tag(e)
  fill['base.length'] = [t, tagT]
  fill['base.diameter'] = [2 * base[0], tagB]
  fill['base.angle'] = [
    fromSi('angle', Math.atan((top[0] - base[0]) / t)),
    tagT === 'assumed' || tagB === 'assumed' ? 'assumed' : 'derived',
  ]
}

/** The radius and radius ratio of a nose whose form is not round, from the drawn nose length. */
function ogiveFills(
  fill: Fill,
  o: BulletProfile['outline'],
  v: StoredValues,
  choices: Choices,
  m: number,
) {
  const d = v.diameter as number
  const form = choices['ogive.form']
  if (form === 'round-nose' || form === 'flat-nose') return
  const radius = v['ogive.radius']
  const ratio = v['ogive.radiusRatio']
  const k = d / 2 - m
  const rt = (o.noseLength ** 2 + k ** 2) / (2 * k)
  const q = ratio ?? (radius ? rt / radius : form === 'secant' || form === 'hybrid' ? 0.5 : 1)
  if (!(k > 0 && q > 0)) return
  const assumed =
    o.noseAssumed || (ratio === undefined && radius === undefined && form !== 'tangent')
      ? 'assumed'
      : 'derived'
  fill['ogive.radius'] = [rt / q, assumed]
  fill['ogive.radiusRatio'] = [q, assumed]
}

/**
 * The drawing, the field states and the computed values of a design. `last` is the field edited
 * last: a refusal naming it shows there, in the language of `t`. Invalid field text and refused
 * dimensions give no drawing, so the page keeps its last one.
 */
export function evaluate(
  design: Design,
  system: UnitSystem,
  last?: string,
  t: Translator['t'] = untranslated(),
): Evaluation {
  const { choices } = design
  const { v, states } = fieldStates(design)
  const sdOk = v.mass !== undefined && v.mass > 0 && v.diameter !== undefined && v.diameter > 0
  const computed = sdOk
    ? computedBulletRows({
        mass: { value: v.mass as number },
        diameter: { value: v.diameter as number },
        ...(v.length !== undefined && v.length > 0 && { length: { value: v.length } }),
        ...(choices['tip.type'] && { tip: { type: choices['tip.type'] } }),
      })
    : []
  const done = (refusal: Evaluation['refusal']): Evaluation => ({ refusal, states, computed })

  const refusal = validateInputs(design, v, system, last, t)
  if (refusal) return done(refusal)

  const completed = completeShape(v, choices)
  const shape = shapeFromValues(v, choices, completed.L, completed.n)
  const given = designerSpecs.map((s) => s.key).filter((k) => v[k] !== undefined)
  const p = bulletProfile(shape, (f) => given.includes(f), 'entered', drawingLengthUnit(system))
  if ('reason' in p) {
    const field =
      p.fields.find((f) => f === last) ??
      p.fields.find((f) => v[f] !== undefined || f in choices) ??
      nth(p.fields, 0)
    return done({ reason: p.reason, field })
  }

  // values the drawing derived or assumed for empty fields in use, stored units
  const fill = derivedFills(p.outline, v, choices, completed)
  for (const s of designerSpecs) {
    const f = fill[s.key]
    if (v[s.key] === undefined && f && fieldInUse(s.key, design) && Number.isFinite(f[0]))
      states[s.key] = { kind: f[1], si: storedToSi(stored(s), f[0]), ...(f[2] && { basis: f[2] }) }
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
