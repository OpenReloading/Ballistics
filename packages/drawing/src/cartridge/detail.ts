import type { Dimension, SectionPoint } from '../core/types.ts'
import { pairs } from '../core/vector.ts'
import type { Side } from './figures.ts'
import type { Profile } from './profile.ts'

/** A detail view of one side: A the head (rim, groove, belt, recess), B the chamber throat. */
export interface DetailSpec {
  letter: 'A' | 'B'
  side: Side
  /** The feature region in the half section, mm: r0, z0, r1, z1. */
  region: [number, number, number, number]
  /** The point the main view's letter marks and a cut window keeps. */
  anchor: SectionPoint
  /** The outline segments of the region that must reach a size in px: mm and px wanted. */
  sizes: { mm: number; px: number }[]
}

/** Allowed enlargement factors of a detail view over the main view. */
const detailScales = [2, 5, 10, 20, 50]
/** The largest window at the detail scale, mm: along the axis and across it. */
const detailWindowCap = { along: 32, across: 20 }
/** Room around the region at the detail scale, mm. */
export const detailMargin = 3

const symbolsOf = ({ annotation: a }: Profile) =>
  new Set([...a.dimensions, ...a.angles].map((d) => d.symbol))

/**
 * The details of a side, each only where the side stores its values: A where E, e, R, E1 or delta
 * is dimensioned, B on the chamber where G1 is, with F and i or with h or s.
 */
export function detailSpecs(side: Side, p: Profile): DetailSpec[] {
  const has = symbolsOf(p)
  const at = (symbol: string) => p.annotation.dimensions.find((d) => d.symbol === symbol)
  return [headDetail(side, p, has, at), throatDetail(side, p, has, at)].filter(
    (d): d is DetailSpec => d !== undefined,
  )
}

type DimensionOf = (symbol: string) => Dimension | undefined

/** Detail A, the head, where E, e, R, E1 or delta is dimensioned. */
function headDetail(
  side: Side,
  p: Profile,
  has: Set<string>,
  at: DimensionOf,
): DetailSpec | undefined {
  const zP1 = at('P1')?.from
  if (!['E', 'e', 'R', 'E1', 'delta'].some((s) => has.has(s)) || zP1 === undefined) return
  const head = p.points.slice(1).filter(([, z]) => z <= zP1 + 1e-9)
  const sizes = segments(head)
  const r = (symbol: string) => at(symbol)?.radius
  const [R1, E1, R3, P1] = ['R1', 'E1', 'R3', 'P1'].map(r)
  const [R, E] = ['R', 'E'].map((s) => at(s)?.to)
  // grooves and belts at least 6 px: the groove depth and its length to E, the belt step and
  // length
  if (side === 'cartridge' && [R1, E1, R, E].every((x) => x !== undefined)) {
    sizes.push({
      mm: Math.min((R1 as number) - (E1 as number), (E as number) - (R as number)),
      px: 6,
    })
    const belt = head.find(([pr]) => R3 !== undefined && Math.abs(pr - R3) < 1e-9)
    if (belt && P1 !== undefined)
      sizes.push({ mm: Math.min((R3 as number) - P1, (E as number) - belt[1]), px: 6 })
  }
  // the chamber recess step to P1 at its depth, else the head corner
  const step = side === 'chamber' ? head.findLast(([, z]) => z > 0) : undefined
  const anchor = step ?? head[Math.floor(head.length / 2)]
  if (!anchor) return
  return { letter: 'A', side, region: box(head), anchor, sizes }
}

/** Detail B, the chamber throat, where G1 is dimensioned with F and i or with h or s. */
function throatDetail(
  side: Side,
  p: Profile,
  has: Set<string>,
  at: DimensionOf,
): DetailSpec | undefined {
  const { angles, conventions } = p.annotation
  const throat = has.has('F') && has.has('i')
  if (side !== 'chamber' || !at('G1') || !(throat || has.has('h') || has.has('s'))) return
  const L3 = at('H2')?.from as number
  // from H2 at L3 to the leade start (or the G1 stub, or the step at the leade end)
  const z1 =
    angles.find((a) => a.symbol === 'i')?.vertex[1] ??
    conventions.find((c) => c.kind === 'g1Stub')?.from ??
    at('F')?.from ??
    L3
  const part = p.points.filter(([, z]) => z >= L3 - 1e-9 && z <= z1 + 1e-9)
  const anchor = part[0]
  if (!anchor) return
  return { letter: 'B', side, region: box(part), anchor, sizes: segments(part) }
}

const box = (points: SectionPoint[]): DetailSpec['region'] => [
  Math.min(...points.map(([r]) => r)),
  Math.min(...points.map(([, z]) => z)),
  Math.max(...points.map(([r]) => r)),
  Math.max(...points.map(([, z]) => z)),
]

/** Every outline segment of at least 0.01 mm at 1 px; shorter ones are the rounding of the values. */
const segments = (points: SectionPoint[]) =>
  pairs(points)
    .map(([[pr, pz], [r, z]]) => Math.hypot(r - pr, z - pz))
    .filter((mm) => mm >= 0.01 - 1e-9)
    .map((mm) => ({ mm, px: 1 }))

/**
 * The scale k of a detail and its window at that scale (mm, the half section times k: r0, z0, r1,
 * z1): the largest k at which the region with its margin fits the cap, raised to the smallest k
 * at which every size reaches its px at `pxPerMm` of the main view; a window over the cap is cut
 * about the anchor.
 */
export function detailWindow(spec: DetailSpec, pxPerMm: number, across = detailWindowCap.across) {
  const [r0, z0, r1, z1] = spec.region
  const fits = (k: number) =>
    (z1 - z0) * k + 2 * detailMargin <= detailWindowCap.along &&
    (r1 - r0) * k + 2 * detailMargin <= across
  const kFit = detailScales.findLast(fits) ?? Math.min(...detailScales)
  const kNeed =
    detailScales.find((k) => spec.sizes.every(({ mm, px }) => mm * k * pxPerMm >= px)) ??
    Math.max(...detailScales)
  const k = Math.max(kFit, kNeed)
  const cut = (lo: number, hi: number, at: number, room: number): [number, number] => {
    const [a, b] = [lo * k - detailMargin, hi * k + detailMargin]
    if (b - a <= room) return [a, b]
    const from = Math.min(Math.max(at * k - room / 2, a), b - room)
    return [from, from + room]
  }
  const [wr0, wr1] = cut(r0, r1, spec.anchor[0], across)
  const [wz0, wz1] = cut(z0, z1, spec.anchor[1], detailWindowCap.along)
  return { scale: k, window: [wr0, wz0, wr1, wz1] as [number, number, number, number] }
}
