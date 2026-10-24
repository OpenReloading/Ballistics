import type { TrajectoryPoint } from '@openreloading/core'
import { describe, expect, it } from 'vitest'
import { movingTargetRows } from '../src/lib/moving-target.ts'

const points = [
  { range: 0, time: 0 },
  { range: 200, time: 0.3 },
  { range: 400, time: 0.7 },
] as TrajectoryPoint[]

describe('movingTargetRows', () => {
  it('leads a crossing target by its speed times the time of flight, skipping range 0', () => {
    const rows = movingTargetRows(points, 2, Math.PI / 2)
    expect(rows.map((r) => r.range)).toEqual([200, 400])
    expect(rows[1]?.lateral).toBeCloseTo(1.4, 12)
    expect(rows[1]?.angle).toBeCloseTo(Math.atan2(1.4, 400), 12)
    expect(rows[1]?.lengths).toBeUndefined()
  })

  it('gives no lead for a target moving along the line of sight', () => {
    for (const r of movingTargetRows(points, 2, 0)) expect(r.lateral).toBeCloseTo(0, 12)
  })

  it('counts the lead in target lengths', () => {
    expect(movingTargetRows(points, 2, Math.PI / 2, 0.7)[0]?.lengths).toBeCloseTo(0.6 / 0.7, 12)
  })
})
