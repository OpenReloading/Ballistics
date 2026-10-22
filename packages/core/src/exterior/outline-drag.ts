/**
 * Zero-yaw drag coefficient estimated from the bullet outline, `apps/docs/docs/models/exterior-outline-drag.md`.
 * Source: R. L. McCoy, ARBRL-TR-02293, 1981. Equation numbers and page numbers below are those of the
 * report; "listing" is its appendix (pp. 63 to 64), which fixes the constants and the Mach cut-offs
 * that the text leaves out. Lengths in calibers inside, SI at the interface.
 */
import type { DragTable } from '../drag-tables.ts'
import { need } from '../errors.ts'

/** Mach numbers of the report's output tables (Figures 26 to 28, p. 57 to 59). */
export const outlineDragMach: readonly number[] = [
  0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.925, 0.95, 0.975, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2,
  2.2, 2.5, 3, 3.5, 4,
]

/** Bullet outline for `estimateDragFromOutline`: lengths in m, shape factors dimensionless. */
export interface OutlineDragInput {
  /** Reference diameter, m. */
  diameter: number
  /** Overall length, m. */
  length: number
  /** Nose length to the meplat plane, m. */
  noseLength: number
  /** Head shape R_T/R: 0 cone, 1 tangent ogive, between for secant ogives (eq. 20, p. 27). */
  headShape: number
  /** Boat tail (or flare, negative angle) length, m; default 0. */
  boatTailLength?: number
  /** Base diameter, m; default the reference diameter. */
  baseDiameter?: number
  /** Meplat diameter, m; default 0 (sharp point). */
  meplatDiameter?: number
  /** Rotating band diameter, m; default the reference diameter (no band). */
  bandDiameter?: number
  /** Boundary layer option (p. 20); default laminar nose under 20 mm, else turbulent everywhere. */
  boundaryLayer?: 'laminar-nose' | 'turbulent'
  /** Mach numbers of the result; default `outlineDragMach`. */
  machNumbers?: readonly number[]
}

/**
 * Result warnings: diameter outside 4 to 400 mm, a Mach number outside 0.5 to 5, nose under 1
 * caliber, boat tail over 1.5 calibers, base under 0.65 caliber, or a negative base pressure ratio.
 */
export type OutlineDragWarning =
  | 'diameter-range'
  | 'mach-range'
  | 'nose-short'
  | 'boat-tail-long'
  | 'base-small'
  | 'base-pressure-negative'

/** Zero-yaw drag coefficient at one Mach number, with its parts. */
export interface OutlineDragNode {
  /** Mach number. */
  mach: number
  /** Total zero-yaw drag coefficient on area pi d^2 / 4. */
  dragCoefficient: number
  /** Head (nose and meplat) part of `dragCoefficient`. */
  head: number
  /** Skin friction part of `dragCoefficient`. */
  skinFriction: number
  /** Rotating band part of `dragCoefficient`. */
  band: number
  /** Boat tail part of `dragCoefficient`. */
  boatTail: number
  /** Base drag part of `dragCoefficient`. */
  base: number
  /** Base pressure over free stream static pressure (eq. 18). */
  basePressureRatio: number
  /** One standard deviation of `dragCoefficient` as a fraction of it (Figure 25, p. 56). */
  relativeStandardDeviation: number
}

/** Result of `estimateDragFromOutline`. */
export interface OutlineDragEstimate {
  /** One node per requested Mach number, in input order. */
  nodes: readonly OutlineDragNode[]
  /** `[mach, dragCoefficient]` for a `kind: 'curve'` drag. */
  dragTable: DragTable
  /** Limits of the method the input or the Mach numbers exceed; empty when none. */
  warnings: readonly OutlineDragWarning[]
}

/** Standard deviation of C_D0 in percent read from the solid curve of Figure 25 (about 0.5 points). */
const sdPercent: readonly (readonly [number, number])[] = [
  [0.5, 6],
  [0.7, 6.5],
  [0.8, 8],
  [0.9, 9],
  [0.95, 11],
  [1, 8],
  [1.1, 4],
  [1.3, 4],
  [1.4, 3.5],
  [1.8, 3],
]

/** Figure 25 curve, linear between its readings, flat outside them. */
function relativeSd(mach: number): number {
  const first = sdPercent[0]
  const last = sdPercent[sdPercent.length - 1]
  if (mach <= first[0]) return first[1] / 100
  if (mach >= last[0]) return last[1] / 100
  let k = 0
  while (sdPercent[k + 1][0] < mach) k++
  const [m0, s0] = sdPercent[k]
  const [m1, s1] = sdPercent[k + 1]
  return (s0 + ((s1 - s0) * (mach - m0)) / (m1 - m0)) / 100
}

