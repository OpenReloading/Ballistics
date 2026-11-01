import * as face from './face.ts'
import { boxDistance } from './geometry.ts'
import { type Candidate, createPlacer, type Placer } from './placer.ts'
import { type PartPoint, radiusAt } from './section.ts'
import { labelText, textWidth } from './text.ts'
import type {
  Annotation,
  Arc,
  Arrowhead,
  Callout,
  Dimension,
  Label,
  Layout,
  LineSegment,
  Part,
  SectionPoint,
} from './types.ts'
import { add, pairs, polar, unit } from './vector.ts'

const arcSegs = (c: Arc, n = 12): LineSegment[] =>
  Array.from({ length: n }, (_, k) => ({
    a: polar(c.c, c.r, c.from + ((c.to - c.from) * k) / n),
    b: polar(c.c, c.r, c.from + ((c.to - c.from) * (k + 1)) / n),
    kind: 'rule',
    owner: c.owner,
  }))

/**
 * Lays out the dimensions of one side at text size `em` (mm) in the part frame: the length stack
 * on +r, S and the diameter labels on -r, head lengths and head diameters behind the face. Each
 * text takes the first of its places where it clears every other text and every line of another
 * dimension, and its own lines and arrowheads clear every other text and arrowhead. Where that
 * leaves a conflict, the layout without the corner rooms of the radii is taken if it has fewer.
 * `horizontal` is the part-frame direction that reads level on the medium (angle labels).
 */
export function annotate(
  part: Part,
  em: number,
  horizontal: PartPoint,
  axis: [number, number],
): Layout {
  const best = (frontOnAxis: boolean) => {
    const kept = layOut(part, em, horizontal, axis, true, frontOnAxis)
    if (kept.residual < 1) return kept
    // keeping the diameters off the radius corners can push a text into a conflict elsewhere
    const plain = layOut(part, em, horizontal, axis, false, frontOnAxis)
    const better = plain.residual < kept.residual ? plain : kept
    if (better.residual < 1) return better
    // an angle text can take the place a radius needs: the angles placed first
    const angled = layOut(part, em, horizontal, axis, true, frontOnAxis, true)
    return angled.residual < better.residual ? angled : better
  }
  const radii = new Set(part.annotation.radii.map((r) => r.symbol))
  const leaders = ({ layout }: { layout: Layout }) =>
    layout.segs.filter((s) => s.leader && radii.has(s.owner))
  const crossing = (l: { layout: Layout }) => leaders(l).filter((s) => s.a[1] * s.b[1] < 0).length
  const long = (l: { layout: Layout }) =>
    leaders(l).filter(
      (s) =>
        Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) >
        (3 * face.radiusLeaderLength * em) / face.baseEm,
    ).length
  const first = best(false)
  if (!crossing(first) || !part.annotation.dimensions.some((d) => d.front)) return first.layout
  // a G1 text beside the mouth can leave a radius only the mirrored corner; on the axis past S it does not
  const onAxis = best(true)
  return crossing(onAxis) < crossing(first) &&
    long(onAxis) <= long(first) &&
    onAxis.residual <= first.residual
    ? onAxis.layout
    : first.layout
}

/** What still runs into something, for the choice between the two layouts. */
function residualOf({ placements, commit, uncommit, textConflicts }: Placer) {
  let residual = 0
  for (const p of placements) {
    uncommit(p.chosen)
    residual += textConflicts(p.chosen)
    commit(p.chosen)
  }
  return residual
}

/** The arcs and diameter tips of the chosen places. */
function collectArcs({ placements, arcs, across }: Placer) {
  for (const { chosen } of placements) {
    if (chosen.arc) arcs.push(chosen.arc)
    if (chosen.across) across.push(chosen.across)
  }
}

function layOut(
  part: Part,
  em: number,
  horizontal: PartPoint,
  axis: [number, number],
  keepCorners: boolean,
  frontOnAxis: boolean,
  anglesFirst = false,
): { layout: Layout; residual: number } {
  const placer = createPlacer(part, em, horizontal, axis, keepCorners)
  const { labels, segs, arcs, tips, across, spans, commit, pick, place } = placer
  layoutDiameters(placer, layoutLanes(placer, frontOnAxis))
  // angles first where radii first left a text in a conflict (`annotate`)
  for (const pass of anglesFirst ? [layoutAngles, layoutRadii] : [layoutRadii, layoutAngles])
    pass(placer)

  // note flags and detail letters: on a leader from the feature, the shortest clear one first
  for (const c of part.callouts ?? []) if (!c.letter) place(calloutCandidates(placer, c))
  settle(placer)
  collectArcs(placer)
  const box = layoutBox(placer)
  const residual = residualOf(placer)
  // detail letters last, outside the box and the residual: they move nothing else
  for (const c of part.callouts ?? []) if (c.letter) commit(pick(calloutCandidates(placer, c)))
  const layout: Layout = {
    labels,
    segs: segs.filter((s) => s.owner !== 'axis'),
    arcs,
    arrowheads: tips,
    box,
    diameterTips: across,
    spans,
  }
  return { layout, residual }
}

