import { bulletProfile } from '@openreloading/drawing/bullet'
import { expect, it } from 'vitest'
import type { BulletRecord } from '../src/lib/api-types.ts'
import {
  compareGroups,
  differenceMarks,
  rowDiffers,
  sharedScale,
} from '../src/lib/bullet-compare.ts'
import {
  compareFrom,
  compareHref,
  maxComparedBullets,
  parseCompareIds,
} from '../src/lib/compare-ids.ts'
import { presetUnits } from '../src/lib/units.ts'

it('parses ids: trimmed, deduplicated, at most four, only record id characters', () => {
  expect(parseCompareIds('a-1, b-2,,a-1')).toEqual({ status: 'ok', ids: ['a-1', 'b-2'] })
  expect(parseCompareIds(['a', 'b'])).toEqual({ status: 'ok', ids: ['a'] })
  expect(parseCompareIds(undefined)).toEqual({ status: 'empty' })
  expect(parseCompareIds(' , ')).toEqual({ status: 'empty' })
  expect(parseCompareIds('a,b,c,d,e')).toEqual({ status: 'tooMany', count: 5 })
  expect(parseCompareIds('a,../x,B C')).toEqual({ status: 'invalid', ids: ['../x', 'B C'] })
  expect(parseCompareIds('x'.repeat(81))).toMatchObject({ status: 'invalid' })
  expect(maxComparedBullets).toBe(4)
})

it("links a bullet record's Compare to the list at its caliber with the bullet ticked", () => {
  expect(compareFrom('alpha-30425', 7.823)).toBe('/bullets?caliber=.308&pick=alpha-30425')
})

it('writes the compare link with the ids in order', () => {
  expect(compareHref(['b', 'a'])).toBe('/bullets/compare?ids=b,a')
})

it('marks the largest and smallest shown value of a row', () => {
  expect(differenceMarks(['0.5', '0.25', '0.4'])).toEqual(['max', 'min', undefined])
  expect(differenceMarks(['.308', undefined, '.224'])).toEqual(['max', undefined, 'min'])
  // ties share the mark
  expect(differenceMarks(['2', '1', '2'])).toEqual(['max', 'min', 'max'])
  expect(differenceMarks(['1 turn in 10.0', '1 turn in 8.0'])).toEqual(['max', 'min'])
})

it('marks nothing where fewer than two values are shown or all are the same', () => {
  expect(differenceMarks(['1', undefined])).toEqual([undefined, undefined])
  // compared as shown: 0.5004 and 0.5 both show as 0.500
  expect(differenceMarks(['0.500', '0.500'])).toEqual([undefined, undefined])
  expect(differenceMarks([undefined, undefined])).toEqual([undefined, undefined])
})

const record = (over: Partial<BulletRecord>): BulletRecord =>
  ({
    id: 'x',
    manufacturer: 'example',
    name: 'Name',
    diameter: { value: 7.823 },
    mass: { value: 10.886 },
    provenance: { kind: 'published' },
    ...over,
  }) as BulletRecord

it('merges the data tables in the record groups, values in the preset, a missing one undefined', () => {
  const a = record({
    length: { value: 31.5 },
    recommendedTwist: { value: 254 },
    ballisticCoefficients: [
      { dragModel: 'G7', value: 0.26 },
      { dragModel: 'G1', value: 0.507 },
    ],
  } as Partial<BulletRecord>)
  const b = record({ id: 'y', noseLength: { value: 15 } } as Partial<BulletRecord>)
  const us = compareGroups([a, b], presetUnits('us'))
  expect(us.map((g) => g.title)).toEqual([
    'Size',
    'Shape',
    'Twist',
    'Computed',
    'Ballistic coefficients',
  ])
  const row = (title: string, label: string) =>
    us.find((g) => g.title === title)?.rows.find((r) => r.label === label)
  expect(row('Size', 'Diameter')).toEqual({
    label: 'Diameter',
    symbol: 'd',
    unit: 'in',
    values: ['.3080', '.3080'],
  })
  expect(row('Size', 'Mass')?.values).toEqual(['168.0', '168.0'])
  expect(row('Size', 'Length')?.values).toEqual(['1.2402', undefined])
  expect(row('Shape', 'Nose length')?.values).toEqual([undefined, '.5906'])
  expect(row('Twist', 'Recommended twist')?.values).toEqual(['1 turn in 10.0', undefined])
  expect(row('Ballistic coefficients', 'G7')?.values).toEqual(['0.260', undefined])
  expect(row('Ballistic coefficients', 'G1')?.values).toEqual(['0.507', undefined])
  const metric = compareGroups([a], presetUnits('metric-grams'))
  expect(metric[0].rows.map((r) => [r.label, r.values[0], r.unit])).toEqual([
    ['Diameter', '7.82', 'mm'],
    ['Mass', '10.89', 'g'],
    ['Length', '31.50', 'mm'],
  ])
})

it('keeps a repeated label once per repeat', () => {
  const b = record({
    ballisticCoefficients: [
      { dragModel: 'G1', value: 0.507 },
      { dragModel: 'G1', value: 0.49 },
    ],
  } as Partial<BulletRecord>)
  const bc = compareGroups([b], presetUnits('us')).at(-1)
  expect(bc?.rows.map((r) => r.values[0])).toEqual(['0.507', '0.490'])
})

it('finds a row differing where its shown values are not all the same', () => {
  expect(rowDiffers(['0.500', '0.500'])).toBe(false)
  expect(rowDiffers(['0.500', '0.501'])).toBe(true)
  expect(rowDiffers(['tangent', undefined])).toBe(true)
  expect(rowDiffers([undefined, undefined])).toBe(false)
})

it('lays every drawing out at one text size and one frame width, so one scale', () => {
  const profile = (diameter: number, length: number) => {
    const p = bulletProfile({ diameter, length }, () => true)
    if ('reason' in p) throw new Error(p.reason)
    return p
  }
  const [short, long] = [profile(5.69, 18), profile(8.59, 45)]
  const { models, tallest } = sharedScale([short, long])
  expect(models[0].em).toBe(models[1].em)
  expect(models[0].frame[2]).toBe(models[1].frame[2])
  expect(tallest).toBe(Math.max(models[0].frame[3], models[1].frame[3]))
  expect(models[1].frame[3]).toBeGreaterThan(models[0].frame[3])
})

it('raises the shared text size until the tallest drawing fits its height with 11 px text', () => {
  const profile = (diameter: number, length: number) => {
    const p = bulletProfile({ diameter, length }, () => true)
    if ('reason' in p) throw new Error(p.reason)
    return p
  }
  const ps = [profile(7.82, 31), profile(12.95, 75)]
  const { models, tallest } = sharedScale(ps, 320)
  expect(models[0].em).toBeGreaterThan(1.8)
  expect((models[0].em * 320) / tallest).toBeGreaterThanOrEqual(11)
  // a short pair needs no raise
  const short = sharedScale([profile(7.82, 31)], 320)
  expect((short.models[0].em * 320) / short.tallest).toBeGreaterThanOrEqual(11)
})
