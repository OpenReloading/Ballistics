import { lbPerSqInToKgPerSqM, millerStability } from '@open-reloading/core'
import type { Bullet } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import { bulletDrag, computedBulletRows, millerTwist } from '../src/lib/bullet.ts'
import { rowValue } from '../src/lib/record-fields.ts'
import { metersPerFoot, pascalsPerInHg, presetUnits } from '../src/lib/units.ts'
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
  const [sd, twist] = computedBulletRows(targetBullet)
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
