/** The cartridge design without its texts: the fields, the drawn spec, the layout check and the design the workbench uses. */

import { type SpecValue, toSi, type UserCartridge } from '@rangefoundry/schema'
import {
  type Figure,
  figureModel,
  recordFigures,
  regions,
  type Side,
  screenEm,
  screenWidth,
  sideName,
  storedValue,
} from '@rangefoundry/svg-drawings/cartridge'
import { chamberOf } from '@rangefoundry/svg-drawings/seating'
import { linguiOf } from '../i18n/lingui.ts'
import { english } from '../i18n/translate.ts'
import type { CartridgeDetail } from './api-types.ts'
import { fieldError } from './field-error.ts'
import {
  close,
  type FieldSpec,
  type Fields,
  fieldOf,
  siToStored,
  storedToSi,
} from './field-spec.ts'
import { nth } from './nth.ts'
import type { UnitSystem } from './units.ts'
import { type ResolvedCartridge, revisionOf } from './variants.ts'

/** The field groups of the designer, in order. */
export const groups = {
  head: 'Head, rim and groove',
  body: 'Body',
  shoulder: 'Shoulder',
  neck: 'Neck and length',
  throat: 'Throat and leade',
} as const

export type Group = keyof typeof groups

export const both: Side[] = ['cartridge', 'chamber']
const cartridge: Side[] = ['cartridge']
const chamber: Side[] = ['chamber']

/** The CIP symbols the outline reads (`cipProfile` of `@rangefoundry/svg-drawings/cartridge`): the typical largest value sets the length limit (2.5 times it, 50 mm for a diameter); not read for an angle. */
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
  /** Largest length accepted, SI: the layout time grows with the size of the drawing. */
  limit?: number
}

export const fieldSpecs: CartridgeFieldSpec[] = symbols.flatMap(
  ([symbol, meaning, sides, group, size, q]) =>
    sides.map((side) => ({
      key: `${side}.${symbol}`,
      label: `${sideName[side]} ${symbol}`,
      quantity: q,
      min: 0,
      ...(q === 'angle'
        ? { max: 180 }
        : { limit: size === 35 ? 50e-3 : storedToSi(q, 2.5 * size) }),
      side,
      symbol,
      meaning,
      group,
    })),
)

export const specOf = new Map(fieldSpecs.map((s) => [s.key, s]))

/** The record a design started from: its values and their SI values by field key. */
export interface Origin {
  id: string
  title: string
  /** The `revision` of the catalogue record, as the API answered it. */
  revision?: string | undefined
  table?: string | undefined
  values: SpecValue[]
  si: Record<string, number | undefined>
}

export interface Design {
  /** The name typed for the design: the file's and the workbench's name of it; blank, the base's. */
  name?: string | undefined
  /** The CIP table whose drawing rules apply (table III: belt). */
  table: string
  fields: Fields
  origin?: Origin | undefined
  /** The catalogue cartridge the design is based on, `catalogue:<id>`, kept through files. */
  basedOn?: string
  /** The base changed since the design was saved: the values not overridden follow it. */
  baseChanged?: boolean
  /** The overrides as saved: Save keeps those of a value the designer has no field for and every other key. */
  kept?: UserCartridge['overrides']
  /** Why the design is read only (its base is not there), with the record as stored, which Save keeps as it is. */
  locked?: { reason: string; data: UserCartridge }
}

export const keyOf = (v: Pick<SpecValue, 'side' | 'symbol' | 'variant'>) =>
  v.side && !v.variant ? `${v.side}.${v.symbol}` : undefined

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
export const originOf = (c: Pick<CartridgeDetail, 'id' | 'name' | 'table' | 'values'>): Origin => ({
  id: c.id,
  title: `CIP ${c.name}`,
  ...(revisionOf(c) && { revision: revisionOf(c) }),
  table: c.table,
  values: c.values,
  si: siOf(c.values),
})

/** Measured against its base, so each field says whether it follows the record; a missing base gives a read-only design. */
export function fromUser(
  data: UserCartridge,
  { base, record, problem, changed }: ResolvedCartridge,
  system: UnitSystem,
): Design {
  const si = siOf(record.values)
  const origin = base.status === 'found' ? originOf(base.record) : undefined
  return {
    table: record.table ?? 'I',
    fields: Object.fromEntries(fieldSpecs.map((s) => [s.key, fieldOf(system, s, si[s.key])])),
    ...(origin && { origin }),
    ...(data.basedOn && { basedOn: data.basedOn }),
    ...(changed && { baseChanged: true }),
    ...(data.overrides && { kept: data.overrides }),
    ...(problem && { locked: { reason: problem, data } }),
  }
}

/** A field value in stored units (mm, degrees); 12 significant digits drop the SI round-trip noise. */
export const storedFieldValue = (s: CartridgeFieldSpec, si: number) =>
  Number(siToStored(s.quantity as 'length' | 'angle', si).toPrecision(12))