/** The dimensions by where they go: the length stack, head lengths, S, diameters across, below and in front. */
function splitDimensions(dims: Dimension[], zBreak: number) {
  const span = (d: Dimension) => Math.min(d.to, zBreak) - d.from
  const stack = dims
    .filter((d) => d.kind !== 'diameter' && !d.behindHeadFace && !d.far)
    .sort((a, b) => span(a) - span(b))
  const heads = dims
    .filter((d) => d.kind !== 'diameter' && d.behindHeadFace)
    .sort((a, b) => span(a) - span(b))
  const far = dims.filter((d) => d.kind !== 'diameter' && d.far)
  const acrossDims = dims
    .filter((d) => d.kind === 'diameter' && !d.behindHeadFace && !d.front)
    .sort((a, b) => a.from - b.from)
  const below = dims
    .filter((d) => d.kind === 'diameter' && d.behindHeadFace)
    .sort((a, b) => (a.radius as number) - (b.radius as number))
  const front = dims.filter((d) => d.kind === 'diameter' && d.front)
  return { stack, heads, far, acrossDims, below, front }
}

/**
 * The stack: shortest first, each in the innermost lane where its span and its label (outside
 * when it does not fit between the arrows) clear the others in that lane.
 */
function stackLanes(
  { lengthUnit, fixedDecimals, em, arrowLen, tailLen, zBreak, gap }: Placer,
  stack: Dimension[],
) {
  const lanes: [number, number][][] = []
  const laneOf = new Map<Dimension, number>()
  for (const d of stack) {
    const [from, to] = [d.from, Math.min(d.to, zBreak)]
    const w = textWidth(labelText(d, lengthUnit, fixedDecimals), em)
    const outside = to - from < face.shortSpan * arrowLen
    const fits = w + 2 * arrowLen < to - from
    const reach: [number, number] = [
      from - (outside ? tailLen + em : 0),
      to + (outside ? tailLen + em : 0) + (fits ? 0 : gap + w + em),
    ]
    // spans may touch: a chain continues from the end of the length before it
    let n = lanes.findIndex((lane) => lane.every(([a, b]) => reach[1] <= a || b <= reach[0]))
    let lane = lanes[n]
    if (!lane) {
      lane = []
      n = lanes.push(lane) - 1
    }
    lane.push(reach)
    laneOf.set(d, n)
  }
  return { lanes, laneOf }
}

/**
 * The lengths in their lanes (the stack on +r, S and the head lengths on -r), the head diameters
 * behind the face and a diameter past the mouth, then the datum: first every line whose place is
 * fixed, then their texts, so each text sees all of them. Returns what the diameters across the
 * part are placed past.
 */
function layoutLanes(placer: Placer, frontOnAxis: boolean) {
  const { annotation, lengthUnit, fixedDecimals, em, lane0, pitch, rMax, zBreak, segs } = placer
  const dims = annotation.dimensions
  const { stack, heads, far, acrossDims, below, front } = splitDimensions(dims, zBreak)

  const { lanes, laneOf } = stackLanes(placer, stack)
  const stackBase = rMax + lane0
  const stackOuter = stackBase + Math.max(lanes.length - 1, 0) * pitch
  const diameterW = Math.max(
    0,
    ...acrossDims.map((d) => textWidth(labelText(d, lengthUnit, fixedDecimals), em)),
  )
  const farBase =
    rMax + lane0 + Math.max(heads.length * pitch, acrossDims.length ? diameterW + lane0 : 0)
  const farOuter = farBase + Math.max(far.length - 1, 0) * pitch

  // first every line whose place is fixed, then their labels, so each label sees all of them
  const pending: (() => void)[] = []
  // the length stack on +r, its labels inside the part side of the rules, at one row where they fit
  const band =
    0.7 *
    Math.min(...stack.filter((d) => d.from === 0).map((d) => Math.min(d.to, zBreak)), Infinity)
  for (const d of stack)
    laneLength(
      placer,
      pending,
      d,
      stackBase + (laneOf.get(d) as number) * pitch,
      -1,
      Number.isFinite(band) ? band : undefined,
    )
  // S on -r beyond the head lanes and the diameter labels, its label on the part side
  far.forEach((d, n) => {
    laneLength(placer, pending, d, -(farBase + n * pitch), 1)
  })
  headLengths(placer, pending, heads)
  headDiameters(placer, pending, below)
  frontDiameters(placer, pending, front, frontOnAxis)
  // the datum along the head face over every lane
  const lanesOut = Math.max(
    heads.length ? rMax + lane0 + (heads.length - 1) * pitch : 0,
    far.length ? farOuter : 0,
  )
  if (dims.length)
    segs.push({
      a: [0, -(Math.max(rMax, lanesOut) + face.overrun)],
      b: [0, (stack.length ? stackOuter : rMax) + face.overrun],
      kind: 'thin',
      owner: 'datum',
    })
  for (const f of pending) f()
  return { acrossDims, stackOuter, farOuter }
}

