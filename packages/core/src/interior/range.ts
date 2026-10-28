import type { Settings } from '../errors.ts'
/**
 * Peak-pressure range over input tolerances (`apps/docs/docs/models/interior-pressure-range.md`): each input
 * alone at both ends of its tolerance, then all inputs together at the pressure-raising and the
 * pressure-lowering ends. It covers input tolerances only, not model error, and is not a
 * confidence interval.
 */
import { type InteriorLoad, type InteriorOptions, interior } from './model.ts'

/** Tolerance of each input of a load: relative fractions, except `temperatureKelvin`. */
export interface PressureTolerances {
  /** Relative, of the charge mass. */
  chargeFraction: number
  /** Relative; `chamber.volume`. */
  volumeFraction: number
  /** Relative; `bullet.mass`. */
  massFraction: number
  /** Relative; `burn.coefficient` or `burn.vivacity`. */
  burnRateFraction: number
  /** Absolute, K (a difference, equal in degC). */
  temperatureKelvin: number
  /** Relative, of the shot-start pressure. */
  startPressureFraction: number
}
/** Input of a load that carries a tolerance. */
export type PressureInput = keyof PressureTolerances
type Side = -1 | 0 | 1

/** Unverified assumptions without a source. */
export const pressureToleranceDefaults: Readonly<PressureTolerances> = Object.freeze({
  chargeFraction: 0.005,
  volumeFraction: 0.01,
  // no tolerance without a source: the input stays at its nominal value until a caller sets one
  massFraction: 0,
  burnRateFraction: 0.03,
  temperatureKelvin: 5,
  startPressureFraction: 0.2,
})

/** Every input with a tolerance, in the order the range and the sampled band apply them. */
export const pressureInputs: readonly PressureInput[] = [
  'chargeFraction',
  'volumeFraction',
  'massFraction',
  'burnRateFraction',
  'temperatureKelvin',
  'startPressureFraction',
]

/** One computed case of the range: one input moved to one end, or all inputs moved together. */
export interface PressureCase {
  /** The input moved, or `all` for every input at once. */
  input: PressureInput | 'all'
  /**
   * 1: the input raised by its tolerance, -1: lowered. For `all`: 1 moves every input to the end
   * that raises the pressure, -1 to the end that lowers it.
   */
  side: 1 | -1
  /** For `input: 'all'`: the side used per input, 0 for nominal. */
  sides?: Record<PressureInput, Side>
  /** Pa; null when the run is invalid, not finite or outside the model. */
  maxPressure: number | null
  /** Why `maxPressure` is null: a model reason, `outsideModel` or `nonFinite`. */
  reason?: string
}

/** Peak pressure over the tolerance box of one load. */
export interface PressureRange {
  /** The quantity ranged. */
  quantity: 'maxPressure'
  /** Pa. */
  nominalPressure: number
  /** Lowest of the nominal and the valid case pressures, Pa. */
  lowPressure: number
  /** Highest of the nominal and the valid case pressures, Pa. */
  highPressure: number
  /** False when a case could not be computed. */
  complete: boolean
  /** The tolerances used. */
  tolerances: PressureTolerances
  /** Each input at both ends (inputs with tolerance 0 left out), then the two `all` cases. */
  cases: PressureCase[]
}

/**
 * Moves one input of a load by `side` times its tolerance, or returns a reason when that leaves
 * the model. The range passes 1 or -1 (the ends of the tolerance), the sampling any number.
 */
export type ApplyTolerance<L> = (load: L, side: number, tolerance: number) => L | string

/** The peak of one moved load, or the reason it has none. */
function runCase<L>(
  moved: L | string,
  peak: (load: L) => number | string,
): Pick<PressureCase, 'maxPressure' | 'reason'> {
  const p = typeof moved === 'string' ? moved : peak(moved)
  if (typeof p === 'string') return { maxPressure: null, reason: p }
  return Number.isFinite(p) ? { maxPressure: p } : { maxPressure: null, reason: 'nonFinite' }
}

/** Runs each input at both ends of its tolerance, adds the cases and returns the rising side of each. */
function singleInputCases<L>(
  load: L,
  nominal: number,
  apply: Record<PressureInput, ApplyTolerance<L>>,
  peak: (load: L) => number | string,
  tolerances: PressureTolerances,
  cases: PressureCase[],
) {
  const sides = {} as Record<PressureInput, Side>
  for (const input of pressureInputs) {
    const t = tolerances[input]
    sides[input] = 0
    if (t === 0) continue
    const up = runCase(apply[input](load, 1, t), peak)
    const down = runCase(apply[input](load, -1, t), peak)
    cases.push({ input, side: 1, ...up }, { input, side: -1, ...down })
    const hi = up.maxPressure ?? nominal
    const lo = down.maxPressure ?? nominal
    sides[input] =
      up.maxPressure === null && down.maxPressure === null ? 0 : (Math.sign(hi - lo) as Side)
  }
  return sides
}

