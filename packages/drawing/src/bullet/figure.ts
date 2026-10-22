import { annotate } from '../core/annotate.ts'
import { layoutCache } from '../core/cache.ts'
import {
  axisReach,
  figureFrame,
  fitEm,
  frameWidth,
  type Medium,
  readingDirection,
  type ScaleBar,
} from '../core/layout.ts'
import { edgeLines, fullSection, svgPath, toPartFrame as toFrame } from '../core/section.ts'
import type { Layout } from '../core/types.ts'
import type { LengthUnit } from '../core/units.ts'
import type { BulletProfile } from './profile.ts'

/** Everything one SVG of a bullet draws, in mm; paths in the part frame. */
export interface BulletModel {
  medium: Medium
  em: number
  /** viewBox of the outer frame in mm: x, y, width, height. */
  frame: [number, number, number, number]
  bullet: {
    section: string
    /** Strokes where the record gives the shape. */
    outline: string
    /** Strokes where the outline assumed the shape. */
    approximate: string
    edges: string
  }
  axis: { bullet: [number, number] }
  layers: { bullet: Layout }
  scale: ScaleBar
  details: never[]
}

type Laid = { layout: Layout; axis: [number, number]; box: [number, number, number, number] }

/** The profile laid out at text size em, once per profile, medium, size and unit. */
const laid = layoutCache((p: BulletProfile, medium: Medium, em: number, unit: LengthUnit): Laid => {
  const axis = axisReach(p)
  const layout = annotate(
    { points: p.points, annotation: p.annotation, unit },
    em,
    readingDirection(medium),
    axis,
  )
  const b = layout.box
  const box: Laid['box'] = [
    Math.min(b[0], axis[0]),
    Math.min(b[1], 0),
    Math.max(b[2], axis[1]),
    Math.max(b[3], 0),
  ]
  return { layout, axis, box }
})

/** The smallest text size of at least 1.8 mm that renders 11 CSS px in the 358 px phone column. */
export const bulletScreenEm = (p: BulletProfile, unit: LengthUnit = 'mm') =>
  fitEm((em) => frameWidth(laid(p, 'screen', em, unit).box, 'screen', em, unit))

/**
 * The model of one SVG of a bullet at text size em, at least `across` mm wide on the medium, its
 * length texts in `unit`.
 */
export function bulletFigureModel(
  p: BulletProfile,
  medium: Medium,
  em: number,
  across = 0,
  unit: LengthUnit = 'mm',
): BulletModel {
  const { layout, axis, box } = laid(p, medium, em, unit)
  const { frame, scale } = figureFrame(box, medium, em, across, unit)
  const strokes = (approximate: boolean) =>
    p.outline.segments
      .filter((s) => s.approximate === approximate)
      .map((s) => svgPath(toFrame(s.points)) + svgPath(toFrame(s.points, -1)))
      .join('')
  const rMax = Math.max(...p.points.map(([r]) => r))
  return {
    medium,
    em,
    frame,
    bullet: {
      section: svgPath(fullSection(p.points), true),
      outline: strokes(false),
      approximate: strokes(true),
      edges: edgeLines(p.annotation.edges, rMax)
        .map((l) => svgPath(l))
        .join(''),
    },
    axis: { bullet: axis },
    layers: { bullet: layout },
    scale,
    details: [],
  }
}