/** A length in a lane at signed distance y; the label on the side `labelSide` of its rule. */
function laneLength(
  placer: Placer,
  pending: (() => void)[],
  d: Dimension,
  y: number,
  labelSide: number,
  band?: number,
) {
  const {
    lengthUnit,
    fixedDecimals,
    em,
    arrowLen,
    tailLen,
    zBreak,
    gap,
    segs,
    spans,
    start,
    label,
    place,
    rule,
    broken,
  } = placer
  const owner = d.symbol
  const sign = Math.sign(y)
  const isBroken = d.to > zBreak
  const [from, to] = [d.from, isBroken ? zBreak : d.to]
  const outside = !isBroken && to - from < face.shortSpan * arrowLen
  spans.push({ owner, length: to - from, outside, broken: isBroken })
  for (const z of isBroken ? [from] : [from, to])
    if (z > 1e-9)
      segs.push({ a: [z, sign * start(z)], b: [z, y + sign * face.overrun], kind: 'thin', owner })
  if (isBroken) broken([from, y], [to, y], owner)
  else rule([from, y], [to, y], owner, outside)
  pending.push(() => {
    const text = labelText(d, lengthUnit, fixedDecimals)
    const w = textWidth(text, em)
    const ly = y + labelSide * (0.5 * em + gap)
    const ends = outside ? tailLen : 0
    const inside = w + 2 * arrowLen < to - from
    const within = (x: number) => x - w / 2 > from + arrowLen && x + w / 2 < to - arrowLen
    const xs = [
      ...(inside
        ? [
            band !== undefined && within(band) ? band : (from + to) / 2,
            ...Array.from({ length: 9 }, (_, n) => from + ((to - from) * (n + 1)) / 10).filter(
              within,
            ),
          ]
        : []),
      to + ends + gap + w / 2,
      from - ends - gap - w / 2,
      ...Array.from({ length: 8 }, (_, n) => to + ends + gap + w / 2 + (n + 1) * em),
    ]
    place(
      [ly, y - labelSide * (0.5 * em + gap)].flatMap((yy) =>
        xs.map((x) => ({ l: label(text, [x, yy], [1, 0], owner) })),
      ),
    )
  })
}

/** Head lengths on -r behind the face, texts before the face in line with the rule. */
function headLengths(placer: Placer, pending: (() => void)[], heads: Dimension[]) {
  const {
    lengthUnit,
    fixedDecimals,
    em,
    lane0,
    pitch,
    arrowLen,
    tailLen,
    rMax,
    gap,
    segs,
    spans,
    start,
    label,
    place,
    rule,
  } = placer
  heads.forEach((d, n) => {
    const owner = d.symbol
    const y = -(rMax + lane0 + n * pitch)
    const outside = d.to - d.from < face.shortSpan * arrowLen
    spans.push({ owner, length: d.to - d.from, outside, broken: false })
    for (const z of [d.from, d.to])
      if (z > 1e-9) segs.push({ a: [z, -start(z)], b: [z, y - face.overrun], kind: 'thin', owner })
    rule([d.from, y], [d.to, y], owner, outside)
    pending.push(() => {
      const text = labelText(d, lengthUnit, fixedDecimals)
      const w = textWidth(text, em)
      const x = Math.min(d.from, d.to) - (outside ? tailLen : 0) - gap - w / 2
      place(
        [0, -1, 1, -2, 2].flatMap((m) =>
          [x, x - w - em].map((xx) => ({
            l: label(text, [xx, y + m * (0.5 * em + gap)], [1, 0], owner),
          })),
        ),
      )
    })
  })
}

/** Head diameters behind the face, smallest radius innermost; texts centred or beside. */
function headDiameters(placer: Placer, pending: (() => void)[], below: Dimension[]) {
  const {
    points,
    lengthUnit,
    fixedDecimals,
    em,
    lane0,
    pitch,
    arrowLen,
    tailLen,
    rMax,
    gap,
    segs,
    label,
    place,
    rule,
  } = placer
  below.forEach((d, n) => {
    const owner = d.symbol
    const r = d.radius as number
    const z = -(lane0 + n * pitch)
    // a belt wider than the rim (or a rim behind a chamfer) is projected from where the outline
    // first reaches it
    const zFrom = reach(points, r)
    for (const s of [1, -1])
      segs.push({
        a: [zFrom - face.extensionGap, s * r],
        b: [z - face.overrun, s * r],
        kind: 'thin',
        owner,
      })
    rule([z, -r], [z, r], owner, 2 * r < face.shortSpan * arrowLen)
    pending.push(() => {
      const text = labelText(d, lengthUnit, fixedDecimals)
      const w = textWidth(text, em)
      const outer = Math.max(...below.map((b) => b.radius as number)) + tailLen + gap
      place(
        [z - 0.5 * em - gap, z + 0.5 * em + gap].flatMap((lz) =>
          [0, outer + w / 2, -(outer + w / 2), rMax + lane0 + w / 2, -(rMax + lane0 + w / 2)].map(
            (y) => ({ l: label(text, [lz, y], [0, 1], owner) }),
          ),
        ),
      )
    })
  })
}

