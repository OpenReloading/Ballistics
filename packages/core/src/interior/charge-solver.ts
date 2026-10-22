/**
 * Charge finder for the M3 `interior` model: the charge at which one run reaches a target
 * (`apps/docs/docs/models/interior-charge-solver.md`). A scan over the charges the case allows brackets the
 * target, then a bracketed root find (Illinois false position, bisection when a step leaves the
 * bracket) runs `interior` at the candidate charges. The returned run is the run at the returned
 * charge. A simulation, not load data: the answer is the charge at which the model reaches the
 * target, not a charge to load.
 */
import { need } from '../errors.ts'
import { solidFillLimit } from './load-file.ts'
import {
  type InteriorLoad,
  type InteriorOptions,
  type InteriorResult,
  type InteriorRun,
  interior,
} from './model.ts'

/**
 * Quantity of a run to reach: peak pressure (Pa), muzzle velocity (m/s), load ratio
 * (charge over bulk density times chamber volume), barrel time or bullet lead time (s).
 */
export type ChargeTargetKind =
  | 'peakPressure'
  | 'muzzleVelocity'
  | 'loadRatio'
  | 'barrelTime'
  | 'bulletLeadTime'

/** `value` in SI: Pa, m/s, 1, s, s. */
export interface ChargeTarget {
  kind: ChargeTargetKind
  value: number
}

/** Relative tolerance on the target value: the solved run is within it of the target. */
export const chargeSolverTolerance = 1e-6

/** Charges of the scan, log-spaced; the root find adds at most `maxIterations` iterations. */
const scanPoints = 32
const maxIterations = 60
/** An iteration runs twice where the false position charge gives no valid run (bisection fallback). */
export const chargeSolverMaxRuns = scanPoints + 2 * maxIterations
/** Lowest scanned charge over the highest. */
const scanSpan = 1e-3

/** Options of `solveCharge`. */
export interface ChargeSolverOptions {
  /** Bulk density, kg/m3: needed for the load ratio target. */
  bulkDensity?: number
  /** Overrides of `interiorDefaults` for every run. */
  options?: Partial<InteriorOptions>
  /** The model run, `interior` by default; a seam for tests with synthetic curves. */
  run?: (load: InteriorLoad, options?: Partial<InteriorOptions>) => InteriorResult
}

/** Why a run was not valid: `reason` and `field` of `interior`. */
export interface ChargeRunFailure {
  reason: string
  field?: string
}

/** Why `solveCharge` returned no charge. */
export type ChargeRefusal =
  /** No scanned charge gives a valid run with the target defined. */
  | 'noValidRun'
  /** The target is below every scanned value. */
  | 'belowRange'
  /** The target is above every scanned value. */
  | 'aboveRange'
  /** The curve crosses the target more than once, so no charge is unique. */
  | 'notMonotone'
  /** The target lies in the range, but no two neighbouring valid runs enclose it. */
  | 'bracketFailed'
  /** `maxIterations` runs did not reach the tolerance. */
  | 'toleranceNotReached'

/** A target value over the scanned charges, with the charge (kg) that gives it. */
export interface ChargeExtreme {
  value: number
  charge: number
}

/** The lowest and highest target value over the valid scanned charges, each with its charge. */
export interface ChargeRange {
  minValue: ChargeExtreme
  maxValue: ChargeExtreme
}

/** Result of `solveCharge`: the charge and its run, or a refusal. */
export type ChargeSolution =
  | {
      reached: true
      /** Charge mass that reaches the target, kg. */
      charge: number
      /** The target quantity of `run`. */
      value: number
      /** The valid run at `charge`. */
      run: InteriorRun
      /** Runs made, scan included. */
      evaluationCount: number
      /** Relative tolerance on the target, `chargeSolverTolerance`. */
      tolerance: number
      /** Reachable values over the scanned charges. */
      reachable: ChargeRange
    }
  | {
      reached: false
      reason: ChargeRefusal
      /** Values over the scanned charges; absent for `noValidRun`. */
      reachable?: ChargeRange
      /** `noValidRun`: `reason` and `field` of the first scanned run that failed. */
      failure?: ChargeRunFailure
      /** Runs made. */
      evaluationCount: number
    }

/** The target quantity of a valid run, or undefined where it is not defined. */
export function chargeTargetValue(
  kind: ChargeTargetKind,
  run: InteriorRun,
  charge: number,
  load: Pick<InteriorLoad, 'chamber'>,
  bulkDensity?: number,
): number | undefined {
  if (kind === 'peakPressure') return run.peakBreechPressure
  if (kind === 'muzzleVelocity') return run.muzzleVelocity
  if (kind === 'barrelTime') return run.barrelTime
  if (kind === 'loadRatio')
    return bulkDensity === undefined ? undefined : charge / (bulkDensity * load.chamber.volume)
  // bullet lead time: muzzle time less the 10 % pressure time, undefined when that is 0
  return run.tenPercentPressureTime > 0 ? run.muzzleTime - run.tenPercentPressureTime : undefined
}

/** Charge above which the run is outside the model: chamber volume, and the solid fill limit. */
export function chargeUpperBound(load: InteriorLoad): number {
  const { chamber, propellant } = load
  // the `chamberVolume` rule of `interior`: solid volume and covolume stay under the chamber volume
  const volume = (0.999 * chamber.volume) / Math.max(1 / propellant.density, propellant.covolume)
  return Math.min(volume, solidFillLimit * propellant.density * chamber.volume)
}

/** A valid run at a charge (kg) with its target value. */
interface Point {
  charge: number
  value: number
  run: InteriorRun
}

/** Runs the model at a charge and counts the runs; keeps the first failure. */
interface Evaluator {
  evaluate: (charge: number) => Point | undefined
  evaluationCount: number
  failure?: ChargeRunFailure
}