/** An unchanged value stays the record's own object (printed text, tolerance, limit); values without a side (pressures) go. */
function draftValues({ fields, origin }: Design): SpecValue[] {
  const out: SpecValue[] = []
  const seen = new Set<string>()
  for (const v of origin?.values ?? []) {
    if (!v.side) continue
    const key = keyOf(v)
    const s = key && specOf.get(key)
    if (!s) {
      out.push(v)
      continue
    }
    seen.add(s.key)
    const kept = keptValue(v, s, fields[s.key]?.si, origin?.si[s.key])
    if (kept) out.push(kept)
  }
  for (const s of fieldSpecs) {
    const si = fields[s.key]?.si
    if (!seen.has(s.key) && si !== undefined) out.push(enteredValue(s, si))
  }
  return out
}

const enteredValue = (s: CartridgeFieldSpec, si: number): SpecValue => ({
  side: s.side,
  symbol: s.symbol,
  quantity: s.quantity as 'length' | 'angle',
  value: storedFieldValue(s, si),
})

/** The record's value `v` as the design keeps it: itself, the entered value, or nothing once cleared. */
function keptValue(
  v: SpecValue,
  s: CartridgeFieldSpec,
  si: number | undefined,
  was: number | undefined,
) {
  if (si === undefined) return was === undefined ? v : undefined
  return close(si, was) ? v : enteredValue(s, si)
}

/** The spec the drawing reads: a CIP-shaped record with the design's table and values. */
export const draftSpec = (design: Design) => ({
  id: 'designer',
  standard: 'CIP',
  name: 'design',
  table: design.table,
  values: draftValues(design),
})

export type DraftSpec = ReturnType<typeof draftSpec>

/** Whether field `s` holds more than the designer lays out. */
export function tooLarge(s: CartridgeFieldSpec, fields: Fields): boolean {
  const si = fields[s.key]?.si
  return !(s.limit === undefined || si === undefined || si <= s.limit)
}

/** The figures of `spec` and those drawn, as the page lays them out; undefined when the layout fails. */
export function layOut(spec: DraftSpec): { list: Figure[]; shown: Figure[] } | undefined {
  try {
    const list = recordFigures(spec)
    const shown = list.filter((f) => f.drawn.length)
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
    return { list, shown }
  } catch {
    return undefined
  }
}

/** Approximate: the outline less a wall from head to mouth; mm and degrees in, the volume SI, the wall and head mm. */
export function caseVolume(figure: Figure, values: SpecValue[]) {
  const c = figure.drawn.find((d) => d.side === 'cartridge')
  if (!c) return
  const v = (symbol: string) => storedValue(values, 'cartridge', symbol)?.value
  const [H2, G1, L3] = ['H2', 'G1', 'L3'].map(v) as [number, number | undefined, number]
  const head = v('E') ?? v('R') ?? 0
  const fromNeck = G1 !== undefined && H2 > G1
  const wall = fromNeck ? (H2 - G1) / 2 : 0.3
  let mm3 = 0
  const pts = c.p.points
  for (let k = 1; k < pts.length; k++) {
    const [[ra, za], [rb, zb]] = [nth(pts, k - 1), nth(pts, k)]
    const lo = Math.max(za, head)
    const hi = Math.min(zb, L3)
    if (hi <= lo) continue
    const at = (z: number) => Math.max(0, ra + ((rb - ra) * (z - za)) / (zb - za) - wall)
    const [a, b] = [at(lo), at(hi)]
    mm3 += (Math.PI * (hi - lo) * (a * a + a * b + b * b)) / 3
  }
  // mm3 is mm2 times mm
  return { si: toSi('length', toSi('area', mm3)), head, fromNeck, wall }
}

/** SI, from the resolved values; undefined where the design does not draw, is a shotshell (table VII) or lacks the L3 the seating needs. */
export function workbenchDesign(
  d: UserCartridge,
  resolved: ResolvedCartridge,
  name: string,
  system: UnitSystem,
) {
  if (resolved.problem) return
  const design = fromUser(d, resolved, system)
  const { fields } = design
  // the designer refuses to draw an invalid or too large field
  if (
    fieldSpecs.some(
      (s) =>
        fieldError(s, fields[s.key], system, english.t, linguiOf('en')) !== undefined ||
        tooLarge(s, fields),
    )
  )
    return
  const spec = draftSpec(design)
  const shown = layOut(spec)?.shown
  if (!shown?.length || spec.table === 'VII' || !chamberOf(spec.values)) return
  return {
    spec,
    title: `user design ${name}`,
    boreDiameter: fields['chamber.F']?.si,
    caseVolume: caseVolume(nth(shown, 0), spec.values)?.si,
  }
}
