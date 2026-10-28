import { interior } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import {
  barrelDefaults,
  barrelRows,
  inEveryUnit,
  longerBody,
  longerTravel,
  maxBarrelLength,
  maxLengthCount,
  type Run,
  rangeLengths,
  valuesAtTravel,
} from '../src/lib/barrel-length.ts'
import { exampleInterior } from '../src/lib/example-data.ts'
import { interiorBody } from '../src/lib/interior-input.ts'
import { resolveUnits } from '../src/lib/units.ts'
import { defined, missing } from './defined.ts'

const { load } = interiorBody(exampleInterior)
const mass = load.bullet.mass
/** The seated base from the head, m (any value: the length is base + travel). */
const base = 0.0712

function run(travel: number) {
  const r = interior({ ...load, barrel: { ...load.barrel, length: travel } })
  if (!r.valid) throw new Error(`example invalid: ${r.reason}`)
  return r
}

const result = run(load.barrel.length)
const longer = run(load.barrel.length + 0.2)
const current = base + defined(result.points[result.points.length - 1]).travel

describe('barrelRows', () => {
  it('gives the workbench readouts for the length of the workbench barrel', () => {
    const rows = barrelRows({ result, longer, mass, baseFromHead: base, lengths: [current] })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      length: current,
      current: true,
      source: 'run',
      values: {
        velocity: result.muzzleVelocity,
        energy: result.muzzleEnergy,
        breechPressure: result.muzzleBreechPressure,
        burntFraction: result.muzzleBurntFraction,
        barrelTime: result.barrelTime,
      },
    })
  })

  it('takes a grid length within a micrometre of the barrel for the barrel, one row', () => {
    const rows = barrelRows({
      result,
      mass,
      baseFromHead: base,
      lengths: [current + 4e-7, current - 4e-7],
    })
    expect(rows.map((r) => r.current)).toEqual([true])
  })

  it('adds the workbench barrel among the lengths of the range, sorted', () => {
    const lengths = [0.4, 0.5, 0.7, 0.8]
    const rows = barrelRows({ result, longer, mass, baseFromHead: base, lengths })
    expect(rows.map((r) => r.length)).toEqual([0.4, 0.5, current, 0.7, 0.8])
    expect(rows.map((r) => r.current)).toEqual([false, false, true, false, false])
    expect(rows.map((r) => r.source)).toEqual(['run', 'run', 'run', 'longer run', 'longer run'])
  })

  it('equals the run point at that travel for a shorter barrel', () => {
    const k = Math.floor(result.points.length / 2)
    const p = defined(result.points[k])
    // the point's own travel, as the length, with a base of 0 (no float trap)
    const [row = missing()] = barrelRows({
      result,
      mass,
      baseFromHead: 0,
      lengths: [p.travel],
    }).filter((r) => !r.current)
    expect(row.source).toBe('run')
    expect(row.values).toEqual({
      velocity: p.velocity,
      energy: 0.5 * mass * p.velocity ** 2,
      breechPressure: p.breechPressure,
      burntFraction: p.burntFraction,
      barrelTime: p.time - result.shotStartTime,
    })
  })

  it('interpolates linearly at off-point lengths, by hand', () => {
    // three points at travel 0, 0.1 and 0.3 m
    const point = (
      travel: number,
      time: number,
      velocity: number,
      pressure: number,
      burnt: number,
    ) =>
      ({
        travel,
        time,
        velocity,
        breechPressure: pressure,
        burntFraction: burnt,
      }) as Run['points'][number]
    const hand: Run = {
      shotStartTime: 0.0005,
      points: [
        point(0, 0.0005, 0, 100e6, 0.1),
        point(0.1, 0.0015, 400, 300e6, 0.5),
        point(0.3, 0.0025, 600, 100e6, 0.9),
      ],
    }
    const at = (travel: number) => valuesAtTravel(hand, travel, 0.01)
    // 0.025 m: a quarter of the first interval
    const q = at(0.025)
    expect(q.velocity).toBeCloseTo(100, 9)
    expect(q.energy).toBeCloseTo(0.5 * 0.01 * 100 ** 2, 9)
    expect(q.breechPressure).toBeCloseTo(150e6, 3)
    expect(q.burntFraction).toBeCloseTo(0.2, 12)
    expect(q.barrelTime).toBeCloseTo(0.00075 - 0.0005, 12)
    // 0.2 m: half of the second interval
    const v = at(0.2)
    expect(v.velocity).toBeCloseTo(500, 9)
    expect(v.energy).toBeCloseTo(0.5 * 0.01 * 500 ** 2, 9)
    expect(v.breechPressure).toBeCloseTo(200e6, 3)
    expect(v.burntFraction).toBeCloseTo(0.7, 12)
    expect(v.barrelTime).toBeCloseTo(0.002 - 0.0005, 12)
    // 0.15 m: a quarter of the second interval
    expect(at(0.15).velocity).toBeCloseTo(450, 9)
    expect(at(0.15).barrelTime).toBeCloseTo(0.00175 - 0.0005, 12)
  })

  it('keeps the earlier points of a longer run equal to the points of the run', () => {
    // the longer run read at each point of the run with travel (the points before the bullet moves
    // have no barrel length): within 1e-5 of the run's muzzle velocity, peak pressure and barrel
    // time, and of 1 in burnt fraction
    const peak = Math.max(...result.points.map((p) => p.breechPressure))
    const moving = result.points.filter((p) => p.travel > 0)
    expect(moving.length).toBeGreaterThan(100)
    for (const p of moving) {
      const at = valuesAtTravel(longer, p.travel, mass)
      expect(Math.abs(at.velocity - p.velocity) / result.muzzleVelocity).toBeLessThan(1e-5)
      expect(Math.abs(at.breechPressure - p.breechPressure) / peak).toBeLessThan(1e-5)
      expect(Math.abs(at.burntFraction - p.burntFraction)).toBeLessThan(1e-5)
      expect(
        Math.abs(at.barrelTime - (p.time - result.shotStartTime)) / result.barrelTime,
      ).toBeLessThan(1e-5)
    }
  })

  it('reads a longer barrel from the longer run, whose values at the barrel are those of the run', () => {
    const at = valuesAtTravel(longer, load.barrel.length, mass)
    expect(at.velocity).toBeCloseTo(result.muzzleVelocity, 3)
    expect(at.breechPressure / result.muzzleBreechPressure).toBeCloseTo(1, 4)
    expect(at.burntFraction).toBeCloseTo(result.muzzleBurntFraction, 6)
    expect(at.barrelTime).toBeCloseTo(result.barrelTime, 9)
    const [row = missing()] = barrelRows({
      result,
      longer,
      mass,
      baseFromHead: base,
      lengths: [current + 0.1],
    }).filter((r) => !r.current)
    expect(row.source).toBe('longer run')
    expect(row.values?.velocity).toBeGreaterThan(result.muzzleVelocity)
  })

  it('gives no values for a longer barrel without a longer run, or past it', () => {
    const lengths = [current + 0.1, current + 0.5]
    expect(
      barrelRows({ result, mass, baseFromHead: base, lengths }).map((r) => r.values === undefined),
    ).toEqual([false, true, true])
    expect(
      barrelRows({ result, longer, mass, baseFromHead: base, lengths }).map(
        (r) => r.values === undefined,
      ),
    ).toEqual([false, false, true])
  })

  it('names the reason of a ladder step the longer run reports as invalid, or a run that ends short', () => {
    const stuck = barrelRows({
      result,
      longer: { reason: 'stuck' },
      mass,
      baseFromHead: base,
      lengths: [current + 0.1],
    })
    expect(stuck.find((r) => !r.current)).toMatchObject({ values: undefined, reason: 'stuck' })
    const short = barrelRows({ result, longer, mass, baseFromHead: base, lengths: [current + 0.5] })
    expect(short.find((r) => !r.current)?.reason).toMatch(/ends before/)
    expect(
      defined(barrelRows({ result, mass, baseFromHead: base, lengths: [current + 0.1] })[1]).reason,
    ).toBeUndefined()
  })

  it('leaves out a length the bullet base is beyond', () => {
    const rows = barrelRows({ result, mass, baseFromHead: base, lengths: [0.05, base, 0.3] })
    expect(rows.map((r) => r.length)).toEqual([0.3, current])
  })
})

