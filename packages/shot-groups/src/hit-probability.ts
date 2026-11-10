/** From a point dispersion (`apps/docs/docs/models/hit-probability.md`); SI throughout: lengths m, speeds m/s, angles rad; a refusal is an `InputError` with a `HitIssue`. */

import { chiSquareCdf, need, nth } from '@open-reloading/statistics'

/** A scoring zone: an ellipse about the aim point with the value a hit inside it scores. */
export interface ScoringZone {
  /** Semi-axis along x (right), m. */
  halfWidth: number
  /** Semi-axis along y (up), m; equal to `halfWidth` for a circle. */
  halfHeight: number
  /** Value of the zone. */
  value: number
}

/** The shot's point dispersion on the target: standard deviations per axis, m. */
export interface PointDispersion {
  horizontal: number
  vertical: number
}

/** Inputs of {@link pointDispersion}. */
export interface DispersionInput {
  /** Standard deviation per axis of the group at the reference distance, m. */
  group: PointDispersion
  /** Distance the group was shot at, m. */
  referenceDistance: number
  /** Distance of the target, m. */
  distance: number
  /** Wind and its uncertainty; absent: none. */
  wind?: {
    /** Wind speed, m/s. */
    speed: number
    /** Direction the wind blows from, rad clockwise from the line of fire: 0 head wind, pi/2 from the right. */
    from: number
    /** Standard deviation of the wind speed, m/s. */
    speedSd: number
    /** Standard deviation of the wind direction, rad. */
    directionSd: number
    /** Lateral displacement of the point of impact per 1 m/s of crosswind at the distance, m. */
    perCrosswind: number
  }
  /** Range uncertainty; absent: none. */
  range?: {
    /** Standard deviation of the range to the target, m. */
    sd: number
    /** Change of the height of impact per meter of range at the distance, m/m. */
    verticalPerMetre: number
  }
  /** Spread of the muzzle speed; absent: none, and the group is scaled as a whole. */
  velocity?: {
    /** Standard deviation of the muzzle speed, m/s. */
    sd: number
    /** Change of the height of impact per m/s of muzzle speed at the distance, m per m/s. */
    verticalPerSpeed: number
    /** The same at the reference distance, m per m/s. */
    referenceVerticalPerSpeed: number
  }
}

/** The point dispersion with its parts: the group scaled to the distance, the wind, the range and the muzzle speed. */
export interface DispersionResult extends PointDispersion {
  /** The parts, m: `group` scaled to the distance, without its muzzle speed part when the input has a speed spread; `wind` along x, `range` and `velocity` along y, `velocity` only with a speed spread. */
  parts: { group: PointDispersion; wind: number; range: number; velocity?: number }
}

/** The group scaled linearly with distance plus the crosswind (x) and range (y) uncertainties as independent variances, the crosswind `speed sin(from)` with variance `sin(from)^2 speedSd^2 + (speed cos(from) directionSd)^2` to first order; a muzzle speed spread's height part is taken out at the reference distance before scaling and added at the distance, as it grows faster than the distance. */
export function pointDispersion(i: DispersionInput): DispersionResult {
  need(i.referenceDistance > 0 && i.distance > 0, { code: 'distances', params: {} })
  need(i.group.horizontal > 0 && i.group.vertical > 0, { code: 'group-dispersion', params: {} })
  const k = i.distance / i.referenceDistance
  let velocity = 0
  let intrinsic = i.group.vertical
  if (i.velocity) {
    need(i.velocity.sd >= 0, { code: 'speed-spread', params: {} })
    const atReference = Math.abs(i.velocity.referenceVerticalPerSpeed) * i.velocity.sd
    need(atReference < i.group.vertical, { code: 'speed-height', params: {} })
    intrinsic = Math.sqrt(i.group.vertical ** 2 - atReference ** 2)
    velocity = Math.abs(i.velocity.verticalPerSpeed) * i.velocity.sd
  }
  const group = { horizontal: i.group.horizontal * k, vertical: intrinsic * k }
  let wind = 0
  if (i.wind) {
    need(i.wind.speed >= 0 && i.wind.speedSd >= 0 && i.wind.directionSd >= 0, {
      code: 'wind',
      params: {},
    })
    const crosswindSd = Math.hypot(
      Math.sin(i.wind.from) * i.wind.speedSd,
      i.wind.speed * Math.cos(i.wind.from) * i.wind.directionSd,
    )
    wind = Math.abs(i.wind.perCrosswind) * crosswindSd
  }
  let range = 0
  if (i.range) {
    need(i.range.sd >= 0, { code: 'range-uncertainty', params: {} })
    range = Math.abs(i.range.verticalPerMetre) * i.range.sd
  }
  return {
    horizontal: Math.hypot(group.horizontal, wind),
    vertical: Math.hypot(group.vertical, range, velocity),
    parts: { group, wind, range, ...(i.velocity ? { velocity } : {}) },
  }
}

/** Points of the composite Simpson rule of {@link ellipseProbability}, even. */
const simpsonIntervals = 2000