/** A diameter past the mouth (the cartridge G1), extension lines from the mouth face. */
function frontDiameters(
  placer: Placer,
  pending: (() => void)[],
  front: Dimension[],
  frontOnAxis: boolean,
) {
  const {
    lengthUnit,
    fixedDecimals,
    em,
    lane0,
    pitch,
    arrowLen,
    tailLen,
    rMax,
    zMax,
    gap,
    segs,
    label,
    place,
    rule,
  } = placer
  front.forEach((d, n) => {
    const owner = d.symbol
    const r = d.radius as number
    const z = zMax + lane0 + n * pitch
    for (const s of [1, -1])
      segs.push({
        a: [zMax + face.extensionGap, s * r],
        b: [z + face.overrun, s * r],
        kind: 'thin',
        owner,
      })
    rule([z, -r], [z, r], owner, 2 * r < face.shortSpan * arrowLen)
    pending.push(() => {
      const text = labelText(d, lengthUnit, fixedDecimals)
      const w = textWidth(text, em)
      const beside = r + tailLen + gap + w / 2
      const places = [z + 0.5 * em + gap, z - 0.5 * em - gap, z + pitch, z + 2 * pitch].flatMap(
        (lz) =>
          [0, beside, -beside, rMax + lane0 + w / 2, -(rMax + lane0 + w / 2)].map((y) => ({
            l: label(text, [lz, y], [0, 1], owner),
          })),
      )
      // frontOnAxis: every place on the axis before the places beside it
      place(
        frontOnAxis
          ? places.sort((p, q) => Number(p.l.c[1] !== 0) - Number(q.l.c[1] !== 0))
          : places,
      )
    })
  })
}

/** Diameters across the part, arrows touching the outline, the text at one end. */
function layoutDiameters(
  placer: Placer,
  {
    acrossDims,
    stackOuter,
    farOuter,
  }: { acrossDims: Dimension[]; stackOuter: number; farOuter: number },
) {
  const { points, annotation, lengthUnit, fixedDecimals, em, lane0, arrowLen, rMax, gap, place } =
    placer
  for (const d of acrossDims) {
    const text = labelText(d, lengthUnit, fixedDecimals)
    const w = textWidth(text, em)
    const columns = [
      [-1, rMax + lane0],
      [1, stackOuter + lane0],
      [-1, farOuter + lane0 + em],
      [1, stackOuter + lane0 + w + gap],
      [-1, farOuter + lane0 + 2 * em + w],
    ] as const
    // in a crowded column the label moves along the axis, its line kinked before it
    const shifts = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map((n) => n * 1.15 * em)
    // at each station arrows from outside, then from inside pointing out, taken where an outside
    // one runs into another dimension or a radius corner's room (inside, the two arrowheads of a
    // small diameter would meet)
    const ways = (d.radius as number) > 1.5 * arrowLen ? [false, true] : [false]
    const zs = stations(points, d, annotation)
    place(
      columns.flatMap(([side, at]) =>
        shifts.flatMap((shift) =>
          zs.flatMap((z) =>
            ways.map((inward) =>
              acrossCandidate(placer, d, { text, w, side, at, shift, z, inward }),
            ),
          ),
        ),
      ),
    )
  }
}

/** Where one diameter text goes: the column side and distance, the shift along the axis, the station and the arrow direction. */
type AcrossSpot = {
  text: string
  w: number
  side: number
  at: number
  shift: number
  z: number
  inward: boolean
}

/** One place of a diameter: its line to the text column, arrowheads on the outline at the station. */
function acrossCandidate(
  { points, lane0, tailLen, gap, label }: Placer,
  d: Dimension,
  { text, w, side, at, shift, z, inward }: AcrossSpot,
): Candidate {
  const owner = d.symbol
  // the tip on the outline; at a step, where the outline has two radii, the stored one
  const outline = radiusAt(points, z) as number
  const r = Math.abs(outline - (d.radius as number)) <= 0.05 ? outline : (d.radius as number)
  const knee = at - 0.6 * lane0
  const from = -side * (inward ? r : r + tailLen)
  const line: LineSegment[] = shift
    ? [
        { a: [z, from], b: [z, side * knee], kind: 'rule', owner },
        { a: [z, side * knee], b: [z + shift, side * at], kind: 'rule', owner },
      ]
    : [{ a: [z, from], b: [z, side * at], kind: 'rule', owner }]
  const out = inward ? -1 : 1
  return {
    across: {
      owner,
      tips: [
        [z, r],
        [z, -r],
      ] as [PartPoint, PartPoint],
    },
    l: label(text, [z + shift, side * (at + gap + w / 2)], [0, 1], owner),
    segs: line,
    tips: [
      { at: [z, r], dir: [0, -out], owner },
      { at: [z, -r], dir: [0, out], owner },
    ] as Arrowhead[],
  }
}

