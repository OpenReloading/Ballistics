import { radPerMoa } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { cssMm, ladderMarks, markDiameterMm, maxMarkMm, rulerMm } from '../src/lib/ladder-target.ts'

describe('ladder target', () => {
  it('prints the diameter of the angular size at the entered distance', () => {
    // 1 MOA subtends 29.089 mm at 100 m and twice that at 200 m
    expect(markDiameterMm(100, radPerMoa)).toBeCloseTo(29.089, 3)
    expect(markDiameterMm(200, radPerMoa)).toBeCloseTo(58.178, 3)
    // 1 mrad at 50 m is 50 mm (the tangent differs from the angle by 1e-7)
    expect(markDiameterMm(50, 1e-3)).toBeCloseTo(50, 4)
  })

  it('measures the ruler in millimetres', () => {
    expect(cssMm(rulerMm)).toBe('100mm')
    expect(cssMm(29.0888)).toBe('29.09mm')
  })

  it('gives one mark per step in step order with the user own labels', () => {
    const marks = ladderMarks(['41.0 gr', '41.5 gr', '42.0 gr'], 100, radPerMoa)
    expect(marks.map((m) => m.label)).toEqual(['41.0 gr', '41.5 gr', '42.0 gr'])
    expect(new Set(marks.map((m) => m.diameter)).size).toBe(1)
  })

  it('gives no marks where one does not fit a sheet', () => {
    expect(ladderMarks(['a'], 1000, 10 * radPerMoa)).toEqual([])
    expect(markDiameterMm(1000, 10 * radPerMoa)).toBeGreaterThan(maxMarkMm)
    expect(ladderMarks(['a'], 0, radPerMoa)).toEqual([])
  })
})
