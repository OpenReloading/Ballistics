import type { SectionPoint } from '../core/types.ts'
import { deg, type LengthUnit, lengthText } from '../core/units.ts'
import { closedEdges, pairs } from '../core/vector.ts'

/**
 * Where an outline point comes from: `sourced` (a record value) or `entered` (a designer value)
 * when both coordinates are given values, `derived` when computed from given values only,
 * `approximate` once a stated proportion stands in for a missing value.
 */
export type Tag = 'sourced' | 'entered' | 'derived' | 'approximate'

/** The base types: a hollow base has a cone or a hemisphere cut into its base face. */
export type BaseType =
  | 'flat'
  | 'boat-tail'
  | 'rebated-boat-tail'
  | 'conical-hollow-base'
  | 'rounded-hollow-base'

/** Bullet dimensions, mm and degrees: the record fields of the same names, plain numbers. */
export interface BulletDimensions {
  diameter: number
  length: number
  noseLength?: number | undefined
  baseToOgive?: number | undefined
  bearingLength?: number | undefined
  /** 0 for a sharp point. */
  meplatDiameter?: number | undefined
  base?:
    | {
        type?: BaseType | undefined
        length?: number | undefined
        /** Diameter of the base face at the end of the boat tail. */
        diameter?: number | undefined
        /** Half angle of the boat-tail cone to the axis. */
        angle?: number | undefined
        /** Diameter of the cavity of a hollow base where it opens in the base face. */
        cavityDiameter?: number | undefined
      }
    | undefined
  /**
   * `form`: `tangent`, `secant`, `hybrid`, or for designer input `round-nose` and `flat-nose`.
   * `radius` is the ogive radius R; `radiusRatio` is Rt/R (1 tangent, 0 a cone).
   */
  ogive?:
    | { form?: string | undefined; radius?: number | undefined; radiusRatio?: number | undefined }
    | undefined
  /** `length`: polymer tip forward of the jacket opening; `mouthDiameter`: hollow-point opening. */
  tip?:
    | { type: string; length?: number | undefined; mouthDiameter?: number | undefined }
    | undefined
  /**
   * `start` is the z of the groove's rear edge from the base, `width` its axial width, `depth`
   * its radial depth.
   */
  cannelure?: { start: number; width: number; depth?: number | undefined } | undefined
}

/** Why input cannot form an outline, and the record paths of the fields involved. */
export interface Refusal {
  reason: string
  fields: string[]
}

/** A length given in mm as a refusal reason writes it, with its unit: "16 mm", ".6299 in". */
type LengthText = (mm: number) => string

/** A refusal whose reason is written once the length unit is known. */
interface Refused {
  reason: (length: LengthText) => string
  fields: string[]
}

/** The half profile of a bullet with the quantities derived from it, in mm, mm², mm³ and degrees. */
export interface Outline {
  /**
   * Half profile [r, z] to the tip on the axis, closed along the axis. It starts at the base
   * centre (z = 0), or at the apex of a hollow base's cavity, which the profile follows down to the
   * base face (`baseEdge`); from there z never falls.
   */
  points: SectionPoint[]
  /** The tag of each point of `points`. */
  tags: Tag[]
  /** Stroked runs of the outline; approximate ones rest on an assumed shape. */
  segments: { points: SectionPoint[]; approximate: boolean }[]
  /** z ranges of the outline drawn from an assumed shape, the cavity of a hollow base apart. */
  approximate: [number, number][]
  /** Index in `points` of the edge of the base face. */
  baseEdge: number
  /** The cavity of a hollow base: its radius at the base face and its depth, an assumed shape. */
  cavity?: { radius: number; depth: number }
  noseLength: number
  noseAssumed: boolean
  /** Shank length between the boat tail and the nose, mm. */
  bearingLength: number
  /** Volume of revolution, mm³, less the cavity. */
  volume: number
  /** Area of the full axial section, mm². */
  area: number
  /** z of the centre of the section area, mm. */
  areaCentreZ: number
  /** z where a polymer tip leaves the jacket. */
  tipStart?: number
  notes: string[]
}

/** Assumed boat-tail half angle, degrees, when the bullet gives only the tail length. */
export const assumedBoatTailAngle = 8

/** Whether the base type has a cavity. */
const isHollow = (type: string | undefined) =>
  type === 'conical-hollow-base' || type === 'rounded-hollow-base'

const flatTips = new Set(['hollow-point', 'open-meplat', 'soft-point'])
const forms = new Set(['tangent', 'secant', 'hybrid', 'round-nose', 'flat-nose'])
/** Curved parts are sampled in this many steps (z steps for arcs, angle steps for a round nose). */
const steps = 24
/** Allowed misfit of tail + bearing + nose against the length: three values rounded to 0.001 in. */
const lengthTolerance = 0.05
const angleTolerance = 0.5
const ratioTolerance = 0.01

const worst = (...tags: Tag[]): Tag =>
  tags.includes('approximate')
    ? 'approximate'
    : tags.includes('derived')
      ? 'derived'
      : (tags[0] ?? 'derived')

