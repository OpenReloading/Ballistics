import { annotate } from '../core/annotate.ts'
import { layoutCache } from '../core/cache.ts'
import * as face from '../core/face.ts'
import {
  axisReach,
  type Drawn as CoreDrawn,
  figureFrame,
  fitEm,
  frameWidth,
  type Medium,
  readingDirection,
  type ScaleBar,
} from '../core/layout.ts'
import {
  edgeLines,
  fullSection,
  headFace,
  steelBand,
  steelRadius,
  svgPath,
} from '../core/section.ts'
import type { Callout, Layout, Part } from '../core/types.ts'
import type { LengthUnit } from '../core/units.ts'
import { regionCallouts } from './callouts.ts'
import { type DetailSpec, detailSpecs, detailWindow } from './detail.ts'
import { flagged, type Side } from './figures.ts'
import type { Profile } from './profile.ts'
import type { Region } from './regions.ts'

/** The sides of one cartridge figure. */
export type Drawn = CoreDrawn<Side, Profile>

/** Everything one SVG of a figure draws, in mm; paths in the part frame. */
export interface FigureModel {
  medium: Medium
  em: number
  /** viewBox of the outer frame in mm: x, y, width, height. */
  frame: [number, number, number, number]
  cartridge?: { section: string; edges: string } | undefined
  chamber?:
    | {
        cavity: string
        steel: string
        outline: string
        breaks: string
        edges: string
        /** The head face across the cavity mouth, where a head diameter lies inside the drawn head. */
        face?: string | undefined
      }
    | undefined
  /** The dash-dot axis of each side, from just behind the head to just past its end or a station past it. */
  axis: Partial<Record<Side, [number, number]>>
  /** The dimensions of each side; the region callouts of Combined. */
  layers: Partial<Record<Side | 'combined', Layout>>
  /** The 1-2-5 scale bar and the unit note, in the outer frame. */
  scale: ScaleBar
  /** Screen, when asked for: the detail views its letters open. */
  details: Detail[]
}

/**
 * Enlarged view of one feature of a side: `scale` times the half section, cropped to `window`
 * ([minR, minZ, maxR, maxZ], mm at that scale).
 */
export interface Detail {
  side: Side
  letter: DetailSpec['letter']
  scale: number
  window: [number, number, number, number]
}

type Laid = {
  layers: Partial<Record<Side, Layout>>
  box: [number, number, number, number]
  axis: Partial<Record<Side, [number, number]>>
}

/** Lays out the sides of one figure at text size em, once per figure, medium, size and unit. */
const layouts = layoutCache((drawn: Drawn, medium: Medium, em: number, unit: LengthUnit): Laid => {
  const layers: Partial<Record<Side, Layout>> = {}
  const axis: Partial<Record<Side, [number, number]>> = {}
  for (const { side, p } of drawn) {
    axis[side] = axisReach(p)
    layers[side] = annotate(partOf(drawn, side, p, unit), em, readingDirection(medium), axis[side])
  }
  const boxes = [
    ...Object.values(layers).map((l) => l.box),
    ...Object.values(axis).map(([a, b]): [number, number, number, number] => [a, 0, b, 0]),
  ]
  const box = ([0, 1, 2, 3] as const).map((k) =>
    k < 2 ? Math.min(...boxes.map((b) => b[k])) : Math.max(...boxes.map((b) => b[k])),
  ) as [number, number, number, number]
  return { layers, box, axis }
})

/** A side as `annotate()` takes it: its note flags, and the letters of `details`, as callouts. */
const partOf = (
  drawn: Drawn,
  side: Side,
  p: Profile,
  unit: LengthUnit,
  details: DetailSpec[] = [],
): Part => ({
  points: p.points,
  annotation: p.annotation,
  unit,
  ...(side === 'chamber' ? { outer: steelRadius(p.points) } : {}),
  callouts: [
    ...flagged(drawn).flatMap(({ side: s, note, n }): Callout[] =>
      s === side && note.at ? [{ owner: `flag ${n}`, text: String(n), at: note.at }] : [],
    ),
    ...details.map(
      (d): Callout => ({ owner: `detail ${d.letter}`, text: d.letter, at: d.anchor, letter: true }),
    ),
  ],
})

