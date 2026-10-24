/**
 * Pressure and velocity bands from sampled input tolerances (`apps/docs/docs/models/interior-sampled-band.md`):
 * every input of a load is drawn from a normal distribution around its nominal value, the model runs once per
 * draw and the 5th, 50th and 95th percentiles of the peak pressure and the muzzle velocity are reported.
 * It covers input tolerances only, not model error.
 */
import { type InteriorLoad, type InteriorOptions, interior } from './model.ts'
import {
  type ApplyTolerance,
  interiorApply,
  type PressureInput,
  type PressureTolerances,
  pressureInputs,
} from './range.ts'

/** A tolerance is the half width of the central 90 % interval of its input: 1.645 standard deviations. */
const toleranceSigmas = 1.6448536269514722

/** The 5th, 50th and 95th percentile of a sampled quantity. */
export interface Percentiles {
  /** 5th percentile. */
  p05: number
  /** Median. */
  p50: number
  /** 95th percentile. */
  p95: number
}

/** How many draws, from which seed, within which time. */
export interface SamplingOptions {
  /** Number of draws. */
  samples: number
  /** Unsigned 32-bit seed of the generator: the same seed gives the same draws. */
  seed: number
  /** Time after which the run stops without a band, ms. */
  budgetMs: number
  /** Clock in ms; core reads no clock of its own. */
  now: () => number
}

/** The two outputs of one draw. */
export interface SampledRun {
  /** Peak breech pressure, Pa. */
  pressure: number
  /** Muzzle velocity, m/s. */
  velocity: number
}

/**
 * The result of sampling one load. `sampled` has the percentiles; `overBudget` is a run that did
 * not finish its draws within the budget, and has none (a part of the draws would depend on the
 * speed of the machine); `invalid` is a run in which no draw stayed in the model.
 */
export interface SampledBand {
  /** What the run produced. */
  status: 'sampled' | 'overBudget' | 'invalid'
  /** Draws asked for. */
  samples: number
  /** Seed used. */
  seed: number
  /** Draws that left the model or gave a value that is not finite; the percentiles leave them out. */
  failed: number
  /** The time budget, ms. */
  budgetMs: number
  /** Peak breech pressure, Pa; with status `sampled`. */
  pressure?: Percentiles
  /** Muzzle velocity, m/s; with status `sampled`. */
  velocity?: Percentiles
}

/** Deterministic uniform numbers in [0, 1): the mulberry32 generator. */
function uniforms(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Percentile `q` (0 to 1) of ascending `sorted` by linear interpolation between the closest ranks. */
function percentile(sorted: number[], q: number) {
  const rank = q * (sorted.length - 1)
  const i = Math.floor(rank)
  return sorted[i] + (rank - i) * ((sorted[i + 1] ?? sorted[i]) - sorted[i])
}

const bandOf = (values: number[]): Percentiles => {
  const sorted = values.toSorted((a, b) => a - b)
  return {
    p05: percentile(sorted, 0.05),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
  }
}

/**
 * The percentiles of `run` over draws of the inputs of `load`. Draw `i` takes one standard normal
 * number per input of `pressureInputs`, in that order, whether or not the input has a tolerance, so
 * the draws depend on the seed only. `run` returns the two outputs, or a reason for an invalid run.
 */
export function sampledBand<L>(
  load: L,
  apply: Record<PressureInput, ApplyTolerance<L>>,
  run: (load: L) => SampledRun | string,
  tolerances: PressureTolerances,
  { samples, seed, budgetMs, now }: SamplingOptions,
): SampledBand {
  const started = now()
  const uniform = uniforms(seed)
  const normal = () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform())
  const pressure: number[] = []
  const velocity: number[] = []
  for (let i = 0; i < samples; i++) {
    if (now() - started > budgetMs)
      return { status: 'overBudget', samples, seed, failed: 0, budgetMs }
    let moved: L | string = load
    for (const input of pressureInputs) {
      const side = normal() / toleranceSigmas
      if (tolerances[input] !== 0 && typeof moved !== 'string')
        moved = apply[input](moved, side, tolerances[input])
    }
    const r = typeof moved === 'string' ? moved : run(moved)
    if (typeof r !== 'string' && Number.isFinite(r.pressure) && Number.isFinite(r.velocity)) {
      pressure.push(r.pressure)
      velocity.push(r.velocity)
    }
  }
  const failed = samples - pressure.length
  if (pressure.length === 0) return { status: 'invalid', samples, seed, failed, budgetMs }
  return {
    status: 'sampled',
    samples,
    seed,
    failed,
    budgetMs,
    pressure: bandOf(pressure),
    velocity: bandOf(velocity),
  }
}

/** Sampled band of the M3 `interior` model for `load`. */
export function interiorSampledBand(
  load: InteriorLoad,
  tolerances: PressureTolerances,
  sampling: SamplingOptions,
  options: Partial<InteriorOptions> = {},
): SampledBand {
  const run = (l: InteriorLoad) => {
    const r = interior(l, options)
    return r.valid ? { pressure: r.peakBreechPressure, velocity: r.muzzleVelocity } : r.reason
  }
  return sampledBand(load, interiorApply, run, tolerances, sampling)
}
