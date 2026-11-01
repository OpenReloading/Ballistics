import type { Dimension, Profile, RadiusMark } from '../core/types.ts'
import type { LengthUnit } from '../core/units.ts'
import {
  type BaseType,
  type BulletDimensions,
  bulletOutline,
  type Outline,
  type Refusal,
} from './outline.ts'

/** A stored quantity: the value in the stored unit and the text as printed. */
interface StoredQuantity {
  value: number
  raw?: string | undefined
}

/** The bullet record fields the drawing reads; the API type of a bullet record is assignable to it. */
export interface BulletValues {
  diameter?: StoredQuantity | undefined
  length?: StoredQuantity | undefined
  noseLength?: StoredQuantity | undefined
  baseToOgive?: StoredQuantity | undefined
  bearingLength?: StoredQuantity | undefined
  meplatDiameter?: StoredQuantity | undefined
  base?:
    | {
        type?: BaseType | undefined
        length?: StoredQuantity | undefined
        diameter?: StoredQuantity | undefined
        angle?: StoredQuantity | undefined
        cavityDiameter?: StoredQuantity | undefined
      }
    | undefined
  ogive?:
    | {
        form?: string | undefined
        radius?: StoredQuantity | undefined
        radiusRatio?: StoredQuantity | undefined
      }
    | undefined
  cannelure?:
    | { start: StoredQuantity; width: StoredQuantity; depth?: StoredQuantity | undefined }
    | undefined
  tip?:
    | {
        type: string
        length?: StoredQuantity | undefined
        mouthDiameter?: StoredQuantity | undefined
      }
    | undefined
  provenance: { sources: { title: string; fields?: string[] | undefined }[] }
}

/** A dimensioned field of a bullet drawing. */
interface BulletSymbol {
  /** Drawing symbol, such as `L` or `BTO`. */
  symbol: string
  /** Dot path of the field in the bullet record. */
  path: string
  /** Name of the field in labels. */
  name: string
}

/** The drawing symbol of each dimensioned field, its record path and its name. */
export const bulletSymbols: readonly BulletSymbol[] = [
  { symbol: 'L', path: 'length', name: 'length' },
  { symbol: 'd', path: 'diameter', name: 'diameter' },
  { symbol: 'n', path: 'noseLength', name: 'nose length' },
  { symbol: 'b', path: 'bearingLength', name: 'bearing length' },
  { symbol: 't', path: 'base.length', name: 'boat-tail length' },
  { symbol: 'db', path: 'base.diameter', name: 'base diameter' },
  { symbol: 'dc', path: 'base.cavityDiameter', name: 'cavity diameter' },
  { symbol: 'dm', path: 'meplatDiameter', name: 'meplat diameter' },
  { symbol: 'dh', path: 'tip.mouthDiameter', name: 'hollow-point mouth diameter' },
  { symbol: 'R', path: 'ogive.radius', name: 'ogive radius' },
  { symbol: 'Rt/R', path: 'ogive.radiusRatio', name: 'ogive radius ratio' },
  { symbol: 'lt', path: 'tip.length', name: 'tip length' },
  { symbol: 'BTO', path: 'baseToOgive', name: 'base to ogive' },
  { symbol: 'c', path: 'cannelure.start', name: 'cannelure start' },
  { symbol: 'w', path: 'cannelure.width', name: 'cannelure width' },
]

/** Stored fields the drawing reads but never dimensions. */
const undimensionable = [{ path: 'base.angle', name: 'boat-tail angle' }]

const baseDimensions = (base: NonNullable<BulletValues['base']>) => ({
  ...(base.type && { type: base.type }),
  ...(base.length && { length: base.length.value }),
  ...(base.diameter && { diameter: base.diameter.value }),
  ...(base.angle && { angle: base.angle.value }),
  ...(base.cavityDiameter && { cavityDiameter: base.cavityDiameter.value }),
})

const ogiveDimensions = (ogive: NonNullable<BulletValues['ogive']>) => ({
  ...(ogive.form && { form: ogive.form }),
  ...(ogive.radius && { radius: ogive.radius.value }),
  ...(ogive.radiusRatio && { radiusRatio: ogive.radiusRatio.value }),
})

const cannelureDimensions = (cannelure: NonNullable<BulletValues['cannelure']>) => ({
  start: cannelure.start.value,
  width: cannelure.width.value,
  ...(cannelure.depth && { depth: cannelure.depth.value }),
})

const tipDimensions = (tip: NonNullable<BulletValues['tip']>) => ({
  type: tip.type,
  ...(tip.length && { length: tip.length.value }),
  ...(tip.mouthDiameter && { mouthDiameter: tip.mouthDiameter.value }),
})

