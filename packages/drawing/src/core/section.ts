import * as face from './face.ts'
import type { Annotation, SectionPoint } from './types.ts'
import { pairs } from './vector.ts'

/** A point of the part frame in mm: x along the axis from the head (z), y across it (signed r). */
export type PartPoint = [x: number, y: number]

// to 0.01 mm, the step of the stored values
const num = (x: number) => String(Number(x.toFixed(2)))
/** SVG path data through the points, closed with `close`. */
export const svgPath = (pts: PartPoint[], close = false) =>
  `M${pts.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}${close ? 'Z' : ''}`

/** Half profile [r, z] to the part frame, on the side `sign`. */
export const toPartFrame = (points: SectionPoint[], sign = 1) =>
  points.map(([r, z]): PartPoint => [z, sign * r])

/** The full section of a half profile from the axis: up one side, back on the mirrored side. */
export function fullSection(points: SectionPoint[]): PartPoint[] {
  return [...toPartFrame(points), ...toPartFrame(points, -1).reverse()]
}

/** Radius of the steel band's outer edge: the widest bore radius plus the band. */
export const steelRadius = (chamber: SectionPoint[]) =>
  Math.max(...chamber.map(([r]) => r)) + face.steelBandWidth

/**
 * The marked steel band around a chamber cavity, one closed polygon per side, its stroke (the
 * head face, the bore and the outer edge, not the cut end) and the break line across the cut end.
 */
export function steelBand(chamber: SectionPoint[], em: number) {
  const bore = chamber.slice(1)
  const outer = steelRadius(chamber)
  const [zEnd, rEnd] = [(bore.at(-1) as SectionPoint)[1], (bore.at(-1) as SectionPoint)[0]]
  const k = em / face.baseEm
  const sides = [1, -1].map((sign) => {
    const along = toPartFrame(bore, sign)
    const polygon: PartPoint[] = [...along, [zEnd, sign * outer], [0, sign * outer]]
    const stroke: PartPoint[] = [[zEnd, sign * outer], [0, sign * outer], ...along]
    // a zigzag across the cut steel, from the bore to the outer edge
    const [a, b] = [rEnd, outer]
    const mid = (a + b) / 2
    const amp = Math.min(face.breakAmplitude * k, (b - a) / 4)
    const zig: PartPoint[] = [
      [zEnd, sign * a],
      [zEnd, sign * (mid - amp)],
      [zEnd + amp, sign * (mid - amp / 2)],
      [zEnd - amp, sign * (mid + amp / 2)],
      [zEnd, sign * (mid + amp)],
      [zEnd, sign * b],
    ]
    return { polygon, stroke, zig }
  })
  return { outer, sides }
}

/**
 * The chamber head face across the cavity mouth, where a head diameter lies inside the drawn head
 * (R1 below P1 or R3; table VII D below G): its extension lines end there, not in the open mouth.
 */
export function headFace(
  chamber: SectionPoint[],
  annotation: Annotation,
): [PartPoint, PartPoint] | undefined {
  const head = chamber[1]?.[0]
  if (head === undefined) return
  if (
    !annotation.dimensions.some(
      (d) => d.kind === 'diameter' && d.behindHeadFace && (d.radius as number) < head - 0.01,
    )
  )
    return
  return [
    [0, -head],
    [0, head],
  ]
}

/** Edge lines across the section at the stations, as long as the widest radius; clipped by the caller. */
export const edgeLines = (edges: number[], r: number) =>
  edges.map((z): [PartPoint, PartPoint] => [
    [z, -r],
    [z, r],
  ])

/** Radius of a half profile at z: the largest where it steps there, undefined outside it. */
export function radiusAt(points: SectionPoint[], z: number): number | undefined {
  let found: number | undefined
  for (const [[r0, z0], [r1, z1]] of pairs(points)) {
    if (z < Math.min(z0, z1) - 1e-9 || z > Math.max(z0, z1) + 1e-9) continue
    const r = Math.abs(z1 - z0) < 1e-12 ? Math.max(r0, r1) : r0 + ((r1 - r0) * (z - z0)) / (z1 - z0)
    found = found === undefined ? r : Math.max(found, r)
  }
  return found
}