/** The smallest text size of at least 1.8 mm that renders 11 CSS px when the widest figure fills the 358 px phone column (`fitEm`). */
export const screenEm = (figures: Drawn[], unit: LengthUnit = 'mm') =>
  fitEm((em) =>
    Math.max(
      ...figures.map((d) => frameWidth(layouts(d, 'screen', em, unit).box, 'screen', em, unit)),
    ),
  )

/**
 * The model of one SVG: the sides laid out at em, in a frame of at least `across` mm across the
 * medium's page direction (figures of one record share the screen width, so their scale), and
 * with both sides the callouts of `regions` in the Combined layer. With `details` on screen, each
 * side's layer gets the letters of its detail views, laid out in a second pass that keeps the
 * frame and every other mark. Length texts in `unit`, the geometry in mm.
 */
export function figureModel(
  drawn: Drawn,
  medium: Medium,
  em: number,
  across = 0,
  regions: Region[] = [],
  details = false,
  unit: LengthUnit = 'mm',
): FigureModel {
  const laid = layouts(drawn, medium, em, unit)
  const { axis } = laid
  const [cartridge, chamber] = (['cartridge', 'chamber'] as const).map(
    (side) => drawn.find((d) => d.side === side)?.p,
  )
  const combined =
    cartridge && chamber && regions.length
      ? regionCallouts(cartridge, chamber, regions, em, laid.box, unit)
      : undefined
  const layers: FigureModel['layers'] = { ...laid.layers, ...(combined ? { combined } : {}) }
  const box = combined ? combined.box : laid.box
  const turned = medium === 'screen'
  const { frame, scale } = figureFrame(box, medium, em, across, unit)
  const model: FigureModel = { medium, em, frame, axis, layers, scale, details: [] }
  if (details && turned) addDetails(model, drawn, unit)
  for (const { side, p } of drawn)
    if (side === 'cartridge') model.cartridge = cartridgeModel(p)
    else model.chamber = chamberModel(p, em)
  return model
}

/**
 * Adds the detail views of each side to a screen model: their letters laid out in a second pass
 * that keeps the frame and every other mark, and their windows.
 */
function addDetails(model: FigureModel, drawn: Drawn, unit: LengthUnit) {
  const { layers, em, medium, axis } = model
  for (const { side, p } of drawn) {
    const specs = detailSpecs(side, p)
    const layer = layers[side]
    if (!specs.length || !layer) continue
    const lettered = annotate(
      partOf(drawn, side, p, unit, specs),
      em,
      readingDirection(medium),
      axis[side] ?? [0, 0],
    )
    const letter = (x: { owner: string }) => x.owner.startsWith('detail ')
    layers[side] = {
      ...layer,
      labels: [...layer.labels, ...lettered.labels.filter(letter)],
      segs: [...layer.segs, ...lettered.segs.filter(letter)],
    }
    // the scale at the main view's px per mm on the 390 px page
    const pxPerMm = Math.min(face.pxPerMm, face.phoneColumn / model.frame[2])
    for (const spec of specs)
      model.details.push({ side, letter: spec.letter, ...detailWindow(spec, pxPerMm) })
  }
}

/** The cartridge section and its edge lines, as SVG paths. */
function cartridgeModel(p: Profile): NonNullable<FigureModel['cartridge']> {
  const rMax = Math.max(...p.points.map(([r]) => r))
  return {
    section: svgPath(fullSection(p.points), true),
    edges: edgeLines(p.annotation.edges, rMax)
      .map((l) => svgPath(l))
      .join(''),
  }
}

/** The chamber cavity, the steel band, its outline and break lines, the edges and head face, as SVG paths. */
function chamberModel(p: Profile, em: number): NonNullable<FigureModel['chamber']> {
  const band = steelBand(p.points, em)
  const head = headFace(p.points, p.annotation)
  return {
    cavity: svgPath(fullSection(p.points), true),
    steel: band.sides.map((s) => svgPath(s.polygon, true)).join(''),
    outline: band.sides.map((s) => svgPath(s.stroke)).join(''),
    breaks: band.sides.map((s) => svgPath(s.zig)).join(''),
    edges: edgeLines(p.annotation.edges, band.outer)
      .map((l) => svgPath(l))
      .join(''),
    ...(head ? { face: svgPath(head) } : {}),
  }
}

/** The width of a figure across the screen column, in mm, at text size em (for the sweep). */
export const screenWidth = (drawn: Drawn, em: number, unit: LengthUnit = 'mm') =>
  frameWidth(layouts(drawn, 'screen', em, unit).box, 'screen', em, unit)
