/**
 * Probability of a hit and expected score on a target face from a point dispersion
 * (`apps/docs/docs/models/hit-probability.md`). SI throughout: lengths m, speeds m/s, angles rad.
 */
import { need, nth } from '../errors.ts'
import { chiSquareCdf } from './chi-square.ts'

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
    /** Change of the height of impact per metre of range at the distance, m/m. */
    verticalPerMetre: number
  }
}

/** The point dispersion with its parts: the group scaled to the distance, the wind and the range. */
export interface DispersionResult extends PointDispersion {
  /** Standard deviation along x from the group, the wind and the range, m. */
  parts: { group: PointDispersion; wind: number; range: number }
}

/**
 * The point dispersion of the group scaled linearly with distance, the crosswind uncertainty on the
 * horizontal axis and the range uncertainty on the vertical axis, added as independent variances.
 * The crosswind is `speed sin(from)`; its variance follows from the speed and direction
 * uncertainties to first order: `sin(from)^2 speedSd^2 + (speed cos(from) directionSd)^2`.
 */
export function pointDispersion(i: DispersionInput): DispersionResult {
  need(i.referenceDistance > 0 && i.distance > 0, 'distances must be positive')
  need(i.group.horizontal > 0 && i.group.vertical > 0, 'the group dispersion must be positive')
  const k = i.distance / i.referenceDistance
  const group = { horizontal: i.group.horizontal * k, vertical: i.group.vertical * k }
  let wind = 0
  if (i.wind) {
    need(
      i.wind.speed >= 0 && i.wind.speedSd >= 0 && i.wind.directionSd >= 0,
      'wind inputs must not be negative',
    )
    const crosswindSd = Math.hypot(
      Math.sin(i.wind.from) * i.wind.speedSd,
      i.wind.speed * Math.cos(i.wind.from) * i.wind.directionSd,
    )
    wind = Math.abs(i.wind.perCrosswind) * crosswindSd
  }
  let range = 0
  if (i.range) {
    need(i.range.sd >= 0, 'the range uncertainty must not be negative')
    range = Math.abs(i.range.verticalPerMetre) * i.range.sd
  }
  return {
    horizontal: Math.hypot(group.horizontal, wind),
    vertical: Math.hypot(group.vertical, range),
    parts: { group, wind, range },
  }
}

/** Points of the composite Simpson rule of {@link ellipseProbability}, even. */
const simpsonIntervals = 2000

/**
 * Probability that a point from a bivariate normal distribution centred on the aim point, with
 * standard deviations `horizontal` and `vertical` and no correlation, lies inside the ellipse of
 * semi-axes `a` (x) and `b` (y) about the aim point: with x = a sin t the integral of the density of x
 * times the probability of |y| below b cos t is smooth, and is truncated at 8 standard deviations.
 */
export function ellipseProbability(a: number, b: number, d: PointDispersion): number {
  need(a > 0 && b > 0, 'the semi-axes must be positive')
  need(d.horizontal > 0 && d.vertical > 0, 'the standard deviations must be positive')
  const t0 = Math.asin(Math.min(1, (8 * d.horizontal) / a))
  const density = (x: number) =>
    Math.exp(-0.5 * (x / d.horizontal) ** 2) / (d.horizontal * Math.sqrt(2 * Math.PI))
  // P(|y| < b cos t): the chi-square distribution of one degree of freedom at (b cos t / s)^2
  const f = (t: number) =>
    density(a * Math.sin(t)) *
    chiSquareCdf(((b * Math.cos(t)) / d.vertical) ** 2, 1) *
    a *
    Math.cos(t)
  const h = (2 * t0) / simpsonIntervals
  let sum = f(-t0) + f(t0)
  for (let k = 1; k < simpsonIntervals; k++) sum += f(-t0 + k * h) * (k % 2 === 1 ? 4 : 2)
  return Math.min(1, (sum * h) / 3)
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

/**
 * The hit probability and expected score of a point dispersion on nested zones, outermost first
 * (each inside the one before). A shot inside a zone and outside the next scores the value of the
 * first.
 */
export function hitProbability(zones: readonly ScoringZone[], d: PointDispersion): HitResult {
  need(zones.length > 0, 'a face needs at least one zone')
  const inside = zones.map((z) => ellipseProbability(z.halfWidth, z.halfHeight, d))
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