const inMm = (m: number) => `${m * 1000} mm`
const lengthsOf = (
  from: number | undefined,
  to: number | undefined,
  step: number | undefined,
  shown = inMm,
) => rangeLengths(from, to, step, shown, english.t)

describe('rangeLengths', () => {
  it('counts from, to and step without accumulated rounding', () => {
    expect(lengthsOf(0.4, 0.76, 0.04)).toEqual({
      lengths: Array.from({ length: 10 }, (_, i) => 0.4 + i * 0.04),
    })
  })

  it('puts the message on the field that gives no lengths', () => {
    expect(lengthsOf(undefined, 1, 1)).toEqual({ errors: { from: 'Enter From.' } })
    expect(lengthsOf(0.4, undefined, 0.1)).toEqual({ errors: { to: 'Enter To.' } })
    expect(lengthsOf(0.4, 0.8, undefined)).toEqual({ errors: { step: 'Enter Step.' } })
    expect(lengthsOf(0, 0.8, 0.1)).toEqual({ errors: { from: 'From must be above 0.' } })
    expect(lengthsOf(-0.1, 0.8, 0.1)).toEqual({ errors: { from: 'From must be above 0.' } })
    expect(lengthsOf(0.8, 0.4, 0.1)).toEqual({ errors: { to: 'To must not be below From.' } })
    expect(lengthsOf(0.4, 0.8, 0)).toEqual({ errors: { step: 'Step must be above 0.' } })
    expect(lengthsOf(0.1, 1, 0.001)).toEqual({
      errors: { step: `At most ${maxLengthCount} lengths: raise Step.` },
    })
    expect(lengthsOf(0.1, 0.1 + 0.001 * (maxLengthCount - 1), 0.001)).toHaveProperty('lengths')
  })

  it('reports every field at fault, From and Step beside each other', () => {
    expect(lengthsOf(0, 0.8, 0)).toEqual({
      errors: { from: 'From must be above 0.', step: 'Step must be above 0.' },
    })
  })

  it('stops To at the longest barrel and names it in the shown unit', () => {
    expect(lengthsOf(0.4, maxBarrelLength, 0.4)).toHaveProperty('lengths')
    expect(lengthsOf(0.4, maxBarrelLength + 0.001, 0.4, (m) => `${m / 0.0254} in`)).toEqual({
      errors: { to: `To must not be above ${maxBarrelLength / 0.0254} in.` },
    })
  })
})

