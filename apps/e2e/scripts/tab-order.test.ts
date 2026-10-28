import { expect, it } from 'vitest'
import { inversions, type Stop } from '../tests/web/tab-order.ts'

const row: Stop[] = [
  { name: 'Cartridge', key: [0, 30, 10] },
  { name: 'Primer', key: [0, 32, 200] },
  { name: 'Charge', key: [1, 100, 10] },
  { name: 'Temperature', key: [1, 140, 10] },
  { name: 'Barrel', key: [2, 60, 400] },
]

it('counts no step back in the visual order and one for a swapped pair', () => {
  expect(inversions(row)).toEqual([])
  const swapped = [...row]
  ;[swapped[2], swapped[3]] = [row[3] as Stop, row[2] as Stop]
  expect(inversions(swapped)).toEqual(['Temperature -> Charge'])
  expect(inversions([row[1] as Stop, row[0] as Stop])).toEqual(['Primer -> Cartridge'])
})