/** One place of a fillet radius: the leader's direction (sz, sr) mirrored by `side`, its length scaled, how the text sits. */
type RadiusSpot = {
  corner: PartPoint
  text: string
  w: number
  owner: string
  how: 'along' | 'level' | 'beside'
  sz: number
  sr: number
  side: number
  scale: number
}

function radiusLeader(
  { em, horizontal, gap, leaderLength, label }: Placer,
  { corner, text, w, owner, how, sz, sr, side, scale }: RadiusSpot,
) {
  const at: PartPoint = [corner[0], side * corner[1]]
  const dir: PartPoint = [sz / Math.SQRT2, (side * sr) / Math.SQRT2]
  const end = add(at, dir, leaderLength * scale)
  // the level direction is an axis of the part frame, so it meets the leader at 45 deg
  const toward = Math.sign(dir[0] * horizontal[0] + dir[1] * horizontal[1])
  const c =
    how === 'along'
      ? add(end, dir, gap + w / 2)
      : how === 'level'
        ? add(end, dir, gap + w / 2 / Math.SQRT2 + em / 2)
        : add(end, horizontal, toward * (gap + w / 2))
  // a level text's box: the leader runs on to a gap before the box edge it meets at 45 deg
  const b = how === 'level' ? add(c, dir, -(gap + Math.min(w, em) / Math.SQRT2)) : end
  return {
    l: label(text, c, how === 'along' ? dir : horizontal, owner),
    segs: [{ a: at, b, kind: 'thin' as const, owner, leader: true as const }],
    tips: [{ at, dir: [-dir[0], -dir[1]] as PartPoint, owner }],
  }
}

/** Fillet radii: a 45 degree leader to the unrounded corner, the text along it. */
function layoutRadii(placer: Placer) {
  const { part, points, annotation, lengthUnit, fixedDecimals, em, gap, label, place } = placer
  for (const c of annotation.radii) {
    const owner = c.symbol
    const corner: PartPoint = [c.corner[1], c.corner[0]]
    const text = labelText(
      { kind: 'radius', symbol: c.symbol, value: c.value },
      lengthUnit,
      fixedDecimals,
    )
    const w = textWidth(text, em)
    const options: [number, number][] = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]
    // a chamber radius may also sit in the steel band beside its corner, level along the axis
    const band =
      part.outer === undefined
        ? []
        : [1, -1].flatMap((side) =>
            [1, -1, 1.5, -1.5, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].flatMap((n) => {
              const z = corner[0] + n * (w / 2 + em)
              const bore = radiusAt(points, z)
              if (bore === undefined || (part.outer as number) - bore < em + gap) return []
              const c: PartPoint = [z, (side * (bore + (part.outer as number))) / 2]
              const near: PartPoint = [z - Math.sign(n) * (w / 2 + gap), c[1]]
              return [
                {
                  l: label(text, c, [1, 0], owner),
                  segs: [
                    {
                      a: [corner[0], side * corner[1]] as PartPoint,
                      b: near,
                      kind: 'thin' as const,
                      owner,
                      leader: true as const,
                    },
                  ],
                  tips: [
                    {
                      at: [corner[0], side * corner[1]] as PartPoint,
                      dir: unit(near, [corner[0], side * corner[1]]),
                      owner,
                    },
                  ],
                },
              ]
            }),
          )
    // the label along the leader, level on the medium past its end, or level beside its end
    const leaders = (scale: number) =>
      (['along', 'level', 'beside'] as const).flatMap((how) =>
        options.flatMap(([sz, sr]) =>
          [1, -1].map((side) =>
            radiusLeader(placer, { corner, text, w, owner, how, sz, sr, side, scale }),
          ),
        ),
      )
    // the face's leader, the steel band beside the corner, a shorter leader, then longer ones
    place([...leaders(1), ...band, ...[0.6, 1.6, 2.4, 3.4, 4.6, 6, 8].flatMap(leaders)])
  }
}

/** One place of an angle text on a leader from its arc, and the arc's own lines and arrowheads. */
type LedSpot = {
  text: string
  w: number
  owner: string
  v: PartPoint
  radius: number
  far: PartPoint
  along: boolean
  onArc: number
  lines: LineSegment[]
  arcTips: Arrowhead[]
  arc: Arc
}

function ledCandidate(
  { em, horizontal, gap, label }: Placer,
  { text, w, owner, v, radius, far, along, onArc, lines, arcTips, arc }: LedSpot,
): Candidate {
  const [dx, dy] = horizontal
  const start = polar(v, radius, onArc)
  const end: PartPoint = along ? [far[0], start[1]] : far
  const u = unit(along ? v : start, far)
  // the text box's edge, where the leader's line meets it, a gap past the leader end
  const reach = Math.min(
    w / 2 / Math.max(Math.abs(u[0] * dx + u[1] * dy), 1e-9),
    em / 2 / Math.max(Math.abs(u[0] * dy - u[1] * dx), 1e-9),
  )
  const c = add(end, u, gap + reach)
  // a text across the axis stays centred on it where the leader still meets the text
  const across = (Math.abs(dy) * w) / 2 + (Math.abs(dx) * em) / 2
  if (along && Math.abs(start[1]) <= across - em / 4) c[1] = 0
  const leader: LineSegment = { a: start, b: end, kind: 'thin', owner, leader: true }
  return {
    l: label(text, c, horizontal, owner),
    segs: [...lines, leader],
    tips: arcTips,
    arc,
  }
}

