import { expect } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  fitTruingStrings,
  lbPerSqInToKgPerSqM,
  type RangeStringEntry,
  type RangeStringOptions,
  standardAtmosphere,
  type TrajectoryInput,
  trajectory,
} from '../src/index.ts'
import { normals } from './random.ts'

export const g7 = {
  kind: 'bc' as const,
  model: 'G7' as const,
  bands: [{ ballisticCoefficient: 0.3 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
}
export const nominal: TrajectoryInput = {
  projectile: { mass: 0.01134, diameter: 0.00782, length: 0.0312, drag: g7 },
  muzzleVelocity: 790,
  firearm: { sightHeight: 0.05 },
  air: standardAtmosphere(0),
  zero: { range: 100 },
}
export const click = 0.1e-3
/** Standard deviation of one shot's vertical angle, rad. */
export const dispersion = 0.2e-3
export const tight = { relativeTolerance: 1e-10, absoluteTolerance: 1e-9, zeroTolerance: 1e-9 }
export const impacts = [300, 600, 900]
// other groups than the impacts: an impact and a dial entry of one group share their shots
export const dials = [400, 700, 1000]
export const shots = 5
// The Monte Carlo coverage tests take about 3.5 s alone, and several times that in parallel with code coverage on a CI runner.
export const monteCarloTimeout = 120_000

/** True parameters: ratios to the nominal values and the zero offset in rad. */
export interface Truth {
  v: number
  k: number
  c: number
  offset: number
}

const defaultAt = { impacts, dials }

/**
 * Strings the solver gives for `truth` with its zero offset, plus noise from `noise`. Dials are
 * rounded to whole clicks and keep the default rounding of a dial, unless `exact`.
 */
export function strings(truth: Truth, noise: () => number, at = defaultAt, exact = false) {
  const s: TrajectoryInput = {
    ...nominal,
    muzzleVelocity: nominal.muzzleVelocity * truth.v,
    projectile: {
      ...nominal.projectile,
      drag: {
        ...g7,
        bands: [
          { ballisticCoefficient: nth(g7.bands, 0).ballisticCoefficient / truth.k, minVelocity: 0 },
        ],
      },
    },
  }
  const t = trajectory(s, [...at.impacts, ...at.dials, 0], tight)
  const point = (r: number) => {
    const p = t.points.find((q) => q.range === r)
    if (!p) throw new Error(`range ${r}`)
    return p
  }
  const entries: RangeStringEntry[] = [
    ...at.impacts.map((range): RangeStringEntry => {
      const spread = dispersion * range
      return {
        kind: 'impact',
        range,
        value: point(range).height + truth.offset * range + (noise() * spread) / Math.sqrt(shots),
        shotCount: shots,
        standardDeviation: spread,
      }
    }),
    ...at.dials.map((range): RangeStringEntry => {
      const spread = dispersion / click
      const value = (point(range).elevationHold - truth.offset) / (click * truth.c)
      return {
        kind: 'dial',
        range,
        value: exact ? value : Math.round(value + (noise() * spread) / Math.sqrt(shots)),
        shotCount: shots,
        standardDeviation: spread,
        ...(exact ? { rounding: 0 } : {}),
      }
    }),
  ]
  const chronograph = {
    mean: point(0).velocity + (noise() * 4) / Math.sqrt(10),
    shotCount: 10,
    standardDeviation: 4,
  }
  return { shot: nominal, clickValue: click, entries, chronograph }
}

export const find = (r: { parameters: { name: string }[] }, name: string) =>
  r.parameters.find((p) => p.name === name) as ReturnType<typeof fitTruingStrings>['parameters'][0]

/** Binomial tolerance of a coverage of 0.95 over `n` runs: three standard deviations. */
export const tolerance = (n: number) => 3 * Math.sqrt((0.95 * 0.05) / n)

/**
 * Fits the noisy strings of seeds 1 to `seeds`, the truth of each from `truthOf`: the count of fits
 * whose interval holds the true value, per parameter, and the count the residual check flags.
 * Every parameter must be identified.
 */
export function coverage(
  truthOf: (seed: number) => Truth,
  options: RangeStringOptions,
  seeds: number,
) {
  const covered: Record<string, number> = {}
  let inconsistent = 0
  for (let seed = 1; seed <= seeds; seed++) {
    const truth = truthOf(seed)
    const wanted: Record<string, number> = {
      muzzleVelocity: 790 * truth.v,
      dragFactor: truth.k,
      clickValue: click * truth.c,
      zeroOffset: truth.offset,
    }
    const r = fitTruingStrings(strings(truth, normals(seed)), options)
    for (const p of r.parameters) {
      expect(p.status).toBe('identified')
      const { lower: low, upper: high } = p.interval as { lower: number; upper: number }
      const target = wanted[p.name]
      if (target === undefined) throw new Error(`no true value for ${p.name}`)
      covered[p.name] = (covered[p.name] ?? 0) + (low <= target && target <= high ? 1 : 0)
    }
    if (!r.consistent) inconsistent++
  }
  return { covered, inconsistent }
}
