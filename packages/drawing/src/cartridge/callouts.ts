import * as face from '../core/face.ts'
import { labelCorners } from '../core/geometry.ts'
import { type PartPoint, radiusAt, steelRadius } from '../core/section.ts'
import { textWidth } from '../core/text.ts'
import type { Layout } from '../core/types.ts'
import type { LengthUnit } from '../core/units.ts'
import type { Profile } from './profile.ts'
import { type Region, type RegionName, regionText } from './regions.ts'

/**
 * Where each region is called out along the axis, from the cartridge diameters: the head in the
 * rim, the body, shoulder and neck between the stations of P1, P2, H1 and H2 (a wall without a
 * drawn shoulder split in quarters).
 */
export function regionStations({ points, annotation }: Profile): Record<RegionName, number> {
  const at = (symbol: string) =>
    annotation.dimensions.find((d) => d.kind === 'diameter' && d.symbol === symbol)?.from
  const zMax = Math.max(...points.map(([, z]) => z))
  // the rim length R, not a point index: a chamfer or r0 adds points before the rim top
  const rim =
    annotation.dimensions.find((d) => d.kind === 'length' && d.symbol === 'R')?.to ?? points[2]?.[1]
  if (rim === undefined)
    throw new Error('The rim length R is not dimensioned and the outline has no rim point.')
  const start = at('P1') ?? rim
  const end = at('H2') ?? zMax
  const [p2, h1] = [at('P2'), at('H1')]
  const shoulder = p2 !== undefined && h1 !== undefined
  return {
    head: rim / 2,
    body: shoulder ? (start + p2) / 2 : start + 0.25 * (end - start),
    shoulder: shoulder ? (p2 + h1) / 2 : start + 0.5 * (end - start),
    neck: shoulder ? (h1 + end) / 2 : start + 0.75 * (end - start),
  }
}

/**
 * The Combined layer: one callout per region, a leader from the chamber wall at its station
 * straight out past the steel band to a lane, the text along the axis a gap past the leader's end.
 * Lanes as in the length stack: the innermost where the text clears the texts and leaders there
 * and the leader clears the texts of the lanes it crosses, +r before -r, inside `box` (the frame
 * of the other layers) where any lane is free there, so switching views keeps the frame.
 */
export function regionCallouts(
  cartridge: Profile,
  chamber: Profile,
  list: Region[],
  em: number,
  box: [number, number, number, number],
  unit: LengthUnit = 'mm',
): Layout {
  const k = em / face.baseEm
  const [lane0, pitch, gap] = [face.firstLaneOffset * k, face.lanePitch * k, 0.12 * em]
  const outer = steelRadius(chamber.points)
  const lanes: Lanes = {
    stations: regionStations(cartridge),
    laneR: (n: number) => outer + lane0 + n * pitch,
    gap,
    em,
    box,
    unit,
  }
  return calloutLayout(bestPlacement(list, lanes), chamber, outer, lanes)
}

type Span = [number, number]

/** What the lane search reads: region stations, the radius of lane n, the text gap and size, the box. */
interface Lanes {
  stations: Record<RegionName, number>
  laneR: (n: number) => number
  gap: number
  em: number
  box: [number, number, number, number]
  unit: LengthUnit
}

/** A callout in lane n on the side `sign`, its text spanning `span` along the axis. */
interface Placed {
  region: Region
  z: number
  text: string
  w: number
  sign: number
  n: number
  span: Span
}

/** The first of `spans` that fits lane n+1 on the side `sign` and leaves the lanes it crosses free at `z`. */
function fittingSpan(
  spans: Span[],
  { within, n, sign, z }: { within: boolean; n: number; sign: number; z: number },
  { gap, box }: Lanes,
  free: (lane: number, span: Span) => boolean,
) {
  return spans.find(
    ([a, b]) =>
      (!within || (a >= box[0] && b <= box[2])) &&
      free(sign * (n + 1), [a, b]) &&
      Array.from({ length: n }, (_, m) => sign * (m + 1)).every((lane) =>
        free(lane, [z - gap, z + gap]),
      ),
  )
}

/** Does a text of height em centred at radius r reach past the box's top or bottom? */
const outsideBox = (r: number, em: number, box: Lanes['box']) =>
  r + em / 2 > box[3] || r - em / 2 < box[1]