const tangent = (t: number, s: number): PartPoint => [-Math.sin(t) * s, Math.cos(t) * s]

/** An angle's vertex, the first flank's end and the directions of both flanks, in the part frame. */
type AngleFrame = { v: PartPoint; f0: PartPoint; t0: number; t1: number }

/** The arcs an angle may take, each with the thin lines that go with it. */
function angleShapes(
  { points, em, k, lane0, rMax, zMax, gap }: Placer,
  a: Annotation['angles'][number],
  onAxis: boolean,
  { v, f0, t0, t1 }: AngleFrame,
): { radius: number; thin: LineSegment[] }[] {
  const owner = a.symbol
  if (a.symbol === 'alpha' && onAxis) {
    // the shoulder: an arc behind L1 at 1.6 times the vertex distance, at most so far that its
    // flanks end before the texts of lane 0 and its middle stays 0.35 zMax off the head; the
    // flanks run from the corners at L1 to just past the arc
    const reachOut =
      (rMax + lane0 - em - 2 * gap) / Math.max(Math.abs(Math.sin(t0)), 1e-6) - 0.5 * k
    const radius = Math.max(
      Math.min(face.alphaArc * (v[0] - f0[0]), v[0] - 0.35 * zMax, reachOut),
      2 * k,
    )
    const corner = Math.hypot(f0[0] - v[0], f0[1] - v[1])
    return [
      {
        radius,
        thin: [t0, t1].map((t) => ({
          a: polar(v, Math.min(corner, radius), t),
          b: polar(v, radius + 0.5 * k, t),
          kind: 'thin' as const,
          owner,
        })),
      },
    ]
  }
  if (onAxis) {
    // a cone on the axis (alpha1, table VII): the arc across the middle of the drawn cone
    const cone = coneMiddle(points, f0, v)
    return [{ radius: Math.hypot(cone[0] - v[0], cone[1] - v[1]), thin: [] }]
  }
  // a short arc, the slanted flank drawn on
  const t = Math.abs(Math.sin(t0)) > Math.abs(Math.sin(t1)) ? t0 : t1
  return [1, 1.5, 0.7].map((scale) => ({
    radius: face.smallArc * k * scale,
    thin: [{ a: v, b: polar(v, face.smallFlank * k * scale, t), kind: 'thin', owner }],
  }))
}

/** An arc of an angle with its lines and arrowheads: the arrows inside when the arc is long enough. */
function angleVariant(
  { arrowLen, tailLen }: Placer,
  owner: string,
  { v, t0, t1 }: AngleFrame,
  { radius, thin }: { radius: number; thin: LineSegment[] },
) {
  const length = Math.abs(t1 - t0) * radius
  const short = length < face.shortSpan * arrowLen
  const sweep = Math.sign(t1 - t0) || 1
  const arcTips: Arrowhead[] = short
    ? [
        { at: polar(v, radius, t0), dir: tangent(t0, sweep), owner },
        { at: polar(v, radius, t1), dir: tangent(t1, -sweep), owner },
      ]
    : [
        { at: polar(v, radius, t0), dir: tangent(t0, -sweep), owner },
        { at: polar(v, radius, t1), dir: tangent(t1, sweep), owner },
      ]
  const arc: Arc = short
    ? {
        c: v,
        r: radius,
        from: t0 - (sweep * tailLen) / radius,
        to: t1 + (sweep * tailLen) / radius,
        owner,
      }
    : { c: v, r: radius, from: t0, to: t1, owner }
  return { v, t0, t1, sweep, radius, arc, lines: [...thin, ...arcSegs(arc)], arcTips }
}

/** The arcs of an angle on one side of the axis. */
function angleVariants(
  placer: Placer,
  a: Annotation['angles'][number],
  onAxis: boolean,
  side: number,
) {
  const v: PartPoint = [a.vertex[1], side * a.vertex[0]]
  const flank = ([r, z]: SectionPoint): PartPoint => [z, side * r]
  const [f0, f1] = [flank(a.flanks[0]), flank(a.flanks[1])]
  let t0 = Math.atan2(f0[1] - v[1], f0[0] - v[0])
  let t1 = Math.atan2(f1[1] - v[1], f1[0] - v[0])
  if (t1 - t0 > Math.PI) t1 -= 2 * Math.PI
  if (t0 - t1 > Math.PI) t0 -= 2 * Math.PI
  const frame: AngleFrame = { v, f0, t0, t1 }
  return angleShapes(placer, a, onAxis, frame).map((shape) =>
    angleVariant(placer, a.symbol, frame, shape),
  )
}

