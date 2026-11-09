/** Each input alone at both ends of its tolerance, then all together at the pressure-raising and the pressure-lowering ends; input tolerances only, not model error and no confidence interval (`apps/docs/docs/models/interior-pressure-range.md`). */
import type { Settings } from '../settings.ts'
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
type Side = NonNullable<PressureCase['sides']>[PressureInput]

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
  /** 1: the input raised by its tolerance, -1: lowered; for `all`, 1 moves every input to the end that raises the pressure, -1 to the end that lowers it. */
  side: 1 | -1
  /** For `input: 'all'`: the side used per input, 0 for nominal. */
  sides?: Record<PressureInput, -1 | 0 | 1>
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

/** Or a reason when that leaves the model; the range passes 1 or -1 (the ends of the tolerance), the sampling any number. */
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

/** How a model of `toleranceRange` runs a load: how each input moves it, and its peak (Pa) or the reason it has none. */
export interface RangeModel<L> {
  apply: Record<PressureInput, ApplyTolerance<L>>
  peak: (load: L) => number | string
}

/** Every input at side 0, in the order of `pressureInputs`. */
const noSides = (): Record<PressureInput, Side> => ({
  chargeFraction: 0,
  volumeFraction: 0,
  massFraction: 0,
  burnRateFraction: 0,
  temperatureKelvin: 0,
  startPressureFraction: 0,
})

const isSide = (x: number): x is Side => x === -1 || x === 0 || x === 1

/** The product of two sides that are not 0. */
const times = (a: 1 | -1, b: 1 | -1): 1 | -1 => (a === b ? 1 : -1)

/** The sign of the upper end's peak less the lower end's, an end without a peak counted as `nominal`; 0 when neither end has one, and for a NaN difference, which only a NaN nominal gives. */
function risingSide(
  up: Pick<PressureCase, 'maxPressure'>,
  down: Pick<PressureCase, 'maxPressure'>,
  nominal: number,
): Side {
  if (up.maxPressure === null && down.maxPressure === null) return 0
  const sign = Math.sign((up.maxPressure ?? nominal) - (down.maxPressure ?? nominal))
  return isSide(sign) ? sign : 0
}

/** Runs each input at both ends of its tolerance: the cases and the rising side of each input. */
function singleInputCases<L>(
  load: L,
  { apply, peak }: RangeModel<L>,
  tolerances: PressureTolerances,
  nominal: number,
) {
  const sides = noSides()
  const cases: PressureCase[] = []
  for (const input of pressureInputs) {
    const t = tolerances[input]
    if (t === 0) continue
    const up = runCase(apply[input](load, 1, t), peak)
    const down = runCase(apply[input](load, -1, t), peak)
    cases.push({ input, side: 1, ...up }, { input, side: -1, ...down })
    sides[input] = risingSide(up, down, nominal)
  }
  return { sides, cases }
}

/** Runs all inputs moved together, each to the end that raises the pressure, then to the end that lowers it. */
function combinedCases<L>(
  load: L,
  { apply, peak }: RangeModel<L>,
  tolerances: PressureTolerances,
  sides: Record<PressureInput, Side>,
): PressureCase[] {
  return ([1, -1] as const).map((side): PressureCase => {
    let moved: L | string = load
    const used = noSides()
    for (const input of pressureInputs) {
      const si = sides[input]
      const s = si === 0 ? 0 : times(si, side)
      // inputs after one that left the model are not applied, so they are reported as 0
      used[input] = typeof moved === 'string' ? 0 : s
      if (s !== 0 && typeof moved !== 'string') moved = apply[input](moved, s, tolerances[input])
    }
    return { input: 'all', side, sides: used, ...runCase(moved, peak) }
  })
}

/** Over the tolerance box of `load`; `peak` returns Pa or a reason for an invalid run, `nominal` is `peak(load)`, computed by the caller. */
export function toleranceRange<L>(
  load: L,
  nominal: number,
  model: RangeModel<L>,
  tolerances: PressureTolerances,
): PressureRange {
  const { sides, cases: single } = singleInputCases(load, model, tolerances, nominal)
  const cases = [...single, ...combinedCases(load, model, tolerances, sides)]
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

/** Where `maximum` (Pa) lies against the low and high end of `range`. */
function maximumClass(range: PressureRange, maximum: number): MaximumClass {
  if (maximum < range.lowPressure) return 'modelDiscrepancy'
  return maximum > range.highPressure ? 'aboveRange' : 'inputPlausible'
}

/** `maximum` (Pa) against `range` with no new run: below `lowPressure` `modelDiscrepancy`, above `highPressure` `aboveRange`, else `inputPlausible`; the dominant input from the single-input cases, an end not computed counted as the nominal pressure. */
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
  return { class: maximumClass(range, maximum), dominantInput }
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
  return toleranceRange(load, nominal, { apply: interiorApply, peak }, tolerances)
}