/** A length in mm to 3 decimals. */
const mm: LengthText = (x) => `${+x.toFixed(3)} mm`
/** A length in mm written in `unit`: mm to 3 decimals, inches as the figure labels write them. */
const inUnit = (unit: LengthUnit): LengthText =>
  unit === 'mm' ? mm : (x) => `${lengthText(x, 'in')} in`

/** Twice the signed area of the triangle p, q, s. */
export const triangleArea2 = (p: SectionPoint, q: SectionPoint, s: SectionPoint) =>
  (q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0])
const within = (p: SectionPoint, q: SectionPoint, s: SectionPoint) =>
  Math.min(p[0], q[0]) - 1e-12 <= s[0] &&
  s[0] <= Math.max(p[0], q[0]) + 1e-12 &&
  Math.min(p[1], q[1]) - 1e-12 <= s[1] &&
  s[1] <= Math.max(p[1], q[1]) + 1e-12

/** Whether two closed segments meet. */
function meet(p1: SectionPoint, p2: SectionPoint, p3: SectionPoint, p4: SectionPoint): boolean {
  const eps = 1e-12
  const [d1, d2, d3, d4] = [
    triangleArea2(p3, p4, p1),
    triangleArea2(p3, p4, p2),
    triangleArea2(p1, p2, p3),
    triangleArea2(p1, p2, p4),
  ]
  if (
    ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) &&
    ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))
  )
    return true
  return (
    (Math.abs(d1) <= eps && within(p3, p4, p1)) ||
    (Math.abs(d2) <= eps && within(p3, p4, p2)) ||
    (Math.abs(d3) <= eps && within(p1, p2, p3)) ||
    (Math.abs(d4) <= eps && within(p1, p2, p4))
  )
}

/** Whether the half profile, closed along the axis, crosses or touches itself away from shared corners. */
export function profileCrossesItself(points: SectionPoint[]): boolean {
  const edges = closedEdges(points)
  for (const [i, ei] of edges.entries())
    for (const [j, ej] of edges.entries()) {
      if (j < i + 2 || (i === 0 && j === edges.length - 1)) continue
      if (meet(...ei, ...ej)) return true
    }
  return false
}

/**
 * Bullet outline from the given dimensions; stated proportions stand in for missing ones and
 * are named in the notes. Input that cannot form an outline returns a reason. Ogive radius and
 * Rt/R as defined by McCoy, ARBRL-TR-02293, 1981, PDF p. 13. A refusal writes its lengths in `unit`.
 */
export function bulletOutline(
  b: BulletDimensions,
  given: 'sourced' | 'entered' = 'sourced',
  unit: LengthUnit = 'mm',
): Outline | Refusal {
  const o = outlineOf(b, given)
  return 'reason' in o ? { reason: o.reason(inUnit(unit)), fields: o.fields } : o
}

/** The outline of `bulletOutline`, or a refusal not yet written in a length unit. */
function outlineOf(b: BulletDimensions, given: 'sourced' | 'entered'): Outline | Refused {
  const { diameter: d, length: L } = b
  if (!(d > 0) || !(L > 0))
    return fail(
      'The diameter and the length must be positive.',
      ...(d > 0 ? [] : ['diameter']),
      ...(L > 0 ? [] : ['length']),
    )
  const notes: string[] = []
  const front = noseFront(b, given, notes)
  if ('reason' in front) return front
  const { base, n, nTag, z0, m, mTag, curve, noseTag } = front
  const tip = tipSplit(b, n, noseTag, notes)
  if (tip && 'reason' in tip) return tip
  const mouth = hollowPointMouth(b, m, given, notes)
  if ('reason' in mouth) return mouth
  const groove = cannelureGeometry(b, base.t, z0, notes)
  if (groove && 'reason' in groove) return groove
  const cavity = cavityGeometry(b, base.rb, notes)
  if (cavity && 'reason' in cavity) return cavity
  const assembled = assemblePoints({
    given,
    a: d / 2,
    L,
    base,
    cavity,
    groove,
    z0,
    nTag,
    noseTag,
    samples: noseSamples(curve, noseTag, tip),
    rAt: curve.rAt,
    m,
    mTag,
    ...mouth,
  })
  return closeOutline(assembled, { cavity, tip, n, nTag, bearingLength: z0 - base.t, L, notes })
}

/** The base, nose length, meplat and nose curve of a bullet: everything up to the tip and the groove. */
function noseFront(b: BulletDimensions, given: 'sourced' | 'entered', notes: string[]) {
  const base = baseGeometry(b, given, notes)
  if ('reason' in base) return base
  const nose = noseLengthOf(b, base, notes)
  if ('reason' in nose) return nose
  const { n, nTag } = nose
  const form = b.ogive?.form
  if (form !== undefined && !forms.has(form))
    return fail(`Unknown nose form ${form}.`, 'ogive.form')
  const meplat = meplatRadius(b, given, notes)
  if ('reason' in meplat) return meplat
  const { m, mTag } = meplat
  const curve = noseCurve(b, n, m, notes)
  if ('reason' in curve) return curve
  const noseTag = worst(nTag, mTag, curve.formTag)
  return { base, n, nTag, z0: b.length - n, m, mTag, curve, noseTag }
}