function evaluator(
  load: InteriorLoad,
  kind: ChargeTargetKind,
  options: ChargeSolverOptions,
): Evaluator {
  const { bulkDensity, options: runOptions, run: model = interior } = options
  const state: Evaluator = {
    evaluationCount: 0,
    evaluate: (charge) => {
      state.evaluationCount++
      const run = model({ ...load, charge }, runOptions)
      if (!run.valid) {
        state.failure ??= {
          reason: run.reason,
          ...(run.field !== undefined && { field: run.field }),
        }
        return
      }
      const value = chargeTargetValue(kind, run, charge, load, bulkDensity)
      return value !== undefined && Number.isFinite(value) ? { charge, value, run } : undefined
    },
  }
  return state
}

/** Runs at `scanPoints` log-spaced charges up to `chargeUpperBound`, lowest first; undefined where not valid. */
function scanCharges(load: InteriorLoad, evaluate: Evaluator['evaluate']): (Point | undefined)[] {
  const high = chargeUpperBound(load)
  return Array.from({ length: scanPoints }, (_, i) =>
    evaluate(high * scanSpan ** (1 - i / (scanPoints - 1))),
  )
}

/** Lowest and highest value over the valid scanned runs, each with its charge. */
function reachableRange(valid: readonly Point[]): ChargeRange {
  const extreme = (better: (a: number, b: number) => boolean): ChargeExtreme => {
    const { value, charge } = valid.reduce((m, p) => (better(p.value, m.value) ? p : m))
    return { value, charge }
  }
  return {
    minValue: extreme((a, b) => a < b),
    maxValue: extreme((a, b) => a > b),
  }
}

/** Whether a value is within `chargeSolverTolerance` of the target value. */
const within = (value: number, target: number) =>
  Math.abs(value - target) <= chargeSolverTolerance * target

/** Neighbouring valid scan points on opposite sides of the target value. */
function findBrackets(scan: readonly (Point | undefined)[], target: number): [Point, Point][] {
  const brackets: [Point, Point][] = []
  for (let i = 1; i < scan.length; i++) {
    const [a, b] = [scan[i - 1], scan[i]]
    if (a && b && (a.value - target) * (b.value - target) < 0) brackets.push([a, b])
  }
  return brackets
}

/**
 * Illinois false position inside the bracket, bisection where the false position charge gives no
 * valid run; the run within tolerance of the target value, or the refusal.
 */
function illinoisRoot(
  bracket: [Point, Point],
  target: number,
  evaluate: Evaluator['evaluate'],
): Point | 'bracketFailed' | 'toleranceNotReached' {
  let [a, b] = bracket
  let [fa, fb] = [a.value - target, b.value - target]
  let side = 0
  for (let i = 0; i < maxIterations; i++) {
    let c = (a.charge * fb - b.charge * fa) / (fb - fa)
    if (!(c > a.charge && c < b.charge)) c = (a.charge + b.charge) / 2
    let p = evaluate(c)
    if (!p) {
      // a run that is not valid there: bisection
      c = (a.charge + b.charge) / 2
      p = evaluate(c)
      if (!p) return 'bracketFailed'
    }
    const fc = p.value - target
    if (within(p.value, target)) return p
    if (p.charge <= a.charge || p.charge >= b.charge) break
    if (Math.sign(fc) === Math.sign(fb)) {
      b = p
      fb = fc
      if (side === -1) fa /= 2
      side = -1
    } else {
      a = p
      fa = fc
      if (side === 1) fb /= 2
      side = 1
    }
  }
  return 'toleranceNotReached'
}

/**
 * The charge at which `interior` reaches `target`, or a refusal with the reason and the values the
 * charges allowed reach. `load.charge` is ignored. The target `loadRatio` needs `bulkDensity`.
 */
export function solveCharge(
  load: InteriorLoad,
  target: ChargeTarget,
  options: ChargeSolverOptions = {},
): ChargeSolution {
  const { bulkDensity } = options
  need(Number.isFinite(target.value) && target.value > 0, 'target value must be above 0')
  need(
    bulkDensity === undefined || (Number.isFinite(bulkDensity) && bulkDensity > 0),
    'bulk density must be above 0',
  )
  need(
    target.kind !== 'loadRatio' || bulkDensity !== undefined,
    'the load ratio target needs the bulk density',
  )
  const runs = evaluator(load, target.kind, options)

  const scan = scanCharges(load, runs.evaluate)
  const valid = scan.flatMap((p) => (p ? [p] : []))
  if (valid.length === 0) {
    const { failure, evaluationCount } = runs
    return { reached: false, reason: 'noValidRun', ...(failure && { failure }), evaluationCount }
  }
  const reachable = reachableRange(valid)
  const refuse = (reason: ChargeRefusal) => ({
    reached: false as const,
    reason,
    reachable,
    evaluationCount: runs.evaluationCount,
  })
  if (target.value < reachable.minValue.value) return refuse('belowRange')
  if (target.value > reachable.maxValue.value) return refuse('aboveRange')

  const done = (p: Point): ChargeSolution => ({
    reached: true,
    charge: p.charge,
    value: p.value,
    run: p.run,
    evaluationCount: runs.evaluationCount,
    tolerance: chargeSolverTolerance,
    reachable,
  })
  const hit = valid.find((p) => within(p.value, target.value))
  const brackets = findBrackets(scan, target.value)
  if (hit && brackets.length <= 1) return done(hit)
  if (brackets.length > 1) return refuse('notMonotone')
  if (brackets.length === 0) return refuse('bracketFailed')

  const root = illinoisRoot(brackets[0], target.value, runs.evaluate)
  return typeof root === 'string' ? refuse(root) : done(root)
}