describe('inEveryUnit', () => {
  const metric = resolveUnits({ preset: 'metric-grams', overrides: {} })
  const us = resolveUnits({ preset: 'us', overrides: {} })

  it('is what the To message carries, whichever unit the field shows', () => {
    const to = (system: typeof us) => lengthsOf(0.4, 2.032, 0.4, (m) => inEveryUnit(system, m))
    expect(to(us)).toEqual({ errors: { to: 'To must not be above 78.74 in (2000 mm).' } })
    expect(to(metric)).toEqual({ errors: { to: 'To must not be above 2000 mm (78.74 in).' } })
  })
})

describe('barrelDefaults', () => {
  it('starts at 16 to 30 in, or 400 to 760 mm, in the shown units', () => {
    const us = barrelDefaults(resolveUnits({ preset: 'us', overrides: {} }))
    expect(us.from).toBeCloseTo(16 * 0.0254, 12)
    expect(us.to).toBeCloseTo(30 * 0.0254, 12)
    const metric = barrelDefaults(resolveUnits({ preset: 'metric-grams', overrides: {} }))
    expect(metric).toEqual({ from: 0.4, to: 0.76, step: 0.04 })
  })
})

describe('longerTravel and longerBody', () => {
  it('asks for a longer run only beyond the barrel', () => {
    expect(longerTravel([0.4, 0.5], base, 0.6)).toBeUndefined()
    expect(longerTravel([0.4, 0.9], base, 0.6)).toBeCloseTo(0.9 - base, 12)
  })

  it('keeps the load and the ladder charges of the run', () => {
    const body = longerBody(load, [3e-3, 3.1e-3, 3.2e-3], 'around', 0.9)
    expect(body.load.barrel).toEqual({ ...load.barrel, length: 0.9 })
    expect(body.load.charge).toBe(3.1e-3)
    expect(body).toHaveProperty('ladder', {
      chargeStep: expect.closeTo(1e-4, 12),
      stepCount: 3,
      direction: 'around',
    })
    expect(longerBody(load, [3e-3], 'up', 0.9)).not.toHaveProperty('ladder')
  })
})