/** The nose sample z values with their tags: the curve's, its extra ones and the tip start. */
function noseSamples(
  curve: NoseCurve,
  noseTag: Tag,
  tip: { tipStart: number; tag: Tag } | undefined,
) {
  const samples = new Map<number, Tag>(curve.zs.map((z) => [z, noseTag]))
  for (const [z, tag] of [...curve.extra, ...(tip ? [[tip.tipStart, tip.tag] as const] : [])])
    samples.set(z, tag)
  return samples
}

/** The outline from its assembled points, or a refusal when the section crosses itself. */
function closeOutline(
  { points, tags, segments, approximate, baseEdge }: ReturnType<typeof assemblePoints>,
  {
    cavity,
    tip,
    n,
    nTag,
    bearingLength,
    L,
    notes,
  }: {
    cavity: Cavity | undefined
    tip: { tipStart: number; tag: Tag } | undefined
    n: number
    nTag: Tag
    bearingLength: number
    L: number
    notes: string[]
  },
): Outline | Refused {
  // section polygon closed along the axis; the full section mirrors it
  if (profileCrossesItself(points))
    return fail(
      'The outline crosses itself: check the nose, tail, groove and tip lengths.',
      'noseLength',
      'base.length',
      'cannelure.start',
      'tip.length',
    )
  const { area, areaCentreZ } = sectionProperties(points)
  return {
    points,
    tags,
    segments,
    approximate,
    baseEdge,
    ...(cavity && { cavity: { radius: cavity.radius, depth: cavity.depth } }),
    noseLength: n,
    noseAssumed: nTag === 'approximate',
    bearingLength,
    volume: revolutionVolume(points, L),
    area,
    areaCentreZ,
    ...(tip && { tipStart: tip.tipStart }),
    notes,
  }
}

const fail = (reason: string | ((length: LengthText) => string), ...fields: string[]): Refused => ({
  reason: typeof reason === 'string' ? () => reason : reason,
  fields,
})

/** The base: tail length t, base edge radius rb, rebate depth s, their tags, and what is known. */
interface BaseGeometry {
  t: number
  rb: number
  s: number
  tTag: Tag
  rbTag: Tag
  /** A flat base, or a boat tail of a length not assumed. */
  tailKnown: boolean
  /** The whole base shape is given: tail, base radius, no rebate. */
  baseKnown: boolean
}

/** The boat tail's length t, base edge radius rb, rebate depth s and their tags. */
interface Tail {
  t: number
  rb: number
  s: number
  tTag: Tag
  rbTag: Tag
}

/** What the cases of a boat tail share: the given values, the cone top radius ac, the start. */
interface TailInput {
  gl?: number | undefined
  gd?: number | undefined
  ga?: number | undefined
  ac: number
  given: 'sourced' | 'entered'
  start: Tail
}

const tan = (x: number) => Math.tan(x * deg)

const noBoatTail = (gd: number) =>
  fail((l) => `The base diameter ${l(gd)} leaves no boat tail.`, 'base.diameter', 'diameter')

/** Length and diameter given; the angle, if given too, must agree with them. */
function tailFromLengthDiameter({ ga, ac, given, start }: TailInput, gl: number, gd: number) {
  const rb = gd / 2
  if (!(rb < ac)) return noBoatTail(gd)
  const implied = Math.atan((ac - rb) / gl) / deg
  if (ga !== undefined && Math.abs(implied - ga) > angleTolerance)
    return fail(
      (l) =>
        `The base length ${l(gl)}, base diameter ${l(gd)} and angle ${ga} degrees disagree: length and diameter give ${implied.toFixed(2)} degrees.`,
      'base.angle',
      'base.length',
      'base.diameter',
    )
  return { ...start, t: gl, rb, rbTag: given }
}

function tailFromLengthAngle({ ac, start }: TailInput, gl: number, ga: number) {
  const rb = ac - gl * tan(ga)
  if (!(rb > 0))
    return fail(
      (l) => `The base length ${l(gl)} at ${ga} degrees leaves no base.`,
      'base.length',
      'base.angle',
    )
  return { ...start, t: gl, rb, rbTag: 'derived' as const }
}

function tailFromDiameterAngle({ ac, given, start }: TailInput, gd: number, ga: number) {
  const rb = gd / 2
  if (!(rb < ac)) return noBoatTail(gd)
  return { ...start, rb, rbTag: given, t: (ac - rb) / tan(ga), tTag: 'derived' as const }
}

function tailFromLength({ ac, start }: TailInput, gl: number, a: number, notes: string[]) {
  notes.push(`Boat tail drawn at an assumed ${assumedBoatTailAngle} degree angle.`)
  return { ...start, t: gl, rb: Math.max(ac - gl * tan(assumedBoatTailAngle), 0.5 * a) }
}

function tailFromDiameter({ ac, given, start }: TailInput, gd: number, notes: string[]) {
  const rb = gd / 2
  if (!(rb < ac)) return noBoatTail(gd)
  notes.push(
    `The boat tail length is drawn from the base diameter at an assumed ${assumedBoatTailAngle} degree angle.`,
  )
  return {
    ...start,
    rb,
    rbTag: given,
    t: (ac - rb) / tan(assumedBoatTailAngle),
    tTag: 'approximate' as const,
  }
}

