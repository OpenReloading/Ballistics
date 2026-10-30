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

const load: UserRecord = { kind: 'load', id: 'l', name: 'Load', saved, data: { origin: 'user' } }
const notesOf = (records: UserRecord[]) =>
  yourDataRows(records)
    .find((r) => r.kind === 'firearm')
    ?.notes?.map((n) => [n.label, n.href, n.count])

it('adds the notes on firearms and on saved loads to the firearms row only, each linked to where it is shown', () => {
  const rows = yourDataRows([firearm('a'), load])
  expect(rows.filter((r) => 'notes' in r)).toHaveLength(1)
  expect(rows.find((r) => r.kind === 'firearm')?.href).toBe('/firearms')
  // the firearm no load names on the firearms page, the load without a firearm on the Saved loads line
  expect(notesOf([firearm('a'), load])).toEqual([
    ['Notes on firearms', '/firearms', 1],
    ['Notes on saved loads', '/workbench', 1],
  ])
})

it('links the note of a load without a firearm to the saved loads, with no firearm stored', () => {
  expect(notesOf([load])).toEqual([
    ['Notes on firearms', '/firearms', 0],
    ['Notes on saved loads', '/workbench', 1],
  ])
})