/** The mean of the point of impact against the aim point: group center minus point of aim, m (x right, y up). */
export interface PointOffset {
  dx: number
  dy: number
}

/** Standard normal distribution function, from the chi-square distribution of one degree of freedom. */
const normalCdf = (z: number) => 0.5 * (1 + Math.sign(z) * chiSquareCdf(z * z, 1))

/** A bivariate normal with SDs `horizontal` and `vertical` and no correlation, centered on the aim point or on `offset` from it, inside the ellipse of semi-axes `a` (x) and `b` (y) about the aim point: with x = a sin t the integrand is smooth, truncated at 8 standard deviations of x about the center. */
export function ellipseProbability(
  a: number,
  b: number,
  d: PointDispersion,
  offset?: PointOffset,
): number {
  need(a > 0 && b > 0, { code: 'semi-axes', params: {} })
  need(d.horizontal > 0 && d.vertical > 0, { code: 'standard-deviations', params: {} })
  const dx = offset?.dx ?? 0
  const dy = offset?.dy ?? 0
  need(Number.isFinite(dx) && Number.isFinite(dy), { code: 'offset', params: {} })
  const xLow = Math.max(-a, dx - 8 * d.horizontal)
  const xHigh = Math.min(a, dx + 8 * d.horizontal)
  if (xLow >= xHigh) return 0
  const t0 = Math.asin(xLow / a)
  const t1 = Math.asin(xHigh / a)
  const density = (x: number) =>
    Math.exp(-0.5 * ((x - dx) / d.horizontal) ** 2) / (d.horizontal * Math.sqrt(2 * Math.PI))
  // P(|y| < b cos t): the chi-square distribution of one degree of freedom at (b cos t / s)^2
  const centred = (c: number) => chiSquareCdf((c / d.vertical) ** 2, 1)
  const shifted = (c: number) =>
    normalCdf((c - dy) / d.vertical) - normalCdf((-c - dy) / d.vertical)
  const inside = dy === 0 ? centred : shifted
  const f = (t: number) => density(a * Math.sin(t)) * inside(b * Math.cos(t)) * a * Math.cos(t)
  return Math.min(1, simpson(f, t0, t1))
}

/** The integral of `f` from `t0` to `t1` by the composite Simpson rule of `simpsonIntervals` intervals. */
function simpson(f: (t: number) => number, t0: number, t1: number): number {
  const h = (t1 - t0) / simpsonIntervals
  let sum = f(t0) + f(t1)
  for (let k = 1; k < simpsonIntervals; k++) sum += f(t0 + k * h) * (k % 2 === 1 ? 4 : 2)
  return (sum * h) / 3
}

/** Shots to fire for a wanted chance of at least one hit, and the mean number of shots to the first hit. */
export interface ShotsToHit {
  /** Whole shots with at least the wanted chance of one hit or more; `Infinity` when a hit is impossible. */
  shots: number
  /** Mean number of shots until the first hit, `1 / p`; `Infinity` when a hit is impossible. */
  mean: number
}

/** The smallest whole number n of independent shots with `1 - (1 - p)^n >= wanted` (`ln(1 - wanted) / ln(1 - p)` rounded up), and the mean number of shots to the first hit. */
export function shotsToHit(p: number, wanted: number): ShotsToHit {
  need(p >= 0 && p <= 1, { code: 'hit-probability', params: {} })
  need(wanted > 0 && wanted < 1, { code: 'wanted-probability', params: {} })
  if (p === 0) return { shots: Number.POSITIVE_INFINITY, mean: Number.POSITIVE_INFINITY }
  if (p === 1) return { shots: 1, mean: 1 }
  // the tolerance keeps an exact whole result (p = 0.5, wanted = 0.75) from rounding up by rounding error
  const shots = Math.max(1, Math.ceil(Math.log1p(-wanted) / Math.log1p(-p) - 1e-9))
  return { shots, mean: 1 / p }
}

/** Result of {@link hitProbability}. */
export interface HitResult {
  /** Probability of a hit inside the outermost zone. */
  hit: number
  /** Expected value of the score. */
  expectedScore: number
  /** Probability per zone, outermost first: the shots inside it and outside the next one. */
  zones: { value: number; probability: number }[]
}

/** On nested zones, outermost first, a shot inside a zone and outside the next scoring the value of the first; `offset` is the center of the point of impact against the aim point, absent on the aim point. */
export function hitProbability(
  zones: readonly ScoringZone[],
  d: PointDispersion,
  offset?: PointOffset,
): HitResult {
  need(zones.length > 0, { code: 'zones', params: {} })
  const inside = zones.map((z) => ellipseProbability(z.halfWidth, z.halfHeight, d, offset))
  const parts = zones.map((z, k) => ({
    value: z.value,
    probability: Math.max(0, nth(inside, k) - (inside[k + 1] ?? 0)),
  }))
  return {
    hit: nth(inside, 0),
    expectedScore: parts.reduce((s, p) => s + p.value * p.probability, 0),
    zones: parts,
  }
}
