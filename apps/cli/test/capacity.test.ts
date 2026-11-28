import { existsSync, mkdtempSync, readdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isEstimatedCapacity } from '@rangefoundry/schema'
import { waterDensityGramsPerCm3 } from '@rangefoundry/units'
import { describe, expect, it } from 'vitest'
import {
  estimateCapacities,
  fillFactor,
  outlineVolume,
  writeEstimatedCapacities,
} from '../src/capacity.ts'
import { DataError, Refusal } from '../src/errors.ts'
import { loadRecords } from '../src/records.ts'
import { recordRoots, records } from './fixture.ts'

const value = (side: 'cartridge' | 'chamber', symbol: string, v: number) => ({
  side,
  symbol,
  quantity: 'length' as const,
  value: v,
})

describe('outlineVolume', () => {
  it('is the cylinder of a straight case', () => {
    const values = [
      value('cartridge', 'P1', 10),
      value('cartridge', 'L3', 20),
      value('cartridge', 'H1', 10),
    ]
    expect(outlineVolume({ values })).toBeCloseTo(Math.PI * 25 * 20, 9)
  })

  it('adds the cone from the head to the shoulder, and takes a value the cartridge lacks from the chamber', () => {
    const values = [
      value('chamber', 'P1', 10),
      value('cartridge', 'L1', 10),
      value('cartridge', 'P2', 8),
      value('cartridge', 'L3', 20),
      value('cartridge', 'H1', 8),
    ]
    // cone 0 to 10 from radius 5 to 4, then a cylinder of radius 4 to 20
    expect(outlineVolume({ values })).toBeCloseTo(
      ((Math.PI * 10) / 3) * (25 + 20 + 16) + Math.PI * 16 * 10,
      9,
    )
  })

  it('is undefined without a case length', () => {
    expect(
      outlineVolume({ values: [value('cartridge', 'P1', 10), value('cartridge', 'H1', 10)] }),
    ).toBeUndefined()
  })
})

describe('fillFactor', () => {
  it('is the median ratio, with the leave-one-out error of each pair against the median of the others', () => {
    const r = fillFactor([0.6, 0.7, 0.8].map((capacity) => ({ capacity, outline: 1 })))
    expect(r.factor).toBeCloseTo(0.7, 12)
    expect(r.cartridges).toBe(3)
    // 0.75 / 0.6 - 1, 0.7 / 0.7 - 1 and 0.65 / 0.8 - 1
    expect(r.looRms).toBeCloseTo(Math.sqrt((0.25 ** 2 + 0.1875 ** 2) / 3), 12)
  })

  it('is bad input with fewer than 3 pairs', () => {
    expect(() =>
      fillFactor([
        { capacity: 1, outline: 1 },
        { capacity: 1, outline: 1 },
      ]),
    ).toThrow(DataError)
  })
})

describe('estimateCapacities', () => {
  const { fill, estimates } = estimateCapacities(records)
  const byCartridge = new Map(estimates.map((e) => [e.cartridge.replace('catalogue:', ''), e]))

  it('estimates a cartridge with an outline and no capacity, flagged derived', () => {
    const estimate = byCartridge.get('7-62-x-54-r')
    const outline = outlineVolume(records.cartridges.get('7-62-x-54-r') as never) as number
    expect(estimate?.waterCapacity.value).toBeCloseTo(
      (fill.factor * outline * waterDensityGramsPerCm3) / 1000,
      3,
    )
    expect(estimate && isEstimatedCapacity(estimate)).toBe(true)
  })

  it('leaves out a cartridge with a capacity record, and fits the factor on those only', () => {
    expect(byCartridge.has('308-match')).toBe(false)
    expect(fill.cartridges).toBe(records.capacities.size)
  })
})

describe('writeEstimatedCapacities', () => {
  it('writes one record per estimate that loads as an estimate, and refuses a folder that exists', () => {
    const out = mkdtempSync(join(tmpdir(), 'cli-estimates-'))
    const r = writeEstimatedCapacities(recordRoots, out)
    expect(readdirSync(r.folder)).toHaveLength(r.written)
    const loaded = loadRecords([...recordRoots, out])
    expect(isEstimatedCapacity(loaded.capacities.get('7-62-x-54-r') as never)).toBe(true)
    expect(isEstimatedCapacity(loaded.capacities.get('308-match') as never)).toBe(false)
    expect(existsSync(join(out, 'capacities'))).toBe(true)
    expect(() => writeEstimatedCapacities(recordRoots, out)).toThrow(Refusal)
  })

  it('refuses a dangling symbolic link as <out>/capacities and creates nothing at its target', () => {
    const out = mkdtempSync(join(tmpdir(), 'cli-estimates-'))
    const target = join(out, 'elsewhere')
    symlinkSync(target, join(out, 'capacities'))
    expect(() => writeEstimatedCapacities(recordRoots, out)).toThrow(Refusal)
    expect(existsSync(target)).toBe(false)
  })
})