/** The boat tail from the given length, diameter and angle; assumed values are named in `notes`. */
function boatTail(c: TailInput, a: number, notes: string[]): Tail | Refused {
  const { gl, gd, ga } = c
  if (gl !== undefined && gd !== undefined) return tailFromLengthDiameter(c, gl, gd)
  if (gl !== undefined && ga !== undefined) return tailFromLengthAngle(c, gl, ga)
  if (gd !== undefined && ga !== undefined) return tailFromDiameterAngle(c, gd, ga)
  if (gl !== undefined) return tailFromLength(c, gl, a, notes)
  if (gd !== undefined) return tailFromDiameter(c, gd, notes)
  notes.push('The record has no boat tail length: the base is drawn flat.')
  return c.start
}

/** Refusal of a base length, diameter or angle outside what a base can have. */
function baseInputRefusal(d: number, gl?: number, gd?: number, ga?: number) {
  if (gd !== undefined && !(gd > 0 && gd < d))
    return fail(
      (l) => `The base diameter ${l(gd)} is not between 0 and the diameter ${l(d)}.`,
      'base.diameter',
      'diameter',
    )
  if (ga !== undefined && !(ga > 0 && ga < 90))
    return fail(`The boat-tail angle ${ga} degrees is not between 0 and 90.`, 'base.angle')
  if (gl !== undefined && !(gl >= 0))
    return fail('The base length must not be negative.', 'base.length')
}

/** A boat tail or a flat face: a hollow base takes the boat-tail dimensions where it gives any. */
function baseKinds(type: string | undefined, gl?: number, gd?: number, ga?: number) {
  const tailType =
    type === 'boat-tail' ||
    type === 'rebated-boat-tail' ||
    (isHollow(type) && (gl !== undefined || gd !== undefined || ga !== undefined))
  const flatFaced = type === 'flat' || (isHollow(type) && !tailType)
  return { tailType, flatFaced }
}

/** The boat tail of a base type with one, with a rebate's depth where the type has it. */
function shapedTail(
  b: BulletDimensions,
  given: 'sourced' | 'entered',
  start: Tail,
  notes: string[],
): Tail | Refused {
  let s = 0
  if (b.base?.type === 'rebated-boat-tail') {
    s = 0.015 * b.diameter
    notes.push(`The rebate depth is assumed: 0.015 d, ${mm(s)}.`)
  }
  const { length: gl, diameter: gd, angle: ga } = b.base ?? {}
  const a = b.diameter / 2
  const shaped = boatTail({ gl, gd, ga, ac: a - s, given, start: { ...start, s } }, a, notes)
  if ('reason' in shaped) return shaped
  return shaped.t === 0 ? { ...shaped, rb: a, s: 0 } : shaped
}

/** A base without a boat tail: flat, with a note where the record names no flat base. */
function unshapedTail(start: Tail, flatFaced: boolean, gl: number | undefined, notes: string[]) {
  if (!flatFaced)
    notes.push(
      gl === undefined
        ? 'The record has no base type: the base is drawn flat.'
        : `The record gives a base length of ${gl} mm without a base type: the base is drawn flat.`,
    )
  return start
}

/** The base from the base type, length, diameter and angle; assumed values are named in `notes`. */
function baseGeometry(
  b: BulletDimensions,
  given: 'sourced' | 'entered',
  notes: string[],
): BaseGeometry | Refused {
  const { diameter: d, length: L } = b
  const a = d / 2
  // base: tail length t, base edge radius rb, cone top radius ac (below a for a rebate)
  const type = b.base?.type
  const gl = b.base?.length
  const gd = b.base?.diameter
  const ga = b.base?.angle
  const { tailType, flatFaced } = baseKinds(type, gl, gd, ga)
  const refusal = baseInputRefusal(d, gl, gd, ga)
  if (refusal) return refusal
  const start: Tail = { t: 0, rb: a, s: 0, tTag: given, rbTag: flatFaced ? given : 'approximate' }
  const tail = tailType
    ? shapedTail(b, given, start, notes)
    : unshapedTail(start, flatFaced, gl, notes)
  if ('reason' in tail) return tail
  const { t, rb, s, tTag, rbTag } = tail
  if (!(t < L))
    return fail(
      (l) => `The boat tail ${l(t)} is not shorter than the length ${l(L)}.`,
      'base.length',
      'length',
    )
  const tailKnown = flatFaced || (tailType && t > 0 && tTag !== 'approximate')
  const baseKnown = tailKnown && rbTag !== 'approximate' && s === 0
  return { t, rb, s, tTag, rbTag, tailKnown, baseKnown }
}

/**
 * The cavity of a hollow base, from its apex on the axis to its edge on the base face: a cone or a
 * hemisphere whose depth is its radius, the cone at a half angle of 45 degrees. Without a stated
 * depth the shape is assumed, so the cavity is always drawn as an assumed one.
 */
interface Cavity {
  radius: number
  depth: number
  points: SectionPoint[]
}