/** Head drag, supersonic: eq. 2 with the thickness ratio of eq. 3 (p. 13 to 14), listing p. 64. */
function headSupersonic(m: number, tau: number, rtr: number): number {
  const c1 = 0.7156 - 0.5313 * rtr + 0.595 * rtr ** 2
  const c2 = 0.0796 + 0.0779 * rtr
  const c3 = 1.587 + 0.049 * rtr
  const c4 = 0.1122 + 0.1658 * rtr
  // below this Mach number the similarity variable is held (listing p. 64, not in the text)
  const mFloor = 1 + 0.368 * tau ** 1.85
  const z = m < mFloor ? Math.sqrt(mFloor * mFloor - 1) : Math.sqrt(m * m - 1)
  return ((c1 - c2 * tau ** 2) / (z * z)) * (tau * z) ** (c3 + c4 * tau)
}

/** Head drag, transonic and subsonic: eq. 8 above the critical Mach number (p. 16). */
function headTransonic(m: number, tau: number): number {
  const critical = (1 + 0.552 * tau ** 0.8) ** -0.5
  if (m <= critical) return 0
  return 0.368 * tau ** 1.8 + (1.6 * tau * (m * m - 1)) / (2.4 * m * m)
}

/**
 * Stagnation pressure on the meplat face, eq. 4 (p. 14); the leakage factor is 0.85 at
 * and above Mach 1.41 and blended from 0 at Mach 0.91 (listing p. 63; the text states 0.75).
 */
function meplat(m: number, dM: number): number {
  const m2 = m * m
  const pitot = m <= 1 ? (1 + 0.2 * m2) ** 3.5 : (1.2 * m2) ** 3.5 * (6 / (7 * m2 - 1)) ** 2.5
  // the listing carries pi / 4 in the factor 1.122 = (pi / 4) * 2 / gamma
  const face = (1.122 * (pitot - 1) * dM * dM) / m2
  if (m <= 0.91) return 0
  if (m >= 1.41) return 0.85 * face
  return (0.254 + (2.88 * (m2 - 1)) / (2.4 * m2)) * face
}

/** Boat tail drag, transonic form (eq. 10, p. 18) and supersonic form (eq. 9, p. 16 to 17). */
function boatTail(m: number, p: Shape): number {
  const { lbt, db, rtr, tau, lt, ln } = p
  if (lbt === 0) return 0
  const tb = (1 - db) / (2 * lbt)
  const chi = (m * m - 1) / (2.4 * m * m)
  const ebt = Math.exp(-2 * lbt)
  const rbt = 1 - ebt + 2 * tb * (ebt * (lbt + 0.5) - 0.5)
  if (m <= 1) {
    if (m <= 0.85) return 0
    return (2 * (2 * tb * tb + tb ** 3) * rbt) / (0.564 + 1250 * chi * chi)
  }
  if (m <= 1.1) return 2 * (2 * tb * tb + tb ** 3) * rbt * (1.774 - 9.3 * chi)
  const m2 = m * m
  const b2 = m2 - 1
  const b = Math.sqrt(b2)
  const k = 0.85 / b
  const a2 = (5 * tau) / (6 * b) + (0.5 * tau) ** 2 - (0.7435 / m2) * (tau * m) ** 1.6
  const a1 = (1 - (0.6 * rtr) / m) * a2
  const a =
    a1 * Math.exp((-1.1952 / m) * (lt - ln - lbt)) -
    ((2.4 * m2 * m2 - 4 * b2) * tb * tb) / (2 * b2 * b2) +
    (2 * tb) / b
  const e = Math.exp(-k * lbt)
  return (4 * a * tb * (1 - e + 2 * tb * (e * (lbt + 1 / k) - 1 / k))) / k
}

interface Shape {
  lt: number
  ln: number
  rtr: number
  lbt: number
  db: number
  tau: number
  laminarNose: boolean
  dMm: number
}

/** Skin friction, eqs. 11 to 17 (p. 18 to 20), listing p. 63. */
function skinFriction(m: number, p: Shape): number {
  const { lt, ln, rtr, dMm } = p
  const m2 = m * m
  const re = 23296.3 * m * lt * dMm // eq. 17, sea level, 15 degrees C
  const cfT = (0.455 / Math.log10(re) ** 2.58) * (1 + 0.21 * m2) ** -0.32 // eq. 13
  const cfL = (1.328 / Math.sqrt(re)) * (1 + 0.12 * m2) ** -0.12 // eq. 12
  const sNose = (Math.PI / 2) * ln * (1 + (0.333 + 0.02 / ln ** 2) * rtr) * (1 + 1 / (8 * ln ** 2)) // eq. 14
  const sCyl = Math.PI * (lt - ln) // eq. 15, listing rounds pi to 3.1416
  const cfNose = p.laminarNose ? cfL : cfT
  return (4 / Math.PI) * (cfNose * sNose + cfT * sCyl) // eq. 11 over the wetted area
}

