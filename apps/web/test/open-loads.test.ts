import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import {
  newestLoads,
  openLoadsText,
  parseOpenLoads,
  recentLoads,
  withOpened,
} from '../src/lib/open-loads.ts'
import { putRecords } from '../src/lib/user-store.ts'

it('reads the open set back and ignores anything damaged', () => {
  const set = { ids: ['a', 'b'], active: 'b' }
  expect(parseOpenLoads(openLoadsText(set))).toEqual(set)
  expect(parseOpenLoads(null)).toEqual({ ids: [] })
  expect(parseOpenLoads('not json')).toEqual({ ids: [] })
  expect(parseOpenLoads('{"ids":[1,"a",null],"active":5}')).toEqual({ ids: ['a'] })
  expect(parseOpenLoads('{"ids":["a","a"]}')).toEqual({ ids: ['a'] })
})

it('adds a load to the open set and shows it, keeping the other open loads', () => {
  expect(withOpened({ ids: ['a', 'b'], active: 'a' }, 'c')).toEqual({
    ids: ['a', 'b', 'c'],
    active: 'c',
  })
  expect(withOpened({ ids: ['a', 'b'] }, 'a')).toEqual({ ids: ['a', 'b'], active: 'a' })
})

const load = (id: string, saved: string) => ({ kind: 'load', id, name: `Load ${id}`, saved })

it('lists the newest loads first and skips other records and damaged values', () => {
  const values = [
    load('a', '2026-10-01T10:00:00.000Z'),
    { kind: 'face', id: 'f', name: 'Face', saved: '2026-10-09T10:00:00.000Z' },
    load('b', '2026-10-03T10:00:00.000Z'),
    null,
    { kind: 'load', id: 'x', name: 5, saved: '2026-10-09T10:00:00.000Z' },
    load('c', '2026-10-02T10:00:00.000Z'),
    load('d', '2026-09-30T10:00:00.000Z'),
  ]
  expect(newestLoads(values, 3).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  expect(newestLoads(values, 1)).toEqual([
    { id: 'b', name: 'Load b', saved: '2026-10-03T10:00:00.000Z' },
  ])
})

it('reads the three newest loads of the browser store', async () => {
  const data = { origin: 'user' }
  await putRecords(
    ['1', '2', '3', '4'].map((n) => ({
      kind: 'load',
      id: `r${n}`,
      name: `Load ${n}`,
      saved: `2026-10-0${n}T10:00:00.000Z`,
      data,
    })) as Parameters<typeof putRecords>[0],
  )
  expect((await recentLoads()).map((r) => r.id)).toEqual(['r4', 'r3', 'r2'])
})
