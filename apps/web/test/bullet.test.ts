import { lbPerSqInToKgPerSqM, millerStability } from '@open-reloading/core'
import type { Bullet } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import {
  bandCount,
  bulletDrag,
  computedBulletRows,
  effectiveBulletValues,
  millerTwist,
  recordBulletValues,
  typedBullet,
} from '../src/lib/bullet.ts'
import { rowValue } from '../src/lib/record-fields.ts'
import { metersPerFoot, pascalsPerInHg, presetUnits } from '../src/lib/units.ts'
import { missing } from './defined.ts'
import { targetBullet } from './fixtures/bullets.ts'

/** Synthetic record; the numbers are made up. */
const record = (bcs: Bullet['ballisticCoefficients']): Bullet => ({
  id: 'example-a-1',
  manufacturer: 'example-a',
  productNumber: '1',
  name: 'Test 175',
  diameter: { value: 7.82 },
  mass: { value: 11.34 },
  length: { value: 31.2 },
  ballisticCoefficients: bcs,
  provenance: { kind: 'published', sources: [{ title: 'Test catalog' }] },
})

it('turns one BC into one band from 0 m/s with SI mass and lengths', () => {
  const r = bulletDrag(record([{ dragModel: 'G7', value: 0.25 }]), 'G7')
  expect(r).toEqual({
    kind: 'bands',
    projectile: {
      mass: 11.34e-3,
      diameter: 7.82e-3,
      length: 31.2e-3,
      drag: {
        kind: 'bc',
        model: 'G7',
        bands: [{ ballisticCoefficient: 0.25 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
      },
    },
  })
})

it('keeps BCs with distinct band starts as bands', () => {
  const r = bulletDrag(
    record([
      { dragModel: 'G1', value: 0.5 },
      { dragModel: 'G1', value: 0.48, minVelocity: { value: 600 } },
    ]),
    'G1',
  )
  expect(r.kind === 'bands' && r.projectile.drag).toEqual({
    kind: 'bc',
    model: 'G1',
    bands: [
      { ballisticCoefficient: 0.5 * lbPerSqInToKgPerSqM, minVelocity: 0 },
      { ballisticCoefficient: 0.48 * lbPerSqInToKgPerSqM, minVelocity: 600 },
    ],
  })
})

it('asks for a choice among BCs without distinct band starts, then uses the chosen one', () => {
  const rec = record([
    { dragModel: 'G1', value: 0.5, note: 'tip A' },
    { dragModel: 'G1', value: 0.52, note: 'tip B' },
  ])
  expect(bulletDrag(rec, 'G1')).toEqual({
    kind: 'choose',
    values: [
      { value: 0.5, minVelocity: undefined, note: 'tip A' },
      { value: 0.52, minVelocity: undefined, note: 'tip B' },
    ],
  })
  const chosen = bulletDrag(rec, 'G1', 1)
  expect(chosen.kind === 'bands' && chosen.projectile.drag).toEqual({
    kind: 'bc',
    model: 'G1',
    bands: [{ ballisticCoefficient: 0.52 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
  })
})

it('gives none without a BC of the model', () => {
  expect(bulletDrag(record([{ dragModel: 'G1', value: 0.5 }]), 'G7')).toEqual({ kind: 'none' })
  expect(bulletDrag(record(undefined), 'G1')).toEqual({ kind: 'none' })
})

it('computes the sectional density the manufacturer gives (SD 0.253) with its method', () => {
  const [sd = missing(), twist = missing()] = computedBulletRows(targetBullet)
  expect(sd.label).toBe('Sectional density')
  expect(sd.method).toMatch(/^Computed: mass over diameter squared/)
  expect(rowValue(sd, presetUnits('us'))).toBe('0.253 lb/in²')
  expect(rowValue(sd, presetUnits('metric-grams'))).toBe('177.9 kg/m²')
  expect(twist.label).toBe('Twist for Sg 1.5')
  expect(twist.method).toMatch(/^Computed: Miller's rule/)
})

it('gives the twist at which the Miller rule reads Sg 1.5 at 2800 ft/s and standard air', () => {
  const r = record([{ dragModel: 'G7', value: 0.25 }])
  const twist = millerTwist(r) as number
  const sg = millerStability({
    mass: 11.34e-3,
    diameter: 7.82e-3,
    length: 31.2e-3,
    twist,
    velocity: 2800 * metersPerFoot,
    air: { altitude: 0, pressure: 29.92 * pascalsPerInHg, temperature: 288.15, humidity: 0 },
  })
  expect(sg).toBeCloseTo(1.5, 10)
  expect(millerTwist({ ...r, length: undefined })).toBeUndefined()
  expect(computedBulletRows({ ...r, length: undefined })).toHaveLength(1)
})

it("reads a record's values in SI, a BC only where the record lists one value of the model", () => {
  const r = record([
    { dragModel: 'G7', value: 0.25 },
    { dragModel: 'G1', value: 0.5, minVelocity: { value: 900 } },
    { dragModel: 'G1', value: 0.45, minVelocity: { value: 500 } },
  ])
  expect(recordBulletValues(r)).toEqual({
    bulletMass: 11.34e-3,
    bulletDiameter: 7.82e-3,
    bulletLength: 31.2e-3,
    bulletBcG7: 0.25 * lbPerSqInToKgPerSqM,
  })
  expect(bandCount(r, 'G1')).toBe(2)
  expect(bandCount(undefined, 'G7')).toBe(0)
  expect(recordBulletValues(undefined)).toEqual({})
})

it("puts typed values into the record and leaves the record's own values alone", () => {
  const r = record([{ dragModel: 'G7', value: 0.25 }])
  const typed = typedBullet(r, {
    bulletMass: 9.5e-3,
    bulletDiameter: 7.85e-3,
    bulletLength: 30e-3,
    bulletBcG7: 0.3 * lbPerSqInToKgPerSqM,
    bulletBcG1: 0.55 * lbPerSqInToKgPerSqM,
  })
  expect(typed.mass.value).toBeCloseTo(9.5, 9)
  expect(typed.diameter?.value).toBeCloseTo(7.85, 9)
  expect(typed.length?.value).toBeCloseTo(30, 9)
  const bcs = Object.fromEntries(
    (typed.ballisticCoefficients ?? []).map((c) => [c.dragModel, c.value]),
  )
  expect(bcs.G7).toBeCloseTo(0.3, 9)
  expect(bcs.G1).toBeCloseTo(0.55, 9)
  expect(typed.name).toBe(r.name)
  // the record's own values typed again, or none: the record as it is
  expect(typedBullet(r, recordBulletValues(r))).toEqual(r)
  expect(typedBullet(r, {})).toEqual(r)
})

it('replaces all bands of a model with one band from 0 m/s', () => {
  const r = record([
    { dragModel: 'G1', value: 0.5, minVelocity: { value: 900 } },
    { dragModel: 'G1', value: 0.45, minVelocity: { value: 500 } },
    { dragModel: 'G7', value: 0.25 },
  ])
  const typed = typedBullet(r, { bulletBcG1: 0.4 * lbPerSqInToKgPerSqM })
  expect(typed.ballisticCoefficients).toEqual([
    { dragModel: 'G7', value: 0.25 },
    { dragModel: 'G1', value: expect.closeTo(0.4, 9) },
  ])
  const drag = bulletDrag(typed, 'G1')
  expect(drag.kind).toBe('bands')
})

it('takes the typed mass and diameter into the projectile of the drag', () => {
  const r = record([{ dragModel: 'G7', value: 0.25 }])
  const drag = bulletDrag(typedBullet(r, { bulletMass: 9.5e-3, bulletDiameter: 7.85e-3 }), 'G7')
  if (drag.kind !== 'bands') throw new Error('bands expected')
  expect(drag.projectile.mass).toBeCloseTo(9.5e-3, 12)
  expect(drag.projectile.diameter).toBeCloseTo(7.85e-3, 12)
})

it('keeps the record value where a typed bullet value is 0', () => {
  const r = record([{ dragModel: 'G7', value: 0.25 }])
  const values = effectiveBulletValues(r, undefined, {
    bulletDiameter: { si: 0 },
    bulletLength: { si: 0.032 },
  })
  expect(values.bulletDiameter).toBe(recordBulletValues(r).bulletDiameter)
  expect(values.bulletLength).toBe(0.032)
})