/** Runs all inputs moved together, each to the end that raises the pressure (or lowers it). */
function combinedCase<L>(
  load: L,
  side: 1 | -1,
  apply: Record<PressureInput, ApplyTolerance<L>>,
  peak: (load: L) => number | string,
  tolerances: PressureTolerances,
  sides: Record<PressureInput, Side>,
): PressureCase {
  let moved: L | string = load
  const used = {} as Record<PressureInput, Side>
  for (const input of pressureInputs) {
    const s = sides[input] === 0 ? 0 : ((sides[input] * side) as 1 | -1)
    // inputs after one that left the model are not applied, so they are reported as 0
    used[input] = typeof moved === 'string' ? 0 : s
    if (s !== 0 && typeof moved !== 'string') moved = apply[input](moved, s, tolerances[input])
  }
  return { input: 'all', side, sides: used, ...runCase(moved, peak) }
}

/**
 * The range of `peak` over the tolerance box of `load`. `peak` returns Pa or a reason for an
 * invalid run; `nominal` is `peak(load)`, computed by the caller.
 */
export function toleranceRange<L>(
  load: L,
  nominal: number,
  apply: Record<PressureInput, ApplyTolerance<L>>,
  peak: (load: L) => number | string,
  tolerances: PressureTolerances,
): PressureRange {
  const cases: PressureCase[] = []
  const sides = singleInputCases(load, nominal, apply, peak, tolerances, cases)
  for (const side of [1, -1] as const)
    cases.push(combinedCase(load, side, apply, peak, tolerances, sides))
  const valid = cases.flatMap((c) => (c.maxPressure === null ? [] : [c.maxPressure]))
  return {
    quantity: 'maxPressure',
    nominalPressure: nominal,
    lowPressure: Math.min(nominal, ...valid),
    highPressure: Math.max(nominal, ...valid),
    complete: valid.length === cases.length,
    tolerances: { ...tolerances },
    cases,
  }
}

/** Where a user-entered maximum pressure lies against a {@link PressureRange}. */
export type MaximumClass =
  /** Inside [low, high] of the range, ends included. */
  | 'inputPlausible'
  /** Below the low end of the range. */
  | 'modelDiscrepancy'
  /** Above the high end of the range. */
  | 'aboveRange'

/** The class of a maximum and the input that dominates the spread of the range. */
export interface MaximumPlacement {
  /** Where the maximum lies. */
  class: MaximumClass
  /** The single input whose two ends differ most in peak pressure; null when no input moves the pressure. */
  dominantInput: PressureInput | null
}

/**
 * Places `maximum` (Pa) against `range` with no new run: below `lowPressure` is `modelDiscrepancy`,
 * above `highPressure` is `aboveRange`, else `inputPlausible`. The dominant input is read from the
 * range's single-input cases, an end that could not be computed counted as the nominal pressure.
 */
export function placeMaximum(range: PressureRange, maximum: number): MaximumPlacement {
  const end = (input: PressureInput, side: 1 | -1) =>
    range.cases.find((c) => c.input === input && c.side === side)?.maxPressure ??
    range.nominalPressure
  let dominantInput: PressureInput | null = null
  let widest = 0
  for (const input of pressureInputs) {
    const spread = Math.abs(end(input, 1) - end(input, -1))
    if (spread > widest) {
      dominantInput = input
      widest = spread
    }
  }
  const cls: MaximumClass =
    maximum < range.lowPressure
      ? 'modelDiscrepancy'
      : maximum > range.highPressure
        ? 'aboveRange'
        : 'inputPlausible'
  return { class: cls, dominantInput }
}

const relative = (value: number, side: number, t: number) => value * (1 + side * t)
/** How each input of an `InteriorLoad` moves, shared by the range and the sampled band. */
export const interiorApply: Record<PressureInput, ApplyTolerance<InteriorLoad>> = {
  chargeFraction: (l, s, t) => ({ ...l, charge: relative(l.charge, s, t) }),
  volumeFraction: (l, s, t) => ({
    ...l,
    chamber: { ...l.chamber, volume: relative(l.chamber.volume, s, t) },
  }),
  massFraction: (l, s, t) => ({
    ...l,
    bullet: { ...l.bullet, mass: relative(l.bullet.mass, s, t) },
  }),
  burnRateFraction: (l, s, t) => {
    const b = l.propellant.burn
    const burn =
      b.kind === 'geometric'
        ? { ...b, coefficient: relative(b.coefficient, s, t) }
        : { ...b, vivacity: relative(b.vivacity, s, t) }
    return { ...l, propellant: { ...l.propellant, burn } }
  },
  temperatureKelvin: (l, s, t) => ({
    ...l,
    propellantTemperature: l.propellantTemperature + s * t,
  }),
  startPressureFraction: (l, s, t) => ({
    ...l,
    startPressure: relative(l.startPressure, s, t),
  }),
}

/** Pressure range of the M3 `interior` model; `nominal` is its `peakBreechPressure` for `load`. */
export function interiorPressureRange(
  load: InteriorLoad,
  nominal: number,
  tolerances: PressureTolerances = pressureToleranceDefaults,
  options: Settings<InteriorOptions> = {},
): PressureRange {
  const peak = (l: InteriorLoad) => {
    const r = interior(l, options)
    return r.valid ? r.peakBreechPressure : r.reason
  }
  return toleranceRange(load, nominal, interiorApply, peak, tolerances)
}
