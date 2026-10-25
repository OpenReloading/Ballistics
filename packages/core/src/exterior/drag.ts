/**
 * Drag input and table lookup, BC reference atmosphere and monotone cubic interpolation,
 * `apps/docs/docs/models/exterior-drag.md`.
 */
import { type DragModel, type DragTable, dragTables } from '../drag-tables.ts'

/**
 * The standard drag models, in the key order of the generated `dragTables` (a test pins it); a
 * literal, so a bundle that imports only other names from this module drops the tables.
 */
export const dragModels: readonly DragModel[] = ['G1', 'G2', 'G5', 'G6', 'G7', 'G8', 'GI', 'GS']

/** kg/m2 per lb/in2: converts a published ballistic coefficient to SI (exact). */
export const lbPerSqInToKgPerSqM = 0.45359237 / 0.0254 ** 2

/** One velocity band of a ballistic coefficient: applies while the airspeed is at least `minVelocity`. */
export interface BallisticCoefficientBand {
  /** Ballistic coefficient, kg/m2. */
  ballisticCoefficient: number
  /** Lowest airspeed of the band, m/s. */
  minVelocity: number
}

/** How a drag table or curve is read between nodes; default `'linear'`. */
export type DragInterpolation = 'linear' | 'monotone-cubic'

/**
 * Drag input of a projectile: a ballistic coefficient in velocity bands against a standard model,
 * or the bullet's own drag coefficient curve.
 */
export type DragInput =
  | {
      kind: 'bc'
      model: DragModel
      /** One or more bands; a single BC is one band with `minVelocity` 0. */
      bands: readonly BallisticCoefficientBand[]
      /** Reference atmosphere the maker states; stored, does not scale the drag. */
      reference?: 'icao' | 'metro'
      interpolation?: DragInterpolation
    }
  | {
      kind: 'curve'
      /** The bullet's own drag coefficient on area pi d^2 / 4, against Mach. */
      curve: DragTable
      interpolation?: DragInterpolation
    }

/** Drag table of a drag input: the curve itself, or the standard table of the BC's model. */
export function dragTableOf(drag: DragInput): DragTable {
  return drag.kind === 'curve' ? drag.curve : dragTables[drag.model]
}

/** Node `i` of a table; callers keep `i` inside it (tables have at least two nodes). */
function entry(table: DragTable, i: number): readonly [number, number] {
  const found = table[i]
  if (found === undefined) throw new RangeError(`node ${i} outside a drag table of ${table.length}`)
  return found
}

/** Index k of the node with table[k][0] <= mach < table[k + 1][0]; clamped to the table. */
function node(table: DragTable, mach: number): number {
  let lo = 0
  let hi = table.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (entry(table, mid)[0] <= mach) lo = mid
    else hi = mid
  }
  return lo
}

/** Slope of the monotone cubic at node j (Steffen 1990); the end secants at the ends. */
function nodeSlope(table: DragTable, j: number): number {
  const n = table.length - 1
  const secant = (k: number) => {
    const [m0, c0] = entry(table, k)
    const [m1, c1] = entry(table, k + 1)
    return (c1 - c0) / (m1 - m0)
  }
  if (j === 0) return secant(0)
  if (j === n) return secant(n - 1)
  const h0 = entry(table, j)[0] - entry(table, j - 1)[0]
  const h1 = entry(table, j + 1)[0] - entry(table, j)[0]
  const s0 = secant(j - 1)
  const s1 = secant(j)
  const p = (s0 * h1 + s1 * h0) / (h0 + h1)
  return (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), Math.abs(p) / 2)
}

/** Interpolant of segment k at a Mach number, extended past the segment's nodes. */
function onSegment(
  table: DragTable,
  k: number,
  mach: number,
  interpolation: DragInterpolation,
): number {
  const [m0, c0] = entry(table, k)
  const [m1, c1] = entry(table, k + 1)
  if (interpolation !== 'monotone-cubic') return c0 + ((c1 - c0) * (mach - m0)) / (m1 - m0)
  // both slopes are 0 here; the cubic basis in floating point is off by up to one unit
  if (c0 === c1) return c0
  const h = m1 - m0
  const t = (mach - m0) / h
  const u = (1 - t) ** 2
  return (
    c0 * ((1 + 2 * t) * u) +
    h * nodeSlope(table, k) * (t * u) +
    c1 * (t * t * (3 - 2 * t)) +
    h * nodeSlope(table, k + 1) * (t * t * (t - 1))
  )
}

/** Drag coefficient at a Mach number between the nodes, held at the end values outside. */
export function dragCoefficient(
  table: DragTable,
  mach: number,
  interpolation: DragInterpolation = 'linear',
): number {
  if (mach <= entry(table, 0)[0]) return entry(table, 0)[1]
  const last = entry(table, table.length - 1)
  if (mach >= last[0]) return last[1]
  return onSegment(table, node(table, mach), mach, interpolation)
}

/**
 * Segment k of the table that holds `mach` (table[k][0] <= mach < table[k + 1][0]); -1 below the
 * first node, table.length - 1 at or above the last.
 */
export function dragSegment(table: DragTable, mach: number): number {
  if (mach < entry(table, 0)[0]) return -1
  if (mach >= entry(table, table.length - 1)[0]) return table.length - 1
  return node(table, mach)
}

/** Width in Mach below which a segment is held at its node values outside its nodes. */
const narrowSegment = 1e-6

/** Change per Mach, relative to the larger node value, above which a segment is held too. */
const steepSegment = 100

/**
 * True when segment k (see `dragSegment`) is held at its node values outside its nodes: narrower
 * than `narrowSegment`, or, with `slope`, steeper than `steepSegment`; false outside the table.
 */
export function heldSegment(table: DragTable, k: number, slope = true): boolean {
  if (k < 0 || k >= table.length - 1) return false
  const [m0, c0] = entry(table, k)
  const [m1, c1] = entry(table, k + 1)
  // a narrow or steep drag segment's extension can reach zero drag within one trial step; a
  // coefficient table may change sign, so only the width rule applies to it
  return (
    m1 - m0 < narrowSegment ||
    (slope && Math.abs(c1 - c0) > steepSegment * (m1 - m0) * Math.max(Math.abs(c0), Math.abs(c1)))
  )
}

/**
 * Drag coefficient on segment k (see `dragSegment`), extended past the segment's nodes as the same
 * line or cubic, or held at the node values when `held` (default: `heldSegment` with the slope
 * rule, the reading of a drag table; a coefficient table passes `heldSegment(table, k, false)`);
 * the end value on the segments outside the table. The integrator holds k fixed within a step.
 */
export function segmentCoefficient(
  table: DragTable,
  k: number,
  mach: number,
  interpolation: DragInterpolation = 'linear',
  held?: boolean,
): number {
  if (k < 0) return entry(table, 0)[1]
  if (k >= table.length - 1) return entry(table, table.length - 1)[1]
  const m =
    (held ?? heldSegment(table, k))
      ? Math.min(entry(table, k + 1)[0], Math.max(entry(table, k)[0], mach))
      : mach
  return onSegment(table, k, m, interpolation)
}

/** True when the Mach number lies inside the table's Mach range (no clamping needed). */
export function inDragTable(table: DragTable, mach: number): boolean {
  return mach >= entry(table, 0)[0] && mach <= entry(table, table.length - 1)[0]
}