/** Base pressure ratio, eq. 18 (p. 21), with the two fits of Figure 7 (listing p. 63). */
function basePressure(m: number, p: Shape): number {
  const m2 = m * m
  const pb2 =
    m < 1 ? 1 / (1 + 0.1875 * m2 + 0.0531 * m2 * m2) : 1 / (1 + 0.2477 * m2 + 0.0345 * m2 * m2)
  return pb2 * (1 + 0.09 * m2 * (1 - Math.exp(p.ln - p.lt))) * (1 + 0.25 * m2 * (1 - p.db))
}

/** Rotating band, Figure 6 (p. 18) as fitted in the listing p. 63, times (d_RB - 1). */
function band(m: number, dRB: number): number {
  return (m < 0.95 ? m ** 12.5 : 0.21 + 0.28 / (m * m)) * (dRB - 1)
}

/**
 * Estimates the zero-yaw drag coefficient from the outline. Throws `InputError` for a
 * geometry the method cannot take; a geometry or Mach number outside its stated limits
 * (p. 3, p. 26) gives a result and a warning.
 */
export function estimateDragFromOutline(input: OutlineDragInput): OutlineDragEstimate {
  const d = input.diameter
  need(Number.isFinite(d) && d > 0, 'diameter must be positive')
  const cal = (len: number) => len / d
  const lt = cal(input.length)
  const ln = cal(input.noseLength)
  const lbt = cal(input.boatTailLength ?? 0)
  const db = cal(input.baseDiameter ?? d)
  const dM = cal(input.meplatDiameter ?? 0)
  const dRB = cal(input.bandDiameter ?? d)
  const rtr = input.headShape
  need(Number.isFinite(lt) && ln > 0, 'length and noseLength must be positive')
  need(Number.isFinite(rtr) && rtr >= 0 && rtr <= 1, 'headShape must be from 0 to 1')
  need(Number.isFinite(lbt) && lbt >= 0, 'boatTailLength must be zero or more')
  need(Number.isFinite(db) && db > 0, 'baseDiameter must be positive')
  need(Number.isFinite(dM) && dM >= 0 && dM < 1, 'meplatDiameter must be zero up to the diameter')
  need(Number.isFinite(dRB) && dRB >= 1, 'bandDiameter must be at least the diameter')
  need(ln + lbt <= lt, 'noseLength plus boatTailLength must not exceed length')
  const dMm = d * 1000
  const shape: Shape = {
    lt,
    ln,
    rtr,
    lbt,
    db,
    tau: (1 - dM) / ln, // eq. 3
    laminarNose:
      (input.boundaryLayer ?? (dMm < 20 ? 'laminar-nose' : 'turbulent')) === 'laminar-nose',
    dMm,
  }
  const machs = input.machNumbers ?? outlineDragMach
  need(machs.length > 0 && machs.every((m) => Number.isFinite(m) && m > 0), 'mach must be positive')

  const nodes = machs.map((m): OutlineDragNode => {
    const head =
      (m <= 1 ? headTransonic(m, shape.tau) : headSupersonic(m, shape.tau, rtr)) + meplat(m, dM)
    const basePressureRatio = basePressure(m, shape)
    const skin = skinFriction(m, shape)
    const bandDrag = band(m, dRB)
    const bt = boatTail(m, shape)
    const baseDrag = (1.4286 * (1 - basePressureRatio) * db * db) / (m * m) // eq. 19
    return {
      mach: m,
      dragCoefficient: head + skin + bandDrag + bt + baseDrag,
      head,
      skinFriction: skin,
      band: bandDrag,
      boatTail: bt,
      base: baseDrag,
      basePressureRatio,
      relativeStandardDeviation: relativeSd(m),
    }
  })

  // an outline the method cannot take (a step as boat tail, a nose of no length, Mach near 0) gives
  // drag that is not finite or not positive: no estimate
  need(
    nodes.every((n) => Number.isFinite(n.dragCoefficient) && n.dragCoefficient > 0),
    'the outline gives no positive finite drag: outside the method',
  )
  const warnings: OutlineDragWarning[] = []
  if (dMm < 4 || dMm > 400) warnings.push('diameter-range')
  if (machs.some((m) => m < 0.5 || m > 5)) warnings.push('mach-range')
  if (ln < 1) warnings.push('nose-short')
  if (lbt > 1.5) warnings.push('boat-tail-long')
  if (db < 0.65) warnings.push('base-small')
  if (nodes.some((n) => n.basePressureRatio < 0)) warnings.push('base-pressure-negative')
  return { nodes, dragTable: nodes.map((n) => [n.mach, n.dragCoefficient] as const), warnings }
}
