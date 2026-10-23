import { lbPerSqInToKgPerSqM } from '@openreloading/core'
import { describe, expect, it } from 'vitest'
import { initialFields, siValues } from '../src/lib/field-spec.ts'
import {
  manualProjectile,
  rangeSteps,
  shotFields,
  shotFromValues,
  trajectoryResult,
} from '../src/lib/trajectory-input.ts'
import { presetUnits, unitsOf } from '../src/lib/units.ts'

describe('rangeList', () => {
  it('lists multiples of the step and appends a max that is not one', () => {
    expect(rangeSteps(1000, 100)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
    expect(rangeSteps(250, 100)).toEqual([0, 100, 200, 250])
  })

  it('keeps imperial steps on whole yards', () => {
    const yd = unitsOf.range.yd
    const list = rangeSteps(yd.toSi(1000), yd.toSi(100))
    expect(list).toHaveLength(11)
    list.forEach((r, k) => {
      expect(r).toBeCloseTo(k * 91.44, 9)
    })
    expect(list[10]).toBe(yd.toSi(1000))
  })

  it('rejects a zero or negative step or range and more than 500 rows', () => {
    expect(() => rangeSteps(1000, 0)).toThrow(RangeError)
    expect(() => rangeSteps(-1, 100)).toThrow(RangeError)
    expect(() => rangeSteps(500, 1)).toThrow(/500 rows/)
    expect(rangeSteps(499, 1)).toHaveLength(500)
  })
})

describe('shotFrom', () => {
  const projectile = manualProjectile(
    { mass: 11.34e-3, diameter: 7.82e-3, ballisticCoefficient: 0.243 * lbPerSqInToKgPerSqM },
    'G7',
  )
  const defaults = {
    ...siValues(initialFields(shotFields, presetUnits('metric-grams'))),
    muzzleVelocity: 790,
    sightHeight: 0.038,
  }

  it('maps humidity to a fraction, wind degrees to rad, and leaves out wind at 0 and an empty twist', () => {
    const shot = shotFromValues(
      { ...defaults, humidity: 0.5, windSpeed: 4, windFrom: Math.PI / 2 },
      projectile,
      'right',
    )
    expect(shot.air.humidity).toBe(0.5)
    expect(shot.wind).toEqual([{ endDistance: 1000, speed: 4, fromDirection: Math.PI / 2 }])
    expect(shot.firearm).toEqual({ sightHeight: 0.038, twistHand: 'right' })
    const calm = shotFromValues(defaults, projectile, 'left')
    expect(calm.wind).toBeUndefined()
    expect(calm.air).toEqual({ temperature: 288.15, pressure: 101325, altitude: 0, humidity: 0 })
    expect(shotFromValues({ ...defaults, twist: 0.254 }, projectile, 'left').firearm.twist).toBe(
      0.254,
    )
  })

  it('names a missing field', () => {
    expect(() =>
      shotFromValues({ ...defaults, muzzleVelocity: undefined }, projectile, 'right'),
    ).toThrow('Enter a number for Muzzle velocity.')
  })
})

describe('trajectoryResult', () => {
  const projectile = manualProjectile(
    { mass: 11.34e-3, diameter: 7.82e-3, ballisticCoefficient: 0.243 * lbPerSqInToKgPerSqM },
    'G7',
  )
  const values = {
    ...siValues(initialFields(shotFields, presetUnits('metric-grams'))),
    muzzleVelocity: 790,
    sightHeight: 0.038,
  }

  it('gives the table rows and 101 chart points from 0 to the largest range', () => {
    const r = trajectoryResult(values, projectile, 'right')
    expect(r.tablePoints.map((p) => p.range)).toEqual(rangeSteps(1000, 100))
    expect(r.chartPoints).toHaveLength(101)
    expect(r.chartPoints[100].range).toBe(1000)
    expect(r.zeroRange).toBe(100)
    expect(Math.abs(r.tablePoints[1].height)).toBeLessThan(1e-5)
  })

  it('gives the windage hold per 1 m/s and per 1 mph of crosswind at each table point', () => {
    const r = trajectoryResult(values, projectile, 'right')
    const { mps, mph } = r.windPerUnit
    expect(mps).toHaveLength(r.tablePoints.length)
    expect(mps[0]).toBeCloseTo(0, 9)
    // wind drift grows with range, and 1 mph is 0.44704 m/s of the same effect
    expect(mps[5]).toBeGreaterThan(mps[2])
    expect(mph[5] / mps[5]).toBeCloseTo(0.44704, 2)
    // the wind of the shot itself is not part of the bracket
    const windy = trajectoryResult(
      { ...values, windSpeed: 5, windFrom: Math.PI / 2 },
      projectile,
      'right',
    )
    expect(windy.windPerUnit.mps[5]).toBeCloseTo(mps[5], 9)
  })

  it('gives the density altitude of the standard sea-level air as 0', () => {
    expect(trajectoryResult(values, projectile, 'right').densityAltitude).toBeCloseTo(0, 6)
  })

  it('flags low stability along the flight only for a slow twist and a known length', () => {
    const long = { ...projectile, length: 0.0315 }
    expect(
      trajectoryResult({ ...values, twist: 0.178 }, long, 'right').lowStability,
    ).toBeUndefined()
    const slow = trajectoryResult({ ...values, twist: 0.36 }, long, 'right').lowStability
    expect(slow?.stability).toBeLessThan(1)
    expect(slow?.range).toBeGreaterThan(0)
    expect(
      trajectoryResult({ ...values, twist: 0.36 }, projectile, 'right').lowStability,
    ).toBeUndefined()
  })

  it('throws the range and input errors', () => {
    expect(() =>
      trajectoryResult({ ...values, rangeStep: 1, maxRange: 1000 }, projectile, 'right'),
    ).toThrow(/500 rows/)
    expect(() =>
      trajectoryResult({ ...values, muzzleVelocity: undefined }, projectile, 'right'),
    ).toThrow('Enter a number for Muzzle velocity.')
  })
})
