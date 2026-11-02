import type { Translator } from '../i18n/translate.ts'
import type { InteriorResponse } from './api-types.ts'
import { firstIndexBeyondTravel } from './interior-chart.ts'
import type { InteriorBody } from './interior-input.ts'
import { nth } from './nth.ts'
import type { LadderDirection } from './seating-ladder.ts'
import { formatQuantity, type UnitSystem, unitsOf } from './units.ts'

type Result = InteriorResponse['result']

/** What a run gives: its points and the shot start the barrel time counts from. */
export type Run = Pick<Result, 'points' | 'shotStartTime'>

/** Values at the muzzle of a barrel; SI (m/s, J, Pa, fraction, s). */
type BarrelValues = {
  velocity: number
  energy: number
  breechPressure: number
  burntFraction: number
  barrelTime: number
}

export type BarrelRow = {
  /** Barrel length, m: the seated bullet's base plus the travel. */
  length: number
  /** The workbench's own barrel. */
  current: boolean
  /** Which run the values are read from. */
  source: 'run' | 'longer run'
  /** None while the longer run is missing or did not give a result. */
  values?: BarrelValues | undefined
  /** Why a longer run that answered gave no values. */
  reason?: string | undefined
}

/** What a longer run gave for one ladder step: its run, or the model's reason for none. */
export type LongerRun = Run | { reason: string }

/** Lengths closer than this are one barrel; the seating's mm round trip leaves float noise, m. */
const same = 1e-6

/** Most lengths one range gives. */
export const maxLengthCount = 60

/** Longest barrel the range may reach, m: the longer run is one request with this much travel. */
export const maxBarrelLength = 2

export type RangeKey = 'from' | 'to' | 'step'
export type RangeErrors = Partial<Record<RangeKey, string>>

/** The range a new study starts with, in the shown unit: 16 to 30 in, or 400 to 760 mm. SI, m. */
export function barrelDefaults(system: UnitSystem) {
  const { toSi, symbol } = system.barrelLength
  const [from, to, step] = symbol === 'in' ? [16, 30, 2] : [400, 760, 40]
  return { from: toSi(from), to: toSi(to), step: toSi(step) }
}

/**
 * A barrel length (m) in the Settings unit and then in the other units of the quantity, as
 * "78.74 in (2000 mm)": a field may show another unit than the Settings, and the message
 * about it stands outside the field.
 */
export function inEveryUnit(system: UnitSystem, length: number): string {
  const own = system.barrelLength
  const units = [own, ...Object.values(unitsOf.barrelLength).filter((u) => u.symbol !== own.symbol)]
  const text = (u: typeof own) =>
    `${formatQuantity('barrelLength', { ...system, barrelLength: u }, length)} ${u.symbol}`
  const first = text(own)
  const others = units.slice(1).map(text)
  return others.length > 0 ? `${first} (${others.join(', ')})` : first
}

/**
 * The lengths of a range, m, lowest first; or the message of each field that gives none. `shown`
 * writes a length in the shown unit.
 */
export function rangeLengths(
  from: number | undefined,
  to: number | undefined,
  step: number | undefined,
  shown: (length: number) => string,
  t: Translator['t'],
): { lengths: number[] } | { errors: RangeErrors } {
  const errors: RangeErrors = {}
  if (from === undefined) errors.from = t('Enter From.')
  else if (!(from > 0)) errors.from = t('From must be above 0.')
  if (to === undefined) errors.to = t('Enter To.')
  else if (from !== undefined && from > 0 && !(to >= from))
    errors.to = t('To must not be below From.')
  else if (to > maxBarrelLength)
    errors.to = t('To must not be above {length}.', { length: shown(maxBarrelLength) })
  if (step === undefined) errors.step = t('Enter Step.')
  else if (!(step > 0)) errors.step = t('Step must be above 0.')
  if (Object.keys(errors).length > 0 || from === undefined || to === undefined || !step)
    return { errors }
  const n = Math.floor((to - from) / step + 1e-9) + 1
  if (n > maxLengthCount)
    return {
      errors: { step: t('At most {count} lengths: raise Step.', { count: maxLengthCount }) },
    }
  // multiplied, so the last length carries no accumulated rounding
  return { lengths: Array.from({ length: n }, (_, i) => from + i * step) }
}

