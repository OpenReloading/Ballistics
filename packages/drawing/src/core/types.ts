import type { PartPoint } from './section.ts'
import type { LengthUnit } from './units.ts'

/** Point of a half section: radius r and distance z from the head, both in mm. */
export type SectionPoint = [r: number, z: number]

/**
 * A stored value of a standard as the drawing reads it, in the stored unit (mm, degrees). The API
 * type of a spec value is assignable to it.
 */
export interface SpecValue {
  side?: string | undefined
  symbol: string
  quantity?: string | undefined
  value?: number | undefined
  limit?: 'max' | 'min' | undefined
  tolerance?: { lower?: number | undefined; upper?: number | undefined } | undefined
  variant?: string | undefined
}

/** Stored values that disagree, or a value the outline cannot follow; the text gives both. */
export interface Note<Code extends string = string> {
  code: Code
  symbols: string[]
  text: string
  /** The point of the feature the note concerns, in the half section; none on `closedFront`. */
  at?: SectionPoint
  /** Its number in the figure (`recordFigures`), kept when one side is laid out alone. */
  flagNumber?: number
}

/**
 * The outline of one side and its annotation, in mm and degrees: the points, the notes on values
 * the outline could not follow, and the dimensions, angles and radii drawn on it.
 */
export interface Profile<Code extends string = string> {
  /** From the axis at the head (z = 0) to the mouth (cartridge) or the bore (chamber). */
  points: SectionPoint[]
  notes: Note<Code>[]
  annotation: Annotation
  /** A cartridge e derived from delta (grooveDerivedE): for the description, never dimensioned. */
  derivedE?: number | undefined
}

/**
 * A length (from a datum at z = 0), a chain (from another station), or a diameter at z, in mm.
 * The value is the stored one, or for a derived chain its formula.
 */
export interface Dimension {
  kind: 'length' | 'chain' | 'diameter'
  symbol: string
  value: number
  /** The stored value; absent on a derived value. */
  stored?: SpecValue
  derived?: true
  /** Length and chain: from z to z; diameter: the station, from = to. */
  from: number
  to: number
  /** Diameter: half the value. */
  radius?: number | undefined
  /**
   * Dimensioned behind the head face: a head diameter (R1, E1, R3; table VII g, d, G, D) or a head
   * length (R, E, e; table VII t, T).
   */
  behindHeadFace?: true
  /** Diameter: the way along the axis it may move off its station, on its own segment. */
  toward?: 1 | -1
  /** A diameter dimensioned past the mouth (the cartridge G1, the bullet not drawn). */
  front?: true
  /** S, on the side opposite the length stack. */
  far?: true
}

/** An angle about its vertex: the rays to the two flank points bound it. */
export interface AngleMark {
  kind: 'angle'
  symbol: string
  value: number
  stored: SpecValue
  vertex: SectionPoint
  flanks: [SectionPoint, SectionPoint]
}

/** A fillet radius at the corner it rounds, before rounding. */
export interface RadiusMark {
  kind: 'radius'
  symbol: string
  value: number
  stored: SpecValue
  corner: SectionPoint
}

/** A drawn part no value gives: never dimensioned. */
export interface Convention {
  kind: 'boreStub' | 'g1Stub'
  r: number
  from: number
  to: number
}

/**
 * Dimensions, angles, radii, edge stations and conventions drawn on one half section; lengths in
 * mm, angles in degrees.
 */
export interface Annotation {
  dimensions: Dimension[]
  angles: AngleMark[]
  radii: RadiusMark[]
  /** z of the real transitions, where edge lines cross the section; not the mouth. */
  edges: number[]
  conventions: Convention[]
}

/** A text box: centre, unit direction of the text, width and height (one em), its dimension. */
export interface Label {
  text: string
  c: PartPoint
  dir: PartPoint
  w: number
  h: number
  owner: string
  /** A note flag: the number in a circle of diameter w. */
  ring?: true
}

/** A dimension line (`rule`) or an extension line, flank or leader (`thin`). */
export interface LineSegment {
  a: PartPoint
  b: PartPoint
  kind: 'rule' | 'thin'
  owner: string
  /** A leader to a text: an angle's from its arc, a radius's from its corner. */
  leader?: true
}

/** An angle arc about c, from angle `from` to `to` (radians in the part frame). */
export interface Arc {
  c: PartPoint
  r: number
  from: number
  to: number
  owner: string
}

/** A filled arrowhead with its tip at `at`, pointing along `dir`. */
export interface Arrowhead {
  at: PartPoint
  dir: PartPoint
  owner: string
}

/** What `annotate` places for one side: texts, rules, arcs and arrowheads, in mm in the part frame. */
export interface Layout {
  labels: Label[]
  segs: LineSegment[]
  arcs: Arc[]
  arrowheads: Arrowhead[]
  /** [x0, y0, x1, y1] in the part frame. */
  box: [number, number, number, number]
  /** Arrow tips of the diameters across the part, for the sweep. */
  diameterTips: { owner: string; tips: [PartPoint, PartPoint] }[]
  /** Spans of the length dimensions, with whether their arrows sit outside. */
  spans: { owner: string; length: number; outside: boolean; broken: boolean }[]
}

/**
 * Input of `annotate`: the half section of one side, its annotation, the steel band edge (chamber),
 * the callouts and the length unit.
 */
export interface Part {
  points: SectionPoint[]
  annotation: Annotation
  /** Steel band edge for a chamber; extension lines start there. */
  outer?: number | undefined
  /** Texts on a leader from a feature (note flags, detail letters), placed after the rest. */
  callouts?: Callout[]
  /** The unit of the length texts; mm by default. */
  unit?: LengthUnit | undefined
}

/** A note flag (its number in a circle) or a detail letter, on a leader from the feature at `at`. */
export interface Callout {
  owner: string
  text: string
  /** The feature in the half section. */
  at: SectionPoint
  letter?: true
}