/** The innermost lane that fits a callout, inside the box first, +r before -r; undefined when none does. */
function searchLanes(
  { region, z, text, w }: Pick<Placed, 'region' | 'z' | 'text' | 'w'>,
  spans: Span[],
  lanes: Lanes,
  free: (lane: number, span: Span) => boolean,
): { place: Placed; within: boolean } | undefined {
  const { laneR, em, box } = lanes
  for (const within of [true, false])
    for (let n = 0; n < 40; n++)
      for (const sign of [1, -1]) {
        const r = sign * laneR(n)
        if (within && outsideBox(r, em, box)) continue
        const span = fittingSpan(spans, { within, n, sign, z }, lanes, free)
        if (span) return { place: { region, z, text, w, sign, n, span }, within }
      }
}

/** Places the callouts in this order; the ones outside `box` counted. */
function placeInLanes(order: Region[], before: boolean, lanes: Lanes) {
  const { stations, gap, em, unit } = lanes
  const taken = new Map<number, Span[]>()
  const free = (lane: number, [a, b]: Span) =>
    (taken.get(lane) ?? []).every(([c, d]) => b + gap <= c || d + gap <= a)
  const take = (lane: number, span: Span) => taken.set(lane, [...(taken.get(lane) ?? []), span])
  const placed: Placed[] = []
  let outside = 0
  for (const region of order) {
    const z = stations[region.name]
    const text = regionText(region, unit)
    const w = textWidth(text, em)
    const after: Span = [z + gap, z + gap + w]
    const spans: Span[] = before ? [[z - gap - w, z - gap], after] : [after, [z - gap - w, z - gap]]
    const found = searchLanes({ region, z, text, w }, spans, lanes, free)
    // a station covered on both sides in every lane: this order fails
    if (!found) return { placed, outside: Infinity }
    const { place } = found
    if (!found.within) outside++
    take(place.sign * (place.n + 1), place.span)
    for (let m = 0; m < place.n; m++) take(place.sign * (m + 1), [z - gap, z + gap])
    placed.push(place)
  }
  return { placed, outside }
}

/** The placement with the fewest callouts outside `box`: by station first, then every order. */
function bestPlacement(list: Region[], lanes: Lanes): Placed[] {
  // a text covering another station must lie outside that callout's lane: try every order
  const orders = (list: Region[]): Region[][] =>
    list.length < 2
      ? [list]
      : list.flatMap((x, k) => orders(list.filter((_, j) => j !== k)).map((o) => [x, ...o]))
  const byStation = [...list].sort((a, b) => lanes.stations[a.name] - lanes.stations[b.name])
  let best = placeInLanes(byStation, false, lanes)
  for (const before of [false, true])
    for (const order of orders(byStation)) {
      if (best.outside === 0) break
      const next = placeInLanes(order, before, lanes)
      if (next.outside < best.outside) best = next
    }
  return best.placed
}

/** The leaders and texts of the placed callouts, in a box grown from `box` to take them. */
function calloutLayout(placed: Placed[], chamber: Profile, outer: number, lanes: Lanes): Layout {
  const { laneR, em, box } = lanes
  const layout: Layout = {
    labels: [],
    segs: [],
    arcs: [],
    arrowheads: [],
    box,
    diameterTips: [],
    spans: [],
  }
  for (const { region, z, text, w, sign, n, span } of placed) {
    const wall = radiusAt(chamber.points, z) ?? outer
    const r = sign * laneR(n)
    layout.arrowheads.push({ at: [z, sign * wall], dir: [0, -sign], owner: region.name })
    layout.segs.push({ a: [z, sign * wall], b: [z, r], kind: 'thin', owner: region.name })
    layout.labels.push({
      text,
      c: [(span[0] + span[1]) / 2, r],
      dir: [1, 0],
      w,
      h: em,
      owner: region.name,
    })
  }
  const pts: PartPoint[] = [...layout.labels.flatMap(labelCorners), ...layout.segs.map((s) => s.b)]
  layout.box = [
    Math.min(box[0], ...pts.map((p) => p[0])),
    Math.min(box[1], ...pts.map((p) => p[1])),
    Math.max(box[2], ...pts.map((p) => p[0])),
    Math.max(box[3], ...pts.map((p) => p[1])),
  ]
  return layout
}