/** The cavity of a hollow base type with a cavity diameter; none otherwise. */
function cavityGeometry(
  b: BulletDimensions,
  rb: number,
  notes: string[],
): Cavity | Refused | undefined {
  const type = b.base?.type
  if (!isHollow(type)) return
  const cd = b.base?.cavityDiameter
  if (cd === undefined) {
    notes.push('The record has no cavity diameter: the base is drawn without a cavity.')
    return
  }
  const r = cd / 2
  if (!(r > 0 && r < rb))
    return fail(
      (l) => `The cavity diameter ${l(cd)} is not between 0 and the base diameter ${l(2 * rb)}.`,
      'base.cavityDiameter',
      'base.diameter',
      'diameter',
    )
  if (!(r < b.length))
    return fail(
      (l) => `The cavity depth ${l(r)} is not below the length ${l(b.length)}.`,
      'base.cavityDiameter',
      'length',
    )
  const shape = type === 'conical-hollow-base' ? 'cone' : 'hemisphere'
  notes.push(
    `The cavity depth is assumed: a ${shape} as deep as its opening is wide at its radius, ${mm(r)}.`,
  )
  const points: SectionPoint[] =
    type === 'conical-hollow-base'
      ? [
          [0, r],
          [r, 0],
        ]
      : Array.from({ length: steps + 1 }, (_, j) =>
          j === steps
            ? [r, 0]
            : [
                r * Math.sin(((j / steps) * Math.PI) / 2),
                r * Math.cos(((j / steps) * Math.PI) / 2),
              ],
        )
  return { radius: r, depth: r, points }
}

/** The nose length n: given, else the length less tail and bearing, else assumed. */
function noseLengthOf(
  b: BulletDimensions,
  { t, tailKnown }: BaseGeometry,
  notes: string[],
): { n: number; nTag: Tag } | Refused {
  const { diameter: d, length: L } = b
  const bearing = b.bearingLength
  if (b.noseLength !== undefined) {
    const n = b.noseLength
    if (!(n > 0)) return fail('The nose length must be positive.', 'noseLength')
    if (n > L - t + 1e-9)
      return fail(
        (l) => `The nose length ${l(n)} is above the length less the boat tail, ${l(L - t)}.`,
        'noseLength',
        'length',
        'base.length',
      )
    if (bearing !== undefined && tailKnown && Math.abs(t + bearing + n - L) > lengthTolerance)
      return fail(
        (l) =>
          `Boat tail ${l(t)}, bearing ${l(bearing)} and nose ${l(n)} do not add up to the length ${l(L)}.`,
        'noseLength',
        'bearingLength',
        'length',
        'base.length',
      )
    return { n, nTag: 'derived' }
  }
  if (bearing !== undefined && tailKnown) {
    const n = L - t - bearing
    if (!(n > 0))
      return fail(
        (l) => `Boat tail ${l(t)} and bearing ${l(bearing)} leave no nose of the length ${l(L)}.`,
        'bearingLength',
        'length',
        'base.length',
      )
    return { n, nTag: 'derived' }
  }
  const n = Math.min(Math.min(2 * d, 0.6 * L), L - t)
  notes.push(
    `The record has no nose length: an assumed nose of ${n.toFixed(2)} mm is drawn and no jump is given.`,
  )
  return { n, nTag: 'approximate' }
}

/** The meplat radius m: given, else a share of the diameter for a flat nose or a flat tip. */
function meplatRadius(
  b: BulletDimensions,
  given: 'sourced' | 'entered',
  notes: string[],
): { m: number; mTag: Tag } | Refused {
  const d = b.diameter
  const form = b.ogive?.form
  const tipType = b.tip?.type ?? ''
  const md = b.meplatDiameter
  if (md !== undefined) {
    if (!(md >= 0 && md < d))
      return fail(
        (l) => `The meplat diameter ${l(md)} is not below the diameter ${l(d)}.`,
        'meplatDiameter',
        'diameter',
      )
    return { m: md / 2, mTag: given }
  }
  const share = form === 'flat-nose' ? 0.6 : flatTips.has(tipType) ? 0.15 : 0
  if (share) notes.push(`The meplat is assumed: ${share} d.`)
  return { m: (share * d) / 2, mTag: 'approximate' }
}

/** The nose curve r(z) over [z0, L], its sample z values, extra z values the samples must hit. */
interface NoseCurve {
  rAt: (z: number) => number
  zs: number[]
  extra: [number, Tag][]
  formTag: Tag
}

/** Refusal of an ogive radius or Rt/R that is out of range or disagrees with the other. */
function ogiveInputRefusal(
  radius: number | undefined,
  ratio: number | undefined,
  fromRadius: number | undefined,
) {
  if (radius !== undefined && !(radius > 0))
    return fail('The ogive radius must be positive.', 'ogive.radius')
  if (ratio !== undefined && !(ratio >= 0 && ratio <= 1))
    return fail(`Rt/R ${ratio} is not between 0 and 1.`, 'ogive.radiusRatio')
  if (
    ratio !== undefined &&
    fromRadius !== undefined &&
    Math.abs(ratio - fromRadius) > ratioTolerance
  )
    return fail(
      (l) =>
        `The ogive radius ${l(radius as number)} gives Rt/R ${fromRadius.toFixed(3)}, not the given ${ratio}.`,
      'ogive.radiusRatio',
      'ogive.radius',
    )
}

/**
 * The Rt/R an ogive nose is drawn with (at most 1, 1 a tangent ogive) and the tag of its form;
 * assumed values are named in `notes`.
 */
