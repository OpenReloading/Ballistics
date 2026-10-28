/**
 * Mass properties of a bullet of uniform density from its outline,
 * `apps/docs/docs/models/exterior-modified-point-mass.md`. The outline is the one of
 * `estimateDragFromOutline`: boat tail, cylinder, then a nose arc of radius R = Rt / headShape
 * through the shank end and the meplat edge (a cone for headShape 0). SI in and out.
 */
import { need } from '../errors.ts'
import type { OutlineDragInput } from './outline-drag.ts'

/** Outline of {@link outlineInertia}: the shape fields of `OutlineDragInput`, and the mass, kg. */
export interface OutlineInertiaInput
  extends Pick<
    OutlineDragInput,
    | 'diameter'
    | 'length'
    | 'noseLength'
    | 'headShape'
    | 'boatTailLength'
    | 'baseDiameter'
    | 'meplatDiameter'
  > {
  /** Bullet mass, kg; the density is the mass over the volume of the outline. */
  mass: number
}

/** Mass properties of the outline at uniform density. */
export interface OutlineInertia {
  /** Axial moment of inertia, kg m2. */
  axial: number
  /** Transverse moment of inertia about the centre of mass, kg m2. */
  transverse: number
  /** Volume of the outline, m3. */
  volume: number
  /** Distance of the centre of mass from the base, m. */
  centreFromBase: number
  /**
   * Overturning-moment slope from the geometry alone, 8 [V - z_cm A_B] / (pi d^3), 1/rad, with the
   * base area A_B. A slope over-estimate in supersonic flight, so the stability factor it gives is low.
   */
  momentSlope: number
}

/** Panels per piece of the profile and nodes per panel of the quadrature. */
const panels = 200
const nodes: readonly (readonly [number, number])[] = [
  [0, 0.5688888888888889],
  [0.5384693101056831, 0.4786286704993665],
  [-0.5384693101056831, 0.4786286704993665],
  [0.906179845938664, 0.2369268850561891],
  [-0.906179845938664, 0.2369268850561891],
]

/** Gauss-Legendre quadrature of `f` over [a, b], `panels` panels of 5 nodes. */
function integrate(f: (z: number) => number, a: number, b: number): number {
  const h = (b - a) / panels
  let sum = 0
  for (let i = 0; i < panels; i++) {
    const mid = a + (i + 0.5) * h
    for (const [x, w] of nodes) sum += w * f(mid + (x * h) / 2)
  }
  return (sum * h) / 2
}

/** A piece of the profile: radius r(z) over z from `from` to `to`, m from the base. */
interface Piece {
  from: number
  to: number
  r: (z: number) => number
}

/** The radius profile from the base, as pieces. */
function profile(i: OutlineInertiaInput): { pieces: Piece[]; baseRadius: number } {
  const a = i.diameter / 2
  const n = i.noseLength
  const lbt = i.boatTailLength ?? 0
  const m = (i.meplatDiameter ?? 0) / 2
  const q = i.headShape
  const k = a - m
  const z0 = i.length - n
  need(Number.isFinite(i.mass) && i.mass > 0, 'mass must be positive')
  need(Number.isFinite(i.diameter) && i.diameter > 0, 'diameter must be positive')
  need(
    Number.isFinite(n) && n > 0 && Number.isFinite(i.length),
    'length and noseLength must be positive',
  )
  need(Number.isFinite(q) && q >= 0 && q <= 1, 'headShape must be from 0 to 1')
  need(Number.isFinite(lbt) && lbt >= 0, 'boatTailLength must be zero or more')
  need(k > 0, 'meplatDiameter must be zero up to the diameter')
  need(z0 >= lbt, 'noseLength plus boatTailLength must not exceed length')
  need(q === 0 || n >= k, 'noseLength must be at least the radial drop of the nose')
  const base = i.baseDiameter === undefined || lbt === 0 ? a : i.baseDiameter / 2
  need(Number.isFinite(base) && base > 0, 'baseDiameter must be positive')
  // arc through the shank end (a, z0) and the meplat edge (m, length) of radius R = Rt / q, the
  // centre on the axis side; Rt is the tangent ogive radius of that length and drop
  const rt = (n * n + k * k) / (2 * k)
  const nose = ((): ((z: number) => number) => {
    if (q < 1e-6) return (z) => a - (k * (z - z0)) / n
    const radius = rt / q
    const c = Math.hypot(k, n)
    const h = Math.sqrt(Math.max(radius ** 2 - c ** 2 / 4, 0))
    const cr = a - k / 2 - (h * n) / c
    const cz = z0 + n / 2 - (h * k) / c
    return (z) => cr + Math.sqrt(Math.max(radius ** 2 - (z - cz) ** 2, 0))
  })()
  const pieces = [
    ...(lbt > 0 ? [{ from: 0, to: lbt, r: (z: number) => base + ((a - base) * z) / lbt }] : []),
    ...(z0 > lbt ? [{ from: lbt, to: z0, r: () => a }] : []),
    { from: z0, to: i.length, r: nose },
  ]
  return { pieces, baseRadius: base }
}

/**
 * Axial and transverse moments of inertia, volume, centre of mass and geometric moment slope of
 * a body of revolution of uniform density with the stated outline. The axial moment is
 * (pi rho / 2) times the integral of r^4 dz; the transverse moment about the centre of mass is
 * rho times the integral of (pi r^4 / 4 + pi r^2 (z - z_cm)^2) dz (any rigid-body text, for
 * example Kneubuehl 2018, section 2.2). Quadrature: {@link panels} panels of five Gauss-Legendre
 * nodes on each piece. Throws `InputError` for an outline that does not close. The density split
 * of jacket and core is not known from the outline: an estimate only.
 */
export function outlineInertia(input: OutlineInertiaInput): OutlineInertia {
  const { pieces, baseRadius } = profile(input)
  const sum = (f: (r: number, z: number) => number) =>
    pieces.reduce((s, p) => s + integrate((z) => f(p.r(z), z), p.from, p.to), 0)
  const volume = Math.PI * sum((r) => r * r)
  const centreFromBase = (Math.PI * sum((r, z) => r * r * z)) / volume
  const density = input.mass / volume
  const axial = (Math.PI * density * sum((r) => r ** 4)) / 2
  const transverse =
    density * Math.PI * sum((r, z) => r ** 4 / 4 + r * r * (z - centreFromBase) ** 2)
  const baseArea = Math.PI * baseRadius ** 2
  const momentSlope = (8 * (volume - centreFromBase * baseArea)) / (Math.PI * input.diameter ** 3)
  return { axial, transverse, volume, centreFromBase, momentSlope }
}
