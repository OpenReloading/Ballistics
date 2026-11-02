import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import {
  type ChargeTargetKind,
  chargeSolverMaxRuns,
  chargeSolverTolerance,
  chargeTargetValue,
  chargeUpperBound,
  InputError,
  type InteriorLoad,
  type InteriorResult,
  interior,
  solidFill,
  solidFillLimit,
  solveCharge,
} from '../src/index.ts'
import { m3Load as base } from './fixtures.ts'

const bulkDensity = 900
const kinds: ChargeTargetKind[] = [
  'peakPressure',
  'muzzleVelocity',
  'loadRatio',
  'barrelTime',
  'bulletLeadTime',
]

/** The value of `kind` for `charge`, from a single run. */
function valueAt(kind: ChargeTargetKind, charge: number) {
  const run = interior({ ...base, charge })
  if (!run.valid) throw new Error(run.reason)
  const value = chargeTargetValue(kind, run, charge, base, bulkDensity)
  if (value === undefined) throw new Error('no value')
  return value
}

/** `interior` of `base` at a charge, computed once: the refusal tests scan the same 32 charges. */
const scanRuns = new Map<number, InteriorResult>()
const scanRun = (load: InteriorLoad): InteriorResult => {
  let run = scanRuns.get(load.charge)
  if (!run) {
    run = interior(load)
    scanRuns.set(load.charge, run)
  }
  return run
}

describe('solveCharge', () => {
  it.each(kinds)('finds the charge of a %s target and reproduces it in one run', (kind) => {
    const charge = 0.0028
    const target = valueAt(kind, charge)
    const s = solveCharge(base, { kind, value: target }, { bulkDensity })
    if (!s.reached) throw new Error(s.reason)
    expect(s.run).toEqual(interior({ ...base, charge: s.charge }))
    expect(Math.abs(valueAt(kind, s.charge) - target)).toBeLessThanOrEqual(
      chargeSolverTolerance * target,
    )
    expect(s.tolerance).toBe(chargeSolverTolerance)
    expect(Math.abs(s.charge - charge) / charge).toBeLessThan(1e-3)
    // few runs: the scan and a short root find
    expect(s.evaluationCount).toBeLessThan(32 + 20)
  })

  it('load ratio target is the closed form charge', () => {
    const s = solveCharge(base, { kind: 'loadRatio', value: 0.8 }, { bulkDensity })
    if (!s.reached) throw new Error(s.reason)
    expect(s.charge / (bulkDensity * base.chamber.volume)).toBeCloseTo(0.8, 5)
  })

  it('pressure, velocity and load ratio rise with the charge, barrel time falls', () => {
    const charges = Array.from({ length: 12 }, (_, i) => 0.0012 + i * 0.0002)
    const series = (kind: ChargeTargetKind) => charges.map((c) => valueAt(kind, c))
    for (const kind of ['peakPressure', 'muzzleVelocity', 'loadRatio'] as const) {
      const v = series(kind)
      for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(nth(v, i - 1))
    }
    const t = series('barrelTime')
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeLessThan(nth(t, i - 1))
  })

  it.each([
    ['peakPressure', 1e12, 'aboveRange'],
    ['peakPressure', 10, 'belowRange'],
    ['muzzleVelocity', 1e5, 'aboveRange'],
    ['muzzleVelocity', 1, 'belowRange'],
    ['barrelTime', 10, 'aboveRange'],
    ['barrelTime', 1e-9, 'belowRange'],
    ['loadRatio', 2, 'aboveRange'],
  ] as const)('%s target %s is refused as %s with the reachable range', (kind, value, reason) => {
    const s = solveCharge(base, { kind, value }, { bulkDensity, run: scanRun })
    expect(s).toMatchObject({ reached: false, reason })
    if (s.reached || !s.reachable) throw new Error('range expected')
    const { minValue, maxValue } = s.reachable
    expect(minValue.value).toBeLessThan(maxValue.value)
    expect(reason === 'aboveRange' ? value > maxValue.value : value < minValue.value).toBe(true)
    // each extreme comes with the charge that gives it
    expect(valueAt(kind, minValue.charge)).toBeCloseTo(minValue.value, 6)
    expect(valueAt(kind, maxValue.charge)).toBeCloseTo(maxValue.value, 6)
  })

  it('caps the charge at the solid fill limit and below the chamber volume', () => {
    const { chamber, propellant } = base
    expect(chargeUpperBound(base)).toBeCloseTo(
      solidFillLimit * propellant.density * chamber.volume,
      12,
    )
    // a covolume above the solid volume per kg: the chamber volume caps first
    const gas = { ...base, propellant: { ...propellant, covolume: 2 / propellant.density } }
    expect(chargeUpperBound(gas)).toBeCloseTo(
      (0.999 * chamber.volume) / (2 / propellant.density),
      12,
    )
    const s = solveCharge(base, { kind: 'peakPressure', value: 1e12 }, { run: scanRun })
    if (s.reached || !s.reachable) throw new Error('range expected')
    expect(
      solidFill(s.reachable.maxValue.charge, propellant.density, chamber.volume),
    ).toBeLessThanOrEqual(solidFillLimit)
  })

  it('refuses when no charge gives a valid run', () => {
    const stuck = { ...base, startPressure: 1e18 }
    const s = solveCharge(stuck, { kind: 'peakPressure', value: 1e8 })
    expect(s).toMatchObject({ reached: false, reason: 'noValidRun' })
    // the cause is the first scanned run's, not the target's
    const first = interior({ ...stuck, charge: chargeUpperBound(stuck) * 1e-3 })
    if (first.valid || s.reached) throw new Error('invalid run expected')
    expect(s.failure).toEqual({ reason: first.reason, ...(first.field && { field: first.field }) })
  })

  it('throws an InputError for a target that is not above 0 or a load ratio without bulk density', () => {
    expect(() => solveCharge(base, { kind: 'peakPressure', value: 0 })).toThrow(InputError)
    expect(() => solveCharge(base, { kind: 'loadRatio', value: 0.8 })).toThrow(InputError)
    expect(() =>
      solveCharge(base, { kind: 'peakPressure', value: 1e8 }, { bulkDensity: -1 }),
    ).toThrow(InputError)
  })
})

