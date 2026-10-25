import * as face from './face.ts'
import {
  arrowheadCorners,
  boxesOverlap,
  labelCorners,
  polygonsOverlap,
  segHitsBox,
  segsCross,
} from './geometry.ts'
import { headFace, type PartPoint, radiusAt, steelBand } from './section.ts'
import { textWidth } from './text.ts'
import type { Arc, Arrowhead, Label, Layout, LineSegment, Part } from './types.ts'
import { add, unit } from './vector.ts'

/** One place to try for a text, with the lines, arrowheads, arc and diameter tips it brings. */
export type Candidate = {
  l: Label
  segs?: LineSegment[]
  tips?: Arrowhead[]
  arc?: Arc
  across?: Layout['diameterTips'][number]
}

/** Adds a conflict's weight, true once the count reaches the limit. */
type Hit = (weight?: number) => boolean

/** What the steps of one layout share: the face at its text size, what is placed, the choice. */
export type Placer = ReturnType<typeof createPlacer>

/**
 * The placer of one side at text size `em` (mm) in the part frame: the face distances at that
 * size, the texts, lines and arrowheads placed so far (from the axis line over `axis`), and the
 * count of what a candidate runs into. `keepCorners` makes a diameter arrowhead in a radius
 * corner's room cost a little.
 */
