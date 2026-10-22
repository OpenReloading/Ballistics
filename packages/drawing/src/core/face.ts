/**
 * Constants of the technical face, in mm. Distances marked "at 1.6 em" are the old face's at its
 * 1.6 mm text and scale with the text size (`k = em / 1.6`).
 */
/** Filled arrowhead, length and full width. */
export const arrow = { length: 1.1, width: 0.7 }
/** A span under this many arrow lengths takes its arrows outside, on tails of `arrowTailLengths` arrows. */
export const shortSpan = 3
/** Length of the tail of an outside arrow, in arrow lengths. */
export const arrowTailLengths = 2.2
/** Gap between a feature and the start of its extension line, mm. */
export const extensionGap = 0.5
/** How far an extension line runs past its dimension line, mm. */
export const overrun = 0.9
/** Text size of the old face; the lane distances below are at this size. */
export const baseEm = 1.6
/** At 1.6 em: distance from the widest radius to the first lane of length dimensions, mm. */
export const firstLaneOffset = 3.0
/** At 1.6 em: the distance between two lanes of length dimensions, mm. */
export const lanePitch = 3.2
/** At 1.6 em: the zigzag of a broken rule. */
export const breakLength = 2.4
/** At 1.6 em: the amplitude of the zigzag of a broken rule, mm. */
export const breakAmplitude = 0.7
/** A length rule that ends beyond zMax times (1 + this value) is drawn broken. */
export const breakAllowance = 0.2
/**
 * At 1.6 em: length of a radius leader from its corner to its text, and the step of the callout
 * leader lengths, mm.
 */
export const radiusLeaderLength = 5
/** At 1.6 em: the radius of the delta and i arcs, mm. */
export const smallArc = 4.2
/** At 1.6 em: the length of the flanks of the delta and i arcs, mm. */
export const smallFlank = 7.5
/**
 * The alpha arc radius as a multiple of the vertex distance from L1, shortened where the flanks
 * would reach the texts of lane 0 or the arc's middle come nearer the head than 0.35 zMax.
 */
export const alphaArc = 1.6
/** In em: the farthest an angle text without a leader sits from its arc. */
export const nearArc = 3
/** Space between the annotation box and the figure frame, mm. */
export const frameMargin = 4
/**
 * Width of the steel band drawn around the chamber cavity, mm; a drawing convention, not a barrel
 * wall thickness.
 */
export const steelBandWidth = 3
/** Screen: drawing px per mm before the column caps it; the narrowest column (390 px page). */
export const pxPerMm = 8
/** Screen: width of the narrowest drawing column, CSS px. */
export const phoneColumn = 358
/** Screen: the smallest text size, CSS px. */
export const minTextPx = 11
/** The smallest text size (one em) of a screen drawing, mm. */
export const minEm = 1.8
/** Print: text size (one em), mm. */
export const printEm = 2.5
/** Print: the widest drawing, mm. */
export const printWidth = 190
/** Diameter sign before a diameter symbol (U+2205; the font has no U+2300). */
export const diameterSign = '∅'
/** Axis dash pattern, mm. */
export const axisDash = [2, 1, 0.4, 1]