/** A run of `value(charge)` as the peak pressure; `undefined` gives an invalid run. Calls are numbered from 1. */
function synthetic(value: (charge: number, call: number) => number | undefined) {
  let call = 0
  const run = (load: InteriorLoad): InteriorResult => {
    const v = value(load.charge, ++call)
    return v === undefined
      ? { valid: false, reason: 'stuck' }
      : ({ valid: true, peakBreechPressure: v } as unknown as InteriorResult)
  }
  return run
}
const target = (value: number) => ({ kind: 'peakPressure' as const, value })
/** Charges of the scan: the load has no bulk density, so the upper charge is the chamber volume rule. */
const scanHigh = chargeUpperBound(base)
const scanCharge = (i: number) => scanHigh * 1e-3 ** (1 - i / 31)
/** Rises from 37 to 70 over the scan with a peak of 100 at 10^-3.5 kg. */
const bump = (c: number) => 100 - 20 * (Math.log10(c) + 3.5) ** 2

describe('solveCharge branches, with an injected run', () => {
  it('reports each extreme of a non-monotone curve with its own charge', () => {
    const s = solveCharge(base, target(150), { run: synthetic(bump) })
    if (s.reached || !s.reachable) throw new Error('range expected')
    const { minValue, maxValue } = s.reachable
    expect(s.reason).toBe('aboveRange')
    expect(maxValue.value).toBe(bump(maxValue.charge))
    expect(minValue.value).toBe(bump(minValue.charge))
    // the peak lies inside the scan, so the high extreme is not at the highest scanned charge
    expect(maxValue.charge).toBeLessThan(scanCharge(31))
    expect(maxValue.charge).toBeGreaterThan(scanCharge(0))
    expect(maxValue.value).toBeGreaterThan(95)
    expect(minValue.charge).toBe(scanCharge(0))
  })

  it('refuses a curve that crosses the target twice as notMonotone', () => {
    const s = solveCharge(base, target(85), { run: synthetic(bump) })
    expect(s).toMatchObject({ reached: false, reason: 'notMonotone' })
    expect(s.evaluationCount).toBe(32)
  })

  it('refuses as bracketFailed where no two neighbouring valid runs enclose the target', () => {
    // no valid run between the charges 10 and 20 of the scan
    const gap = synthetic((c) => (c < scanCharge(10) ? 1 : c > scanCharge(20) ? 10 : undefined))
    const s = solveCharge(base, target(5), { run: gap })
    expect(s).toMatchObject({ reached: false, reason: 'bracketFailed' })
  })

  it('refuses as bracketFailed where the runs of the root find are not valid', () => {
    const scanOnly = synthetic((c, call) => (call <= 32 ? c : undefined))
    const s = solveCharge(base, target(scanCharge(10) * 1.1), { run: scanOnly })
    expect(s).toMatchObject({ reached: false, reason: 'bracketFailed' })
    // the false position charge, then the bisection charge
    expect(s.evaluationCount).toBe(34)
  })

  it('refuses as toleranceNotReached at a jump of the curve, within the run bound', () => {
    const jump = scanCharge(15) * 1.07
    const s = solveCharge(base, target(2), { run: synthetic((c) => (c < jump ? 1 : 3)) })
    expect(s).toMatchObject({ reached: false, reason: 'toleranceNotReached' })
    expect(s.evaluationCount).toBeGreaterThan(32)
    expect(s.evaluationCount).toBeLessThanOrEqual(chargeSolverMaxRuns)
  })

  it('refuses a flat curve at a target above it as aboveRange and reaches a target on it', () => {
    const flat = synthetic(() => 5)
    expect(solveCharge(base, target(6), { run: flat })).toMatchObject({ reason: 'aboveRange' })
    const s = solveCharge(base, target(5), { run: flat })
    expect(s).toMatchObject({ reached: true, value: 5 })
  })

  it('falls back to bisection where the false position charge gives no valid run', () => {
    const goal = scanCharge(10) * 1.1
    const smooth = (c: number) => c
    const plain = solveCharge(base, target(goal), { run: synthetic(smooth) })
    const failing = solveCharge(base, target(goal), {
      run: synthetic((c, call) => (call === 33 ? undefined : smooth(c))),
    })
    if (!plain.reached || !failing.reached) throw new Error('both reach the target')
    expect(Math.abs(failing.value - goal)).toBeLessThanOrEqual(chargeSolverTolerance * goal)
    // the invalid run and its bisection replacement are two extra runs of the first iteration
    expect(failing.evaluationCount).toBeGreaterThan(plain.evaluationCount)
  })

  it('counts every run, two per iteration where the false position charge is always invalid', () => {
    const jump = scanCharge(15) * 1.07
    // from the first root find run on, every odd run is invalid and every even run valid
    const s = solveCharge(base, target(2), {
      run: synthetic((c, call) => (call > 32 && call % 2 === 1 ? undefined : c < jump ? 1 : 3)),
    })
    expect(s).toMatchObject({ reached: false, reason: 'toleranceNotReached' })
    expect(s.evaluationCount).toBeGreaterThan(32 + 60)
    expect(s.evaluationCount).toBeLessThanOrEqual(chargeSolverMaxRuns)
    expect(chargeSolverMaxRuns).toBe(32 + 2 * 60)
  })

  it('carries the reason and field of the first failing run into noValidRun', () => {
    const refusing = (_: InteriorLoad): InteriorResult => {
      refusing.calls++
      return refusing.calls === 1
        ? { valid: false, reason: 'input', field: 'ignitionPressure' }
        : { valid: false, reason: 'stuck' }
    }
    refusing.calls = 0
    const s = solveCharge(base, target(1), { run: refusing })
    expect(s).toMatchObject({
      reached: false,
      reason: 'noValidRun',
      failure: { reason: 'input', field: 'ignitionPressure' },
    })
  })
})