/** The shape `bulletOutline` reads, in mm and degrees; undefined without a length or a diameter. */
export function bulletDimensions(r: BulletValues): BulletDimensions | undefined {
  if (!r.length || !r.diameter) return
  const base = r.base && baseDimensions(r.base)
  const ogive = r.ogive && ogiveDimensions(r.ogive)
  const cannelure = r.cannelure && cannelureDimensions(r.cannelure)
  const tip = r.tip && tipDimensions(r.tip)
  return {
    diameter: r.diameter.value,
    length: r.length.value,
    ...(r.noseLength && { noseLength: r.noseLength.value }),
    ...(r.baseToOgive && { baseToOgive: r.baseToOgive.value }),
    ...(r.bearingLength && { bearingLength: r.bearingLength.value }),
    ...(r.meplatDiameter && { meplatDiameter: r.meplatDiameter.value }),
    ...(base && { base }),
    ...(ogive && { ogive }),
    ...(cannelure && { cannelure }),
    ...(tip && { tip }),
  }
}

/** The title of the source that covers a field: one without `fields` covers the whole record. */
export const sourceTitle = (r: BulletValues, field: string) =>
  r.provenance.sources.find(
    (s) => !s.fields || s.fields.some((f) => field === f || field.startsWith(`${f}.`)),
  )?.title

/** A field's stored quantity by its dot path. */
const at = (r: BulletValues, field: string): StoredQuantity | undefined =>
  field.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], r) as
    | StoredQuantity
    | undefined

/** The profile of a bullet in mm and degrees, with its outline and the fields left undimensioned. */
export interface BulletProfile extends Profile {
  outline: Outline
  /** Names of the stored fields that are not dimensioned. */
  undimensioned: string[]
}

/**
 * The outline of a bullet and the dimensions of the values `sourced` covers that the drawn
 * outline follows: a value the outline replaced, assumed or derived is never dimensioned. A
 * refusal writes its lengths in `unit`.
 */
export function bulletProfile(
  shape: BulletDimensions,
  sourced: (field: string) => boolean,
  given: 'sourced' | 'entered' = 'sourced',
  unit: LengthUnit = 'mm',
): BulletProfile | Refusal {
  const o = bulletOutline(shape, given, unit)
  if ('reason' in o) return o
  const L = shape.length
  const z0 = L - o.noseLength
  const t = z0 - o.bearingLength
  const groove = shape.cannelure
  const dimensions = dimensionsOf(shape, o, sourced)
  const radii = ogiveRadii(shape, o, sourced)
  const undimensioned = undimensionedFields(shape, [...dimensions, ...radii])
  const edges = [
    ...(t > 0 ? [t] : []),
    ...(z0 > t && z0 < L ? [z0] : []),
    ...(groove ? [groove.start, groove.start + groove.width] : []),
    ...(o.tipStart === undefined ? [] : [o.tipStart]),
  ].sort((x, y) => x - y)
  return {
    points: o.points,
    notes: [],
    annotation: { dimensions, angles: [], radii, edges, conventions: [] },
    outline: o,
    undimensioned,
  }
}

/** The middle of the longest shank run, off the cannelure: where the diameter goes. */
function shankStation(t: number, z0: number, groove: BulletDimensions['cannelure']) {
  const runs: [[number, number], ...[number, number][]] = groove
    ? [
        [t, groove.start],
        [groove.start + groove.width, z0],
      ]
    : [[t, z0]]
  const [s0, s1] = runs.reduce((p, c) => (c[1] - c[0] > p[1] - p[0] ? c : p), runs[0])
  return (s0 + s1) / 2
}

/** Radius of the point the base face's edge reaches. */
function baseRadius(o: Outline) {
  const corner = o.points[o.baseEdge]
  if (!corner) throw new Error('The outline has no base edge point.')
  return corner[0]
}

