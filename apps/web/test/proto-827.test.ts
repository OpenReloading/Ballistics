import { publishedLoads } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { exampleInterior } from '../src/lib/example-data.ts'
import { interiorBody } from '../src/lib/interior-input.ts'
import {
  deviationOf,
  type Entry,
  inSample,
  matchingRows,
  nearestRow,
  notComparable,
  publishedFile,
  rowLoad,
  withinPrinted,
} from '../src/lib/proto-827.ts'

const run = { cartridge: '308-win', powder: 'imr-4064', bulletMass: 11.34 }
const [start, max] = matchingRows(publishedFile, run)
const varget = matchingRows(publishedFile, { ...run, powder: 'hodgdon-varget' })
if (!start || !max || !varget[0]) throw new Error('fixture rows missing')

describe('the #827 prototype fixture', () => {
  it('is a published load file of the schema', () => {
    expect(publishedLoads.safeParse(publishedFile).error).toBeUndefined()
  })
})

describe('matchingRows', () => {
  it('takes the rows of the cartridge, the powder record and the printed bullet mass', () => {
    expect([start.key, max.key]).toEqual([
      'proto-175-sie-hpbt-imr-4064/start',
      'proto-175-sie-hpbt-imr-4064/max',
    ])
    expect(matchingRows(publishedFile, { ...run, bulletMass: 10.89 })).toEqual([])
    expect(matchingRows(publishedFile, { ...run, cartridge: '30-06-spring' })).toEqual([])
    expect(matchingRows(publishedFile, { ...run, powder: undefined })).toEqual([])
  })

  it('matches a mass that rounds to the printed figure', () => {
    expect(withinPrinted({ value: 11.33981, raw: '175 GR.' }, 11.34)).toBe(true)
    expect(withinPrinted({ value: 11.33981, raw: '175 GR.' }, 11.38)).toBe(false)
    expect(withinPrinted({ value: 3.3, raw: '3.30 g' }, 3.304)).toBe(true)
    expect(withinPrinted({ value: 3.3, raw: 'n/a' }, 3.3)).toBe(false)
  })
})

describe('comparison', () => {
  it('compares a case-contact row by velocity and pressure against the bands', () => {
    expect(notComparable(start)).toEqual({})
    const d = deviationOf(start, { velocity: 777.24, pressure: 3116.43e5 * 1.1 })
    expect(d.velocity?.delta).toBeCloseTo(15.24, 9)
    expect(d.velocity?.percent).toBeCloseTo(2, 9)
    expect(d.velocity?.band).toBe(7.24)
    expect(d.pressure?.percent).toBeCloseTo(10, 9)
    expect(d.pressure?.band).toBe(37.9)
  })

  it('compares a crusher row by velocity only', () => {
    const [row] = varget as [Entry]
    expect(notComparable(row)).toEqual({
      pressure: 'Crusher pressure (CUP, LUP): compared by velocity only',
    })
    expect(deviationOf(row, { velocity: 800, pressure: 3e8 })).toEqual({
      velocity: expect.objectContaining({ band: 7.24 }),
    })
  })

  it('refuses a row without barrel, method or at a distance', () => {
    const without = (load: Partial<Entry['load']>, charge: Partial<Entry['charge']> = {}) => ({
      ...start,
      load: { ...start.load, ...load },
      charge: { ...start.charge, ...charge },
    })
    expect(notComparable(without({ barrel: undefined }))).toEqual({
      velocity: 'Barrel not printed',
      pressure: 'Barrel not printed',
    })
    const point = { ...start.charge.velocity, value: 762, raw: '2500', point: { label: 'V5' } }
    expect(notComparable(without({}, { velocity: point, pressure: undefined }))).toEqual({
      velocity: 'Velocity printed at a distance: not corrected to the muzzle yet',
      pressure: 'No pressure printed',
    })
    const unstated = { unit: 'bar' as const, peak: { value: 3000, raw: '3000 bar' } }
    expect(notComparable(without({}, { velocity: undefined, pressure: unstated }))).toEqual({
      velocity: 'No velocity printed',
      pressure: 'Pressure method not stated',
    })
  })
})

describe('rowLoad', () => {
  const { load } = interiorBody(exampleInterior)
  const seating = { overallLength: 0.0711, barrel: 0.6096 }

  it('fires the row from its test barrel with the bullet base moved by the COAL step', () => {
    const row = rowLoad(load, seating, start)
    const base = seating.barrel - load.barrel.length
    expect(row?.charge).toBeCloseTo(2.689155e-3, 12)
    expect(row?.barrel.length).toBeCloseTo(0.6096 - (base + 0.00002), 12)
    expect(row?.chamber.volume).toBeCloseTo(load.chamber.volume + load.chamber.boreArea * 2e-5, 15)
  })

  it('needs a seated bullet', () => {
    expect(rowLoad(load, {}, start)).toBeUndefined()
  })
})

describe('nearestRow and inSample', () => {
  it('picks the row nearest the run charge', () => {
    expect(nearestRow([start, max], 2.9e-3)?.key).toBe(max.key)
    expect(nearestRow([], 2.9e-3)).toBeUndefined()
  })

  it('reads the split of the cartridge id as the CLI does', async () => {
    // first SHA-256 bytes: 308-win 58 (validation), 30-br above 101 (training, `packages/cli/test/data.ts`)
    expect(await inSample('308-win')).toBe(false)
    expect(await inSample('30-br')).toBe(true)
  })
})
