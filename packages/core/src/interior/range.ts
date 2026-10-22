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
  burnRateFraction: 0.03,
  temperatureKelvin: 5,
  startPressureFraction: 0.2,
})

const inputs: PressureInput[] = [
  'chargeFraction',
  'volumeFraction',
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

/** Moves one input of a load by its tolerance to one side, or returns a reason when that leaves the model. */
export type ApplyTolerance<L> = (load: L, side: 1 | -1, tolerance: number) => L | string

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
  const run = (moved: L | string): Pick<PressureCase, 'maxPressure' | 'reason'> => {
    const p = typeof moved === 'string' ? moved : peak(moved)
    if (typeof p === 'string') return { maxPressure: null, reason: p }
    return Number.isFinite(p) ? { maxPressure: p } : { maxPressure: null, reason: 'nonFinite' }
  }
  const sides = {} as Record<PressureInput, Side>
  for (const input of inputs) {
    const t = tolerances[input]
    sides[input] = 0
    if (t === 0) continue
    const up = run(apply[input](load, 1, t))
    const down = run(apply[input](load, -1, t))
    cases.push({ input, side: 1, ...up }, { input, side: -1, ...down })
    const hi = up.maxPressure ?? nominal
    const lo = down.maxPressure ?? nominal
    sides[input] =
      up.maxPressure === null && down.maxPressure === null ? 0 : (Math.sign(hi - lo) as Side)
  }
  for (const side of [1, -1] as const) {
    let moved: L | string = load
    const used = {} as Record<PressureInput, Side>
    for (const input of inputs) {
      const s = sides[input] === 0 ? 0 : ((sides[input] * side) as 1 | -1)
      // inputs after one that left the model are not applied, so they are reported as 0
      used[input] = typeof moved === 'string' ? 0 : s
      if (s !== 0 && typeof moved !== 'string') moved = apply[input](moved, s, tolerances[input])
    }
    cases.push({ input: 'all', side, sides: used, ...run(moved) })
  }
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

const relative = (value: number, side: 1 | -1, t: number) => value * (1 + side * t)
const interiorApply: Record<PressureInput, ApplyTolerance<InteriorLoad>> = {
  chargeFraction: (l, s, t) => ({ ...l, charge: relative(l.charge, s, t) }),
  volumeFraction: (l, s, t) => ({
    ...l,
    chamber: { ...l.chamber, volume: relative(l.chamber.volume, s, t) },
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
  options: Partial<InteriorOptions> = {},
): PressureRange {
  const peak = (l: InteriorLoad) => {
    const r = interior(l, options)
    return r.valid ? r.peakBreechPressure : r.reason
  }
  return toleranceRange(load, nominal, interiorApply, peak, tolerances)
}