/** Angles about their vertex: an arc between the flanks, the text near it or on a leader. */
function layoutAngles(placer: Placer) {
  const { annotation, em, horizontal, rMax, gap, label, place } = placer
  // alpha1 first: fewer places are free near its arc in the narrow mouth than near the shoulder's
  const angles = [...annotation.angles].sort(
    (p, q) => Number(q.symbol === 'alpha1') - Number(p.symbol === 'alpha1'),
  )
  for (const a of angles) {
    const owner = a.symbol
    const onAxis = Math.abs(a.vertex[0]) < 1e-9
    const text = labelText(a)
    const w = textWidth(text, em)
    // an angle at the outline (delta, i) may go on either side; one on the axis is symmetric
    const variants = (onAxis ? [1] : [1, -1]).flatMap((side) =>
      angleVariants(placer, a, onAxis, side),
    )
    const candidates = variants.flatMap(({ v, t0, t1, sweep, radius, arc, lines, arcTips }) => {
      const mid = (t0 + t1) / 2
      const ring = Array.from({ length: 25 }, (_, n) =>
        polar(v, radius, arc.from + ((arc.to - arc.from) * n) / 24),
      )
      const direct = [
        radius - 1.1 * em - w / 2,
        radius + 0.9 * em + w / 2,
        radius + 2 * em + w,
        radius - 2.2 * em - w,
        radius + 3.5 * em + w,
      ].flatMap((dist) =>
        [mid, t0 - sweep * 0.3, t1 + sweep * 0.3, t0 - sweep * 0.7, t1 + sweep * 0.7].map((t) => ({
          l: label(text, polar(v, Math.max(dist, w / 2 + em), t), horizontal, owner),
          segs: lines,
          tips: arcTips,
          arc,
        })),
      )
      // all around the arc, a gap or more off it on either side
      const [hx, hy] = horizontal
      const around = Array.from({ length: 24 }, (_, j) => (j * Math.PI) / 12).flatMap((t) => {
        const u: PartPoint = [Math.cos(t), Math.sin(t)]
        // from the text's centre to its box edge along u
        const half = Math.min(
          w / 2 / Math.max(Math.abs(u[0] * hx + u[1] * hy), 1e-9),
          em / 2 / Math.max(Math.abs(u[0] * hy - u[1] * hx), 1e-9),
        )
        return [radius + gap + half, radius + 0.5 * em + half, radius - gap - half]
          .filter((dist) => dist > 0)
          .map((dist) => ({
            l: label(text, polar(v, dist, t), horizontal, owner),
            segs: lines,
            tips: arcTips,
            arc,
          }))
      })
      // where no place near the arc is free: further out, on a leader from the arc
      const led = [1.5, 2.5, 4, 6, 9, 13, 18].flatMap((n) =>
        Array.from({ length: 21 }, (_, j) => (j % 2 ? 1 : -1) * Math.ceil(j / 2)).flatMap((m) => {
          const t = mid + m * 0.15
          const far = polar(v, radius + n * em, t)
          // a leader along the axis would vanish in the dash-dot line: from an arc on the axis it
          // starts on the arc toward either end and runs parallel to the axis
          const along = onAxis && Math.abs(Math.sin(t)) < 0.1
          const from = along
            ? [t0 + 0.15 * (t1 - t0), t1 - 0.15 * (t1 - t0)]
            : [Math.min(Math.max(t, Math.min(t0, t1)), Math.max(t0, t1))]
          return from.map((onArc) =>
            ledCandidate(placer, {
              text,
              w,
              owner,
              v,
              radius,
              far,
              along,
              onArc,
              lines,
              arcTips,
              arc,
            }),
          )
        }),
      )
      // within the part the nearest to the arc first; past it the nearest to the axis, as a text
      // far out widens the drawing; a text without a leader stays within 2 em of its arc, so it
      // reads as that arc's
      const out = ({ l }: { l: Label }) => {
        const reach = Math.abs(l.c[1]) + Math.abs(l.dir[1] * l.w) / 2
        if (reach > rMax) return 1e6 + reach
        return Math.min(...ring.map(([x, y]) => Math.hypot(x - l.c[0], y - l.c[1])))
      }
      const near = ({ l }: { l: Label }) =>
        Math.min(...ring.map((q) => boxDistance(l, q))) <= face.nearArc * em
      // the keys once per candidate, not per comparison; the stable sort keeps the order
      const keyed = [...direct.slice(2).filter(near), ...around.filter(near), ...led].map((c) => ({
        c,
        key: out(c),
      }))
      return [
        ...direct.slice(0, 2).filter(near),
        ...keyed.sort((p, q) => p.key - q.key).map(({ c }) => c),
      ]
    })
    place(candidates)
  }
}