export function createPlacer(
  part: Part,
  em: number,
  horizontal: PartPoint,
  axis: [number, number],
  keepCorners: boolean,
) {
  const { points, annotation, unit: lengthUnit } = part
  const k = em / face.baseEm
  const [lane0, pitch] = [face.firstLaneOffset * k, face.lanePitch * k]
  const arrowLen = face.arrow.length
  const tailLen = face.arrowTailLengths * arrowLen
  const rPart = Math.max(...points.map(([r]) => r))
  const rMax = part.outer ?? rPart
  const zMax = Math.max(...points.map(([, z]) => z))
  const zBreak = zMax + face.breakAllowance * zMax
  const labels: Label[] = []
  const segs: LineSegment[] = [{ a: [axis[0], 0], b: [axis[1], 0], kind: 'thin', owner: 'axis' }]
  const arcs: Arc[] = []
  const tips: Arrowhead[] = []
  const across: Layout['diameterTips'] = []
  const spans: Layout['spans'] = []
  const gap = 0.12 * em

  /** Where an extension line at z starts: the axis past the part, else the steel edge or the outline. */
  const start = (z: number) =>
    z > zMax + 1e-9
      ? face.extensionGap
      : (part.outer ?? radiusAt(points, Math.max(z, 0)) ?? rPart) + face.extensionGap

  const label = (text: string, c: PartPoint, dir: PartPoint, owner: string): Label => ({
    text,
    c,
    dir,
    w: textWidth(text, em),
    h: em,
    owner,
  })
  // texts keep off the outline, the edge lines, the steel band edge and the break line too
  const edgeSegs = annotation.edges.map((z): LineSegment => {
    const r = radiusAt(points, z) ?? rPart
    return { a: [z, -r], b: [z, r], kind: 'thin', owner: 'outline' }
  })
  const breakSegs: LineSegment[] =
    part.outer === undefined
      ? []
      : steelBand(points, em).sides.flatMap(({ zig }) =>
          zig
            .slice(1)
            .map((b, n): LineSegment => ({ a: zig[n], b, kind: 'thin', owner: 'outline' })),
        )
  const head = part.outer === undefined ? undefined : headFace(points, annotation)
  const outlineSegs: LineSegment[] = [
    ...edgeSegs,
    ...breakSegs,
    ...(head ? [{ a: head[0], b: head[1], kind: 'thin' as const, owner: 'outline' }] : []),
    ...[1, -1].flatMap((sign) => [
      ...points.slice(1).map(
        ([r, z], n): LineSegment => ({
          a: [points[n][1], sign * points[n][0]],
          b: [z, sign * r],
          kind: 'thin',
          owner: 'outline',
        }),
      ),
      ...(part.outer === undefined
        ? []
        : [
            {
              a: [0, sign * part.outer] as PartPoint,
              b: [zMax, sign * part.outer] as PartPoint,
              kind: 'thin' as const,
              owner: 'outline',
            },
          ]),
    ]),
  ]
  const angleSymbols = new Set(annotation.angles.map((a) => a.symbol))
  const radiusSymbols = new Set(
    part.outer === undefined ? [] : annotation.radii.map((r) => r.symbol),
  )
  /** In the material (the case, or the steel band; the chamber cavity is open), where only angle texts go. */
  const inside = ([x, y]: PartPoint) => {
    const r = radiusAt(points, x)
    if (r === undefined) return false
    return part.outer === undefined ? Math.abs(y) < r : Math.abs(y) > r && Math.abs(y) < part.outer
  }
  const leaderLength = face.radiusLeaderLength * k
  /**
   * What a radius leader costs: each line of another dimension, the outline or the axis it crosses
   * from 0.4 of the face's leader on (the lines dimensioning its corner, such as a diameter beside
   * it, pass nearer), and each face's leader of length past the first. Across the axis its text
   * would sit at the mirrored corner: that weighs as 50 crossings, a last resort. (Weighing the
   * crossings of angle leaders moves angle texts far out and widens the drawing.)
   */
  const crossings = (s: LineSegment, from: PartPoint) => {
    let crossed = 0
    for (const list of [outlineSegs, segs])
      for (const o of list) if (o.owner !== s.owner && segsCross(from, s.b, o.a, o.b)) crossed++
    return crossed
  }
  const leaderCost = (s: LineSegment) => {
    const length = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])
    const skip = 0.4 * leaderLength
    const from = add(s.a, unit(s.a, s.b), skip)
    const crossed = length > skip ? crossings(s, from) : 0
    const across = s.a[1] * s.b[1] < 0 ? 50 : 0
    return crossed + across + Math.max(0, length / leaderLength - 1)
  }
  /** A candidate's radius leaders, weighed below one text conflict. */
  const leaderCosts = (own: LineSegment[] = []) =>
    own.reduce(
      (sum, s) => sum + (s.leader && !angleSymbols.has(s.owner) ? leaderCost(s) / 100 : 0),
      0,
    )
  // the room a radius arrowhead needs at its corner, whichever way its leader runs
  const cornerRoom = annotation.radii.flatMap((c) =>
    [1, -1].map((side) => {
      const [z, r, a] = [c.corner[1], side * c.corner[0], arrowLen]
      return {
        owner: c.symbol,
        box: [
          [z - a, r - a],
          [z + a, r - a],
          [z + a, r + a],
          [z - a, r + a],
        ] as PartPoint[],
      }
    }),
  )
  /**
   * The diameters are placed before the radii: each arrowhead from outside in another's corner
   * room costs 0.01, below any conflict, so a clear place off the corner or arrows from inside
   * win, and the radius keeps its short leader (which mostly runs outside the material).
   */
  const cornerCosts = ({ across, tips: own = [] }: Candidate) =>
    across
      ? own.filter(
          (t) =>
            t.dir[1] * t.at[1] < 0 &&
            cornerRoom.some(
              (c) => c.owner !== t.owner && polygonsOverlap(corners(t), c.box, gap / 2),
            ),
        ).length / 100
      : 0
  const cornersOf = new WeakMap<Label | Arrowhead, PartPoint[]>()
  const corners = (x: Label | Arrowhead) => {
    const known = cornersOf.get(x)
    if (known) return known
    const c = 'at' in x ? arrowheadCorners(x) : labelCorners(x)
    cornersOf.set(x, c)
    return c
  }
  const hitsOutline = (l: Label, hit: Hit) =>
    outlineSegs.some((s) => segHitsBox(s, l, gap / 2) && hit())
  const hitsLabels = (l: Label, hit: Hit) => labels.some((m) => boxesOverlap(l, m, gap) && hit())
  const hitsLines = (l: Label, hit: Hit) =>
    segs.some(
      (s) =>
        s.owner !== l.owner &&
        // the axis may run through an angle text, as it does through the arc
        !(s.owner === 'axis' && angleSymbols.has(l.owner)) &&
        segHitsBox(s, l, gap / 2) &&
        hit(),
    )
  const hitsOwnLines = (own: LineSegment[], hit: Hit) =>
    own.some((s) => labels.some((m) => m.owner !== s.owner && segHitsBox(s, m, gap / 2)) && hit())
  const hitsTips = (l: Label, box: PartPoint[], hit: Hit) =>
    tips.some((t) => t.owner !== l.owner && polygonsOverlap(corners(t), box, gap / 2) && hit())
  const crossesOtherArc = (s: LineSegment, hit: Hit) =>
    segs.some(
      (o) =>
        o.kind === 'rule' &&
        o.owner !== s.owner &&
        angleSymbols.has(o.owner) &&
        segsCross(s.a, s.b, o.a, o.b) &&
        hit(),
    )
  // an angle text keeps off its own arc, flank and arrowheads, its arc off another angle's
  const hitsAngle = (
    l: Label,
    own: LineSegment[],
    ownTips: Arrowhead[],
    box: PartPoint[],
    hit: Hit,
  ) => {
    for (const s of own) {
      if (s.leader) continue
      if (segHitsBox(s, l, gap / 2) && hit()) return true
      // arcs only: the flanks of two angles may meet at a shared corner
      if (s.kind === 'rule' && crossesOtherArc(s, hit)) return true
    }
    return ownTips.some((t) => polygonsOverlap(corners(t), box, gap / 2) && hit())
  }
  const hitsOwnTips = (ownTips: Arrowhead[], hit: Hit) =>
    ownTips.some((t) => {
      const tri = corners(t)
      return (
        labels.some(
          (m) => m.owner !== t.owner && polygonsOverlap(tri, corners(m), gap / 2) && hit(),
        ) ||
        tips.some(
          (u) => u.owner !== t.owner && polygonsOverlap(tri, corners(u), gap / 2) && hit(0.5),
        )
      )
    })
  /**
   * How many texts, lines and arrowheads a candidate runs into, 0 clear; counted up to `limit`.
   * Arrowheads count against texts, so no text hides under one, and against each other at half
   * weight, so two dimensions' arrowheads do not merge into one shape where a text stays clear.
   */
  const textConflicts = (
    { l, segs: own = [], tips: ownTips = [] }: Candidate,
    limit = Infinity,
  ) => {
    let n = angleSymbols.has(l.owner) || radiusSymbols.has(l.owner) || !inside(l.c) ? 0 : 10
    const hit: Hit = (weight = 1) => {
      n += weight
      return n >= limit
    }
    if (n >= limit) return n
    const box = corners(l)
    const stages = [
      () => hitsOutline(l, hit),
      () => hitsLabels(l, hit),
      () => hitsLines(l, hit),
      () => hitsOwnLines(own, hit),
      () => hitsTips(l, box, hit),
      () => angleSymbols.has(l.owner) && hitsAngle(l, own, ownTips, box, hit),
      () => hitsOwnTips(ownTips, hit),
    ]
    stages.some((stage) => stage())
    return n
  }
  const conflicts = (c: Candidate) => textConflicts(c) + leaderCosts(c.segs)
  const placements: { candidates: Candidate[]; chosen: Candidate }[] = []
  /** The first candidate that runs into nothing, else the one that runs into least; commits it. */
  const pick = (candidates: Candidate[]) => {
    let chosen = candidates[0]
    let least = Infinity
    for (const c of candidates) {
      const soft = leaderCosts(c.segs) + (keepCorners ? cornerCosts(c) : 0)
      if (soft >= least) continue
      const n = textConflicts(c, least - soft) + soft
      if (n < least) [chosen, least] = [c, n]
      if (n === 0) break
    }
    return chosen
  }
  const commit = (c: Candidate) => {
    labels.push(c.l)
    segs.push(...(c.segs ?? []))
    tips.push(...(c.tips ?? []))
  }
  const uncommit = (c: Candidate) => {
    const own = new Set<unknown>([c.l, ...(c.segs ?? []), ...(c.tips ?? [])])
    for (const list of [labels, segs, tips] as unknown[][])
      list.splice(0, list.length, ...list.filter((x) => !own.has(x)))
  }
  const place = (candidates: Candidate[]) => {
    const chosen = pick(candidates)
    commit(chosen)
    placements.push({ candidates, chosen })
  }
  const arrowAt = (at: PartPoint, dir: PartPoint, owner: string) => tips.push({ at, dir, owner })

  /** A rule from a to b with arrows at both ends, outside on tails when short. */
  const rule = (a: PartPoint, b: PartPoint, owner: string, outside: boolean) => {
    const u = unit(a, b)
    if (outside) {
      segs.push({ a: add(a, u, -tailLen), b: add(b, u, tailLen), kind: 'rule', owner })
      arrowAt(a, u, owner)
      arrowAt(b, [-u[0], -u[1]], owner)
    } else {
      segs.push({ a, b, kind: 'rule', owner })
      arrowAt(a, [-u[0], -u[1]], owner)
      arrowAt(b, u, owner)
    }
  }
  /** A rule broken by a zigzag before b, one arrow at a. */
  const broken = (a: PartPoint, b: PartPoint, owner: string) => {
    const u = unit(a, b)
    const n: PartPoint = [-u[1], u[0]]
    const cut = face.breakLength * k
    const centre = add(b, u, -cut * 1.5)
    const z0 = add(centre, u, -cut / 2)
    const z1 = add(centre, u, cut / 2)
    const peak = add(add(centre, u, -cut / 4), n, face.breakAmplitude * k)
    const trough = add(add(centre, u, cut / 4), n, -face.breakAmplitude * k)
    for (const [p, q] of [
      [a, z0],
      [z0, peak],
      [peak, trough],
      [trough, z1],
      [z1, b],
    ])
      segs.push({ a: p, b: q, kind: 'rule', owner })
    arrowAt(a, [-u[0], -u[1]], owner)
  }

  return {
    part,
    points,
    annotation,
    lengthUnit,
    em,
    horizontal,
    k,
    lane0,
    pitch,
    arrowLen,
    tailLen,
    rMax,
    zMax,
    zBreak,
    gap,
    leaderLength,
    labels,
    segs,
    arcs,
    tips,
    across,
    spans,
    placements,
    start,
    label,
    textConflicts,
    conflicts,
    pick,
    commit,
    uncommit,
    place,
    rule,
    broken,
  }
}
