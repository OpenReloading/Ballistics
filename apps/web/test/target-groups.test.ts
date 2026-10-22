import type { ShotGroup } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import { groupStatisticsInput } from '../src/lib/target-groups.ts'

const group: ShotGroup = {
  id: 'g1',
  name: 'Step 1',
  colour: '#d9480f',
  distance: 100,
  aim: { x: -0.002, y: 0.004 },
  shots: [
    { x: 0.003, y: -0.001, placement: 'placed', chrono: { session: 's1', string: 0, shot: 1 } },
    { x: 0.005, y: 0.002, placement: 'detected', excluded: true },
  ],
}

describe('statisticsInput', () => {
  it('passes the SI values', () => {
    const input = groupStatisticsInput(group)
    expect(input).toEqual({
      shots: [
        { x: 0.003, y: -0.001, excluded: false },
        { x: 0.005, y: 0.002, excluded: true },
      ],
      distance: 100,
      aim: { x: -0.002, y: 0.004 },
    })
  })

  it('leaves out the aim and velocities when there are none', () => {
    const input = groupStatisticsInput({ ...group, aim: undefined })
    expect(input.aim).toBeUndefined()
    expect(input.shots[0].velocity).toBeUndefined()
  })
})