/** The dimensions of the stored values `sourced` covers that the drawn outline `o` follows. */
function dimensionsOf(
  shape: BulletDimensions,
  o: Outline,
  sourced: (field: string) => boolean,
): Dimension[] {
  const { length: L, diameter } = shape
  const a = diameter / 2
  const z0 = L - o.noseLength
  const t = z0 - o.bearingLength
  const rb = baseRadius(o)
  const tip = shape.tip?.type
  const groove = shape.cannelure
  const dimensions: Dimension[] = []
  const add = (
    symbol: string,
    value: number | undefined,
    ok: boolean,
    d: Omit<Dimension, 'symbol' | 'value' | 'stored'>,
  ) => {
    const field = bulletSymbols.find((s) => s.symbol === symbol)?.path as string
    if (value !== undefined && ok && sourced(field))
      dimensions.push({ symbol, value, stored: { symbol, value }, ...d })
  }
  const station = shankStation(t, z0, groove)
  add('L', L, true, { kind: 'length', from: 0, to: L })
  add('d', diameter, true, { kind: 'diameter', from: station, to: station, radius: a })
  add('n', shape.noseLength, !o.noseAssumed, { kind: 'chain', from: z0, to: L })
  const bearing = shape.bearingLength
  add('b', bearing, bearing !== undefined && Math.abs(o.bearingLength - bearing) <= 0.05, {
    kind: 'chain',
    from: t,
    to: z0,
  })
  const tail = t > 0
  const gl = shape.base?.length
  add('t', gl, tail && gl !== undefined && Math.abs(t - gl) < 1e-9, {
    kind: 'length',
    from: 0,
    to: t,
  })
  const gd = shape.base?.diameter
  add('db', gd, tail && gd !== undefined && Math.abs(2 * rb - gd) < 1e-9, {
    kind: 'diameter',
    from: 0,
    to: 0,
    radius: rb,
    behindHeadFace: true,
  })
  const cavityDiameter = shape.base?.cavityDiameter
  add(
    'dc',
    cavityDiameter,
    o.cavity !== undefined &&
      cavityDiameter !== undefined &&
      Math.abs(2 * o.cavity.radius - cavityDiameter) < 1e-9,
    { kind: 'diameter', from: 0, to: 0, radius: o.cavity?.radius, behindHeadFace: true },
  )
  const meplat = shape.meplatDiameter
  add('dm', meplat, (meplat ?? 0) > 0, {
    kind: 'diameter',
    from: L,
    to: L,
    radius: (meplat ?? 0) / 2,
    front: true,
  })
  const mouth = shape.tip?.mouthDiameter
  // the outline draws the mouth on the meplat line only inside it
  const meplatR = Math.max(...o.points.filter(([, z]) => z === L).map(([r]) => r))
  add('dh', mouth, tip === 'hollow-point' && (mouth ?? 0) > 0 && (mouth ?? 0) / 2 < meplatR, {
    kind: 'diameter',
    from: L,
    to: L,
    radius: (mouth ?? 0) / 2,
    front: true,
  })
  add('lt', shape.tip?.length, tip === 'polymer-tip' && o.tipStart !== undefined, {
    kind: 'chain',
    from: o.tipStart ?? 0,
    to: L,
  })
  const bto = shape.baseToOgive
  add('BTO', bto, bto !== undefined && bto > 0 && bto < L, {
    kind: 'length',
    from: 0,
    to: bto ?? 0,
  })
  if (groove) {
    add('c', groove.start, true, { kind: 'length', from: 0, to: groove.start })
    add('w', groove.width, true, {
      kind: 'chain',
      from: groove.start,
      to: groove.start + groove.width,
    })
  }
  return dimensions
}

/** The nose callouts on the drawn nose, R at its middle and Rt/R further forward; none on a round nose. */
function ogiveRadii(
  shape: BulletDimensions,
  o: Outline,
  sourced: (field: string) => boolean,
): RadiusMark[] {
  const L = shape.length
  const z0 = L - o.noseLength
  const radii: RadiusMark[] = []
  const round = shape.ogive?.form === 'round-nose' || shape.ogive?.form === 'flat-nose'
  const nosePoint = (share: number) => {
    const z = z0 + share * o.noseLength
    const nose = o.points.filter(([, pz]) => pz > z0 && pz < L)
    const first = nose[0]
    return first && nose.reduce((p, c) => (Math.abs(c[1] - z) < Math.abs(p[1] - z) ? c : p), first)
  }
  for (const [symbol, value, share] of [
    ['R', shape.ogive?.radius, 0.5],
    ['Rt/R', shape.ogive?.radiusRatio, 0.75],
  ] as const) {
    if (
      value === undefined ||
      round ||
      !sourced(symbol === 'R' ? 'ogive.radius' : 'ogive.radiusRatio')
    )
      continue
    const corner = nosePoint(share)
    if (corner) radii.push({ kind: 'radius', symbol, value, stored: { symbol, value }, corner })
  }
  return radii
}

/** Names of the fields the shape gives that no mark in `drawn` dimensions. */
function undimensionedFields(shape: BulletDimensions, drawn: { symbol: string }[]): string[] {
  const symbols = new Set(drawn.map((d) => d.symbol))
  const stored = (field: string) => at(shape as unknown as BulletValues, field) !== undefined
  return [
    ...bulletSymbols.filter((s) => !symbols.has(s.symbol) && stored(s.path)),
    ...undimensionable.filter((s) => stored(s.path)),
  ].map((s) => s.name)
}

/** The profile of a record: its shape, with the fields its sources cover. */
export function recordProfile(r: BulletValues): BulletProfile | Refusal {
  const shape = bulletDimensions(r)
  if (!shape) {
    const field = r.length ? 'diameter' : 'length'
    return { reason: `The record has no ${field}.`, fields: [field] }
  }
  return bulletProfile(
    shape,
    (field) => at(r, field) !== undefined && sourceTitle(r, field) !== undefined,
  )
}