/** The values of `run` at `travel` (m), linear between its points; `mass` in kg. */
export function valuesAtTravel(run: Run, travel: number, mass: number): BarrelValues {
  const { points } = run
  const lo = firstIndexBeyondTravel(points, travel)
  const [a, b] =
    lo === 0
      ? [nth(points, 0), nth(points, 0)]
      : [nth(points, lo - 1), nth(points, Math.min(lo, points.length - 1))]
  const f = a === b ? 0 : (travel - a.travel) / (b.travel - a.travel)
  const mix = (k: 'velocity' | 'burntFraction' | 'breechPressure' | 'time') =>
    a[k] * (1 - f) + b[k] * f
  const velocity = mix('velocity')
  return {
    velocity,
    energy: 0.5 * mass * velocity ** 2,
    breechPressure: mix('breechPressure'),
    burntFraction: mix('burntFraction'),
    barrelTime: mix('time') - run.shotStartTime,
  }
}

/** The travel (m) the longer run needs for `lengths`; undefined when the run reaches them all. */
export function longerTravel(lengths: number[], base: number, runTravel: number) {
  const travel = Math.max(...lengths) - base
  return travel > runTravel + same ? travel : undefined
}

/** A row read from the run at `travel` (m), below its muzzle. */
const rowFromRun = (result: Result, length: number, travel: number, mass: number): BarrelRow => ({
  length,
  current: false,
  source: 'run',
  values: valuesAtTravel(result, travel, mass),
})

/** A row read from the longer run at `travel` (m); without values the reason when it answered. */
function rowFromLongerRun(
  longer: LongerRun | undefined,
  length: number,
  travel: number,
  mass: number,
): BarrelRow {
  const run = longer && 'points' in longer ? longer : undefined
  const reached = run && travel <= nth(run.points, run.points.length - 1).travel + same
  return {
    length,
    current: false,
    source: 'longer run',
    values: reached ? valuesAtTravel(run, travel, mass) : undefined,
    reason:
      !longer || reached
        ? undefined
        : 'reason' in longer
          ? longer.reason
          : 'the longer run ends before this length',
  }
}

/**
 * The rows of one step: a row per length of the range with travel above 0, and the current barrel
 * (the run's own readouts) among them. Lengths up to the current barrel are read from the run at
 * their travel, longer ones from `longer`, which carries the same load with more travel.
 */
export function barrelRows({
  result,
  longer,
  mass,
  baseFromHead,
  lengths,
}: {
  result: Result
  longer?: LongerRun | undefined
  /** Bullet mass, kg. */
  mass: number
  /** Seated bullet base from the head, m. */
  baseFromHead: number
  /** m. */
  lengths: number[]
}): BarrelRow[] {
  const muzzle = nth(result.points, result.points.length - 1).travel
  const current = baseFromHead + muzzle
  const own: BarrelValues = {
    velocity: result.muzzleVelocity,
    energy: result.muzzleEnergy,
    breechPressure: result.muzzleBreechPressure,
    burntFraction: result.muzzleBurntFraction,
    barrelTime: result.barrelTime,
  }
  const others = lengths
    .filter((l) => l - baseFromHead > 0 && Math.abs(l - current) > same)
    .map((length): BarrelRow => {
      const travel = length - baseFromHead
      return travel < muzzle
        ? rowFromRun(result, length, travel, mass)
        : rowFromLongerRun(longer, length, travel, mass)
    })
  const here: BarrelRow = { length: current, current: true, source: 'run', values: own }
  return [...others, here].sort((a, b) => a.length - b.length)
}

/**
 * The body of the longer run: the load of the run with `travel` (m), as a ladder of the run's
 * steps when it has several (the same charges, in the same order).
 */
export function longerBody(
  load: InteriorBody['load'],
  charges: number[],
  direction: LadderDirection,
  travel: number,
) {
  const barrel = { ...load.barrel, length: travel }
  if (charges.length < 2)
    return { model: 'm3' as const, load: { ...load, barrel, charge: charges[0] } }
  const start = direction === 'around' ? charges[(charges.length - 1) / 2] : charges[0]
  return {
    model: 'm3' as const,
    load: { ...load, barrel, charge: start },
    ladder: {
      chargeStep: Math.abs(nth(charges, 1) - nth(charges, 0)),
      stepCount: charges.length,
      direction,
    },
  }
}