function ogiveRatio(
  form: string | undefined,
  given: number | undefined,
  { n, k, rt }: { n: number; k: number; rt: number },
  notes: string[],
): { used: number; formTag: Tag } | Refused {
  let q = given
  let formTag: Tag = 'derived'
  if (q !== undefined && q > 1 + ratioTolerance)
    return fail(
      (l) =>
        `The ogive radius is below the tangent radius ${l(rt)}: the nose would rise above the shank.`,
      'ogive.radius',
      'ogive.radiusRatio',
      'noseLength',
    )
  if (form === 'tangent' && q !== undefined && Math.abs(q - 1) > ratioTolerance)
    return fail(
      `A tangent ogive has Rt/R 1, not ${q.toFixed(3)}.`,
      'ogive.radiusRatio',
      'ogive.radius',
      'ogive.form',
    )
  if (form === undefined && q === undefined) {
    formTag = 'approximate'
    notes.push('The nose is drawn as an assumed tangent ogive.')
  }
  if ((form === 'secant' || form === 'hybrid') && q === undefined) {
    q = 0.5
    formTag = 'approximate'
    notes.push(`The ${form} ogive radius is assumed: Rt/R 0.5.`)
  }
  q = Math.min(q ?? 1, 1)
  if (q > 0 && n < k - 1e-9)
    return fail(
      (l) =>
        `The nose length ${l(n)} is below its radial drop ${l(k)}: no ogive reaches the meplat.`,
      'noseLength',
      'meplatDiameter',
    )
  return { used: q, formTag }
}

/** The circle arc through `o` of radius `r` as r(z). */
const arcAt = (o: SectionPoint, r: number) => (z: number) =>
  o[0] + Math.sqrt(Math.max(r ** 2 - (z - o[1]) ** 2, 0))

/** What a hybrid nose reads: the length, shank radius, shank end z0, meplat radius m, tangent radius rt, ogive radius R. */
interface NoseFrame {
  L: number
  a: number
  z0: number
  m: number
  rt: number
  R: number
}

/** A blend arc tangent to the shank, then a secant arc of radius R tangent to it through the meplat edge. */
function hybridNose(
  { L, a, z0, m, rt, R }: NoseFrame,
  zSteps: number[],
  formTag: Tag,
  notes: string[],
): NoseCurve | Refused {
  const r1 = rt / 2
  const c1: SectionPoint = [a - r1, z0]
  const D: SectionPoint = [m - c1[0], L - c1[1]]
  const dl = Math.hypot(...D)
  const delta = R - r1
  const g = (R ** 2 - delta ** 2 - dl ** 2) / (2 * delta)
  const theta = Math.atan2(D[1], D[0]) - Math.acos(g / dl)
  const c2: SectionPoint = [c1[0] - delta * Math.cos(theta), c1[1] - delta * Math.sin(theta)]
  const tz = z0 + r1 * Math.sin(theta)
  if (!(Math.abs(g) <= dl && theta > 0 && theta < Math.PI / 2 && tz < L && m >= c2[0] - 1e-9))
    return fail(
      'No hybrid nose joins the blend arc and the secant arc before the meplat.',
      'ogive.radius',
      'ogive.radiusRatio',
      'noseLength',
    )
  const blend = arcAt(c1, r1)
  const secant = arcAt(c2, R)
  notes.push('The hybrid blend radius is assumed: half the tangent radius.')
  return {
    rAt: (z) => (z <= tz ? blend(z) : secant(z)),
    zs: zSteps,
    extra: [[tz, 'approximate']],
    formTag,
  }
}

/**
 * The nose curve from the shank end at z0 = L - n to the meplat edge at radius m: a round nose,
 * a cone, a secant or tangent ogive of radius R = Rt / (Rt/R), or a hybrid of a blend arc and a
 * secant arc.
 */
function noseCurve(
  b: BulletDimensions,
  n: number,
  m: number,
  notes: string[],
): NoseCurve | Refused {
  const L = b.length
  const a = b.diameter / 2
  const z0 = L - n
  const form = b.ogive?.form
  const k = a - m
  const rt = (n ** 2 + k ** 2) / (2 * k)
  const radius = b.ogive?.radius
  const ratio = b.ogive?.radiusRatio
  const fromRadius = radius === undefined ? undefined : rt / radius
  const refusal = ogiveInputRefusal(radius, ratio, fromRadius)
  if (refusal) return refusal
  const q = ratio ?? fromRadius
  if (form === 'round-nose' || form === 'flat-nose') {
    if (q !== undefined) notes.push(`A ${form} reads no ogive radius or Rt/R.`)
    return {
      rAt: (z) => m + k * Math.sqrt(Math.max(1 - ((z - z0) / n) ** 2, 0)),
      zs: Array.from(
        { length: steps },
        (_, j) => z0 + n * Math.sin(((j + 1) * Math.PI) / 2 / steps),
      ),
      extra: [],
      formTag: 'derived',
    }
  }
  const ogive = ogiveRatio(form, q, { n, k, rt }, notes)
  if ('reason' in ogive) return ogive
  const { used, formTag } = ogive
  const zSteps = Array.from({ length: steps }, (_, j) => z0 + (n * (j + 1)) / steps)
  // a vanishing Rt/R is the cone; a secant circle of radius near 1e12 mm loses precision
  if (used < 1e-6) return { rAt: (z) => a - (k * (z - z0)) / n, zs: zSteps, extra: [], formTag }
  // circle of radius R through the shank end and the meplat edge, centre on the axis side
  const R = rt / used
  if (form === 'hybrid') return hybridNose({ L, a, z0, m, rt, R }, zSteps, formTag, notes)
  const c = Math.hypot(k, n)
  const h = Math.sqrt(Math.max(R ** 2 - c ** 2 / 4, 0))
  const centre: SectionPoint = [a - k / 2 - (h * n) / c, z0 + n / 2 - (h * k) / c]
  return { rAt: arcAt(centre, R), zs: zSteps, extra: [], formTag }
}

