import type { UserRecord } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import { blankFirearm } from '../src/lib/firearm.ts'
import { yourDataRows } from '../src/lib/your-data.ts'

const saved = '2026-10-26T10:00:00.000Z'
const firearm = (id: string): UserRecord => ({
  kind: 'firearm',
  id,
  name: id,
  saved,
  data: { ...blankFirearm(), name: id },
})

it('counts the records of each kind, 0 for a kind with none, with the list each row opens', () => {
  const rows = yourDataRows([firearm('a'), firearm('b')])
  expect(rows.map((r) => [r.label, r.count])).toEqual([
    ['Cartridges', 0],
    ['Bullets', 0],
    ['Powders', 0],
    ['Brass', 0],
    ['Targets', 0],
    ['Firearms', 2],
  ])
  expect(rows.find((r) => r.label === 'Brass')?.href).toBe('/cases?src=user')
  expect(rows.find((r) => r.label === 'Bullets')?.href).toBe('/bullets?src=user')
  expect(rows.find((r) => r.label === 'Powders')?.href).toBe('/powders?src=user')
  expect(rows.find((r) => r.label === 'Targets')?.href).toBe('/targets?src=user')
})

it('counts nothing but the kinds it lists', () => {
  const maker: UserRecord = {
    kind: 'manufacturer',
    id: 'm',
    name: 'Maker',
    saved,
    data: { origin: 'user' },
  }
  expect(yourDataRows([maker]).every((r) => r.count === 0)).toBe(true)
})