/** The places of a note flag or a detail letter on a leader from its feature, shortest first. */
function calloutCandidates(placer: Placer, c: Callout): Candidate[] {
  const { em, horizontal, gap, leaderLength } = placer
  const { owner, text, letter } = c
  const w = letter ? textWidth(text, em) : Math.max(1.3 * em, textWidth(text, em) + 0.6 * em)
  const h = letter ? em : w
  const [dx, dy] = horizontal
  return [0.3, 0.5, 0.8, 1.2, 1.8, 2.6, 3.6, 5, 7].flatMap((n) =>
    [1, -1].flatMap((side) =>
      Array.from({ length: 8 }, (_, j) => {
        const at: PartPoint = [c.at[1], side * c.at[0]]
        const u: PartPoint = [Math.cos((j * Math.PI) / 4), Math.sin((j * Math.PI) / 4)]
        const end = add(at, u, n * leaderLength)
        const reach = Math.min(
          w / 2 / Math.max(Math.abs(u[0] * dx + u[1] * dy), 1e-9),
          h / 2 / Math.max(Math.abs(u[0] * dy - u[1] * dx), 1e-9),
        )
        return {
          l: {
            text,
            c: add(end, u, gap + reach),
            dir: horizontal,
            w,
            h,
            owner,
            ...(letter ? {} : { ring: true as const }),
          },
          segs: [{ a: at, b: end, kind: 'thin' as const, owner, leader: true as const }],
        }
      }),
    ),
  )
}

/** A text that still runs into something tries its places again, now that all are set. */
function settle(placer: Placer) {
  const { placements, conflicts, pick, commit, uncommit } = placer
  for (let pass = 0; pass < 6; pass++) {
    let moved = false
    for (const p of placements) {
      uncommit(p.chosen)
      if (conflicts(p.chosen) > 0) {
        const next = pick(p.candidates)
        moved ||= next !== p.chosen
        p.chosen = next
      }
      commit(p.chosen)
    }
    if (!moved) break
  }
}

/** The box around every line, arc and text placed and the part: [x0, y0, x1, y1]. */
function layoutBox(placer: Placer): [number, number, number, number] {
  const { points, rMax, labels, segs, arcs } = placer
  const xs: number[] = []
  const ys: number[] = []
  const grow = ([x, y]: PartPoint) => {
    xs.push(x)
    ys.push(y)
  }
  for (const s of segs) if (s.owner !== 'axis') [s.a, s.b].forEach(grow)
  for (const a of arcs) for (const s of arcSegs(a)) [s.a, s.b].forEach(grow)
  const signs: [number, number][] = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]
  for (const l of labels) {
    const [ux, uy] = l.dir
    for (const [s, t] of signs)
      grow([
        l.c[0] + (s * l.w * ux) / 2 - (t * l.h * uy) / 2,
        l.c[1] + (s * l.w * uy) / 2 + (t * l.h * ux) / 2,
      ])
  }
  for (const [r, z] of points) {
    grow([z, rMax])
    grow([z, -rMax])
    grow([z, r])
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

/**
 * Where a diameter can be dimensioned, nearest first: its station, then up to 3 mm along its own
 * segment (`toward`), where the outline stays within 0.01 mm of the stored radius, off a step and
 * off a convention.
 */
function stations(points: SectionPoint[], d: Dimension, annotation: Annotation) {
  const [z, r, s] = [d.from, d.radius as number, d.toward]
  const zEnd = Math.max(...points.map(([, pz]) => pz))
  const onConvention = (q: number) =>
    annotation.conventions.some((c) => q > c.from - 1e-9 && q <= c.to)
  const found = [z]
  if (s === undefined) return found
  for (const step of [0.3, 0.6, 1, 1.5, 2, 3]) {
    const q = z + s * step
    if (q <= 0 || q >= zEnd || onConvention(q)) continue
    const at = radiusAt(points, q)
    // no outline point between z and q, so the move stays on one straight run
    const between = points.some(([, pz]) => (pz - z) * s > 1e-9 && (pz - q) * s < 1e-9)
    if (at !== undefined && Math.abs(at - r) <= 0.01 && !between) found.push(q)
  }
  // off a corner first: the station is often where the outline turns
  return found.length > 1 ? [...found.slice(1, 3), z, ...found.slice(3)] : found
}

/** z where the half profile first reaches radius r (within 0.01 mm at a point), across a slope. */
function reach(points: SectionPoint[], r: number) {
  for (const [[r0, z0], [r1, z1]] of pairs(points)) {
    if (r1 >= r) return z0 + ((r - r0) / (r1 - r0)) * (z1 - z0)
    if (r1 >= r - 0.01) return z1
  }
  return 0
}

/** The middle of the drawn cone segment from flank point f toward the vertex v. */
function coneMiddle(points: SectionPoint[], f: PartPoint, v: PartPoint): PartPoint {
  const r = Math.abs(f[1])
  const k = points.findIndex(([pr, pz]) => Math.abs(pr - r) < 1e-9 && Math.abs(pz - f[0]) < 1e-9)
  const next = k >= 0 ? points[k + 1] : undefined
  if (!next) return [(f[0] + v[0]) / 2, f[1] / 2]
  return [(f[0] + next[1]) / 2, (Math.sign(f[1]) * (r + next[0])) / 2]
}