/** Where a polymer tip leaves the jacket, with the tag of that sample; none without a polymer tip. */
function tipSplit(
  b: BulletDimensions,
  n: number,
  noseTag: Tag,
  notes: string[],
): { tipStart: number; tag: Tag } | Refused | undefined {
  if (b.tip?.type !== 'polymer-tip') return
  const tl = b.tip.length ?? 0.2 * n
  if (!(tl > 0 && tl < n))
    return fail(
      (l) => `The polymer tip length ${l(tl)} is not below the nose length ${l(n)}.`,
      'tip.length',
      'noseLength',
    )
  if (b.tip.length === undefined) notes.push('The polymer tip length is assumed: 0.2 nose length.')
  return { tipStart: b.length - tl, tag: b.tip.length === undefined ? 'approximate' : noseTag }
}

/** The hollow-point mouth radius on the meplat line, 0 without a hollow point. */
function hollowPointMouth(
  b: BulletDimensions,
  m: number,
  given: 'sourced' | 'entered',
  notes: string[],
): { mouth: number; mouthTag: Tag } | Refused {
  let mouth = 0
  let mouthTag: Tag = given
  if (b.tip?.type === 'hollow-point') {
    if (b.tip.mouthDiameter !== undefined) mouth = b.tip.mouthDiameter / 2
    else {
      mouth = 0.5 * m
      mouthTag = 'approximate'
      if (m > 0) notes.push('The hollow-point mouth is assumed: 0.5 meplat.')
    }
    if (mouth > m + 1e-9)
      return fail(
        (l) => `The hollow-point mouth ${l(2 * mouth)} is wider than the meplat ${l(2 * m)}.`,
        'tip.mouthDiameter',
        'meplatDiameter',
      )
  }
  return { mouth, mouthTag }
}

/** A cannelure on the shank: rear edge z, axial width, radial depth, whether the depth is assumed. */
interface Groove {
  start: number
  width: number
  depth: number
  assumed: boolean
}

/** The cannelure, which must lie on the shank between t and z0; none without one. */
function cannelureGeometry(
  b: BulletDimensions,
  t: number,
  z0: number,
  notes: string[],
): Groove | Refused | undefined {
  const cn = b.cannelure
  if (!cn) return
  const groove = {
    start: cn.start,
    width: cn.width,
    depth: cn.depth ?? 0.02 * b.diameter,
    assumed: cn.depth === undefined,
  }
  if (!(groove.width > 0 && groove.depth > 0 && groove.depth < b.diameter / 2))
    return fail(
      'The cannelure needs a positive width and a depth below the radius.',
      'cannelure.width',
      'cannelure.depth',
    )
  if (groove.start < t + 1e-9 || groove.start + groove.width > z0 + 1e-9)
    return fail(
      (l) => `The cannelure is not on the shank between ${l(t)} and ${l(z0)}.`,
      'cannelure.start',
      'cannelure.width',
    )
  if (groove.assumed) notes.push('The cannelure depth is assumed: 0.02 d.')
  return groove
}

/** The parts of an outline, in mm, each with the tag of its values. */
interface Parts {
  given: 'sourced' | 'entered'
  /** Radius of the shank. */
  a: number
  L: number
  base: BaseGeometry
  cavity?: Cavity | undefined
  groove?: Groove | undefined
  z0: number
  nTag: Tag
  noseTag: Tag
  /** The nose sample z values with their tags. */
  samples: Map<number, Tag>
  rAt: (z: number) => number
  m: number
  mTag: Tag
  mouth: number
  mouthTag: Tag
}

/** Adds a point with its tag and whether the edge reaching it is approximate. */
type AddPoint = (p: SectionPoint, tag: Tag, approx: boolean) => void

/** A cavity's wall runs down from its apex to the base face: the profile starts on the axis at the apex. */
function addBottom({ given, cavity }: Parts, add: AddPoint) {
  if (!cavity) {
    add([0, 0], given, false)
    return
  }
  for (const [j, p] of cavity.points.entries())
    add(p, j === cavity.points.length - 1 ? given : 'approximate', j > 0)
}

/** The base edge and, past it, the boat tail's end and a rebate's step. */
function addTail({ a, base }: Parts, add: AddPoint) {
  const { t, rb, s, tTag, rbTag } = base
  const baseApprox = !base.baseKnown
  add([rb, 0], rbTag, baseApprox)
  if (t <= 0) return
  add([a - s, t], s > 0 ? 'approximate' : tTag, baseApprox)
  if (s > 0) add([a, t], tTag, baseApprox)
}

function addGroove({ given, a, groove }: Parts, add: AddPoint) {
  if (!groove) return
  const gTag = groove.assumed ? 'approximate' : given
  const z1 = groove.start + groove.width
  add([a, groove.start], given, false)
  add([a - groove.depth, groove.start], gTag, gTag === 'approximate')
  add([a - groove.depth, z1], gTag, gTag === 'approximate')
  add([a, z1], given, gTag === 'approximate')
}

/** The nose samples up to the tip. */
function addNose({ L, z0, noseTag, samples, rAt, m, mTag }: Parts, add: AddPoint) {
  const noseApprox = noseTag === 'approximate'
  for (const z of [...samples.keys()].sort((x, y) => x - y)) {
    if (z <= z0) continue
    const atTip = z >= L - 1e-12
    add(atTip ? [m, L] : [rAt(z), z], atTip ? mTag : (samples.get(z) as Tag), noseApprox)
    if (atTip) break
  }
}

/** The hollow-point mouth and the meplat's centre on the meplat line. */
function addMeplat({ L, given, m, mTag, mouth, mouthTag }: Parts, add: AddPoint) {
  if (mouth > 0 && mouth < m)
    add([mouth, L], mouthTag, mTag === 'approximate' || mouthTag === 'approximate')
  if (m > 0) add([0, L], given, mTag === 'approximate')
}

/** Stroked runs of the points: consecutive edges of the same kind share one run. */
function strokedRuns(points: SectionPoint[], edges: boolean[]) {
  const segments: Outline['segments'] = []
  for (const [k, [prev, p]] of pairs(points).entries()) {
    const approximate = edges[k + 1] ?? false
    const last = segments[segments.length - 1]
    if (last && last.approximate === approximate) last.points.push(p)
    else segments.push({ points: [prev, p], approximate })
  }
  return segments
}

/**
 * The outline points from the base centre (or the apex of the cavity) to the tip on the axis, each
 * with its tag and whether the edge reaching it is approximate, the stroked runs, the z ranges
 * drawn from an assumed shape and the index of the base face's edge.
 */
function assemblePoints(parts: Parts) {
  const { a, L, base, groove, z0, nTag, noseTag } = parts
  const { t } = base
  const points: SectionPoint[] = []
  const tags: Tag[] = []
  const edges: boolean[] = []
  const add: AddPoint = (p, tag, approx) => {
    points.push(p)
    tags.push(tag)
    edges.push(approx)
  }
  const baseApprox = !base.baseKnown
  addBottom(parts, add)
  const baseEdge = points.length
  addTail(parts, add)
  addGroove(parts, add)
  const tip = points[points.length - 1]
  if (tip && (tip[1] < z0 || tip[0] < a))
    add([a, z0], nTag === 'approximate' ? 'approximate' : 'derived', false)
  addNose(parts, add)
  addMeplat(parts, add)

  const segments = strokedRuns(points, edges)
  const noseApprox = noseTag === 'approximate'
  // an assumed base stands in for an unknown base shape, so it taints the shank up to the nose
  const approximate: [number, number][] = [
    ...(baseApprox ? [[0, t || z0] as [number, number]] : []),
    ...(groove?.assumed ? [[groove.start, groove.start + groove.width] as [number, number]] : []),
    ...(noseApprox ? [[z0, L] as [number, number]] : []),
  ]
  return { points, tags, segments, approximate, baseEdge }
}

/** Area of the full axial section, mm², and the z of its centre, mm, of a half profile closed along the axis. */
function sectionProperties(points: SectionPoint[]) {
  let half = 0
  let moment = 0
  for (const [[r0, za], [r1, zb]] of closedEdges(points)) {
    const cross = za * r1 - zb * r0
    half += cross / 2
    moment += ((za + zb) * cross) / 6
  }
  return { area: 2 * Math.abs(half), areaCentreZ: moment / half }
}

/**
 * Volume of the solid of revolution of a half profile closed along the axis, from z = 0 to `cut`,
 * mm³: each segment adds its frustum going up and takes it off going down, so the wall of a
 * cavity subtracts.
 */
export function revolutionVolume(points: SectionPoint[], cut: number): number {
  let v = 0
  for (const [p, q] of pairs(points)) {
    const up = p[1] < q[1]
    const [[r0, z0], [r1, z1]] = up ? [p, q] : [q, p]
    if (z1 <= z0 || z0 >= cut) continue
    const z = Math.min(z1, cut)
    const r = r0 + ((r1 - r0) * (z - z0)) / (z1 - z0)
    v += ((up ? 1 : -1) * (Math.PI * (z - z0) * (r0 ** 2 + r0 * r + r ** 2))) / 3
  }
  return v
}

/** Whether the bullet below `cut` mm rests on an assumed shape: an assumed range or a cavity. */
export const assumedBelow = (o: Outline, cut: number): boolean =>
  (o.cavity !== undefined && cut > 0) || o.approximate.some(([z0, z1]) => z1 > z0 && z0 < cut)
