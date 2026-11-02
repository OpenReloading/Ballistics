import type { UserRecord } from '@open-reloading/schema'
import { expect, it, vi } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import {
  duplicateStored,
  generatedName,
  type LoadRecord,
  loadGroups,
  loadName,
  renameStored,
  shortName,
  tabAfterClose,
  tabTitles,
} from '../src/lib/load-tabs.ts'
import { namedKey, renamedKey } from '../src/lib/user-data.ts'
import { copyName } from '../src/lib/user-file-names.ts'

const store = vi.hoisted(() => new Map<string, unknown>())
vi.mock('../src/lib/user-store.ts', () => ({
  storedRecord: async (id: string) => store.get(id),
  putRecords: (records: { id: string }[]) => {
    for (const r of records) store.set(r.id, r)
    return Promise.resolve()
  },
}))

const load = (id: string, name: string, saved: string, cartridge?: string) =>
  ({
    kind: 'load',
    id,
    name,
    saved,
    data: { origin: 'user', cartridge },
  }) as Extract<UserRecord, { kind: 'load' }>

it('numbers equal tab titles from the second on', () => {
  expect(tabTitles(['308 Win. load', 'Load', '308 Win. load', '308 Win. load'])).toEqual([
    '308 Win. load',
    'Load',
    '308 Win. load 2',
    '308 Win. load 3',
  ])
  expect(tabTitles([])).toEqual([])
})

const names = { '308-win': '308 Win.', '65-creedmoor': '6.5 Creedmoor' }

it('groups the list by cartridge, newest first, groups by title, without a cartridge last', () => {
  const records = [
    load('a', '308 Win. load', '2026-10-01T10:00:00.000Z', 'catalogue:308-win'),
    load('b', '6.5 Creedmoor load', '2026-10-02T10:00:00.000Z', 'catalogue:65-creedmoor'),
    load('c', '308 Win. load', '2026-10-03T10:00:00.000Z', 'catalogue:308-win'),
    load('d', 'Load', '2026-10-04T10:00:00.000Z'),
  ]
  const groups = loadGroups(records, '', names, english.t)
  expect(groups.map((g) => [g.title, g.records.map((r) => r.id)])).toEqual([
    ['6.5 Creedmoor', ['b']],
    ['308 Win.', ['c', 'a']],
    ['No cartridge', ['d']],
  ])
})

it('groups loads of a catalogue cartridge together by its record id, a design apart', () => {
  const design = 'user:6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c21'
  const records = [
    load('a', 'Older', '2026-10-01T10:00:00.000Z', 'catalogue:308-win'),
    load('b', 'New', '2026-10-02T10:00:00.000Z', 'catalogue:308-win'),
    load('c', 'On a design', '2026-10-03T10:00:00.000Z', design),
  ]
  const groups = loadGroups(records, '', { '308-win': '308 Win.', [design]: 'Mine 7.8' }, english.t)
  expect(groups.map((g) => [g.title, g.records.map((r) => r.id)])).toEqual([
    ['308 Win.', ['b', 'a']],
    ['Mine 7.8', ['c']],
  ])
})

it('filters the list by the words of the query in the name', () => {
  const records = [
    load('a', '308 Win. load', '2026-10-01T10:00:00.000Z', 'catalogue:308-win'),
    load('b', '6.5 Creedmoor load', '2026-10-02T10:00:00.000Z', 'catalogue:65-creedmoor'),
  ]
  expect(
    loadGroups(records, 'creed', {}, english.t).flatMap((g) => g.records.map((r) => r.id)),
  ).toEqual(['b'])
  expect(loadGroups(records, 'zzz', {}, english.t)).toEqual([])
})

it('finds a load by a lot of the load or of one of its session snapshots', () => {
  const lots = {
    ...load('a', 'Lots', '2026-10-01T10:00:00.000Z'),
    data: {
      origin: 'user',
      powderLot: 'P-1001',
      primer: { lot: 'PR-2002' },
      case: { lot: 'C-3003' },
      snapshots: [{ session: 's1', powderLot: 'P-0900', primerLot: 'PR-1900', caseLot: 'C-2900' }],
    },
  } as LoadRecord
  const records = [lots, load('b', 'No lots', '2026-10-02T10:00:00.000Z')]
  const found = (query: string) =>
    loadGroups(records, query, {}, english.t).flatMap((g) => g.records.map((r) => r.id))
  for (const lot of ['P-1001', 'pr-2002', 'C-3003', 'P-0900', 'PR-1900', 'C-2900'])
    expect(found(lot)).toEqual(['a'])
  expect(found('X-4004')).toEqual([])
})

it('picks the next tab, else the previous one, when a tab closes', () => {
  expect(tabAfterClose(['a', 'b', 'c'], 'a')).toBe('b')
  expect(tabAfterClose(['a', 'b', 'c'], 'b')).toBe('c')
  expect(tabAfterClose(['a', 'b', 'c'], 'c')).toBe('b')
  expect(tabAfterClose(['a'], 'a')).toBeUndefined()
})

it('titles a group by the cartridge lookup, not by the record names', () => {
  const records = [
    load('a', 'Match load for Anna', '2026-10-01T10:00:00.000Z', 'catalogue:308-win'),
    load('b', 'Hunting', '2026-10-02T10:00:00.000Z', '308-win'),
    load('c', 'Unknown', '2026-10-03T10:00:00.000Z', 'not-listed'),
  ]
  // a cartridge the lookup lacks (offline, deleted) is titled by its id
  expect(loadGroups(records, '', names, english.t).map((g) => [g.title, g.records.length])).toEqual(
    [
      ['308 Win.', 2],
      ['not-listed', 1],
    ],
  )
})

it('generates a name from the cartridge, bullet, powder and charge, else "New load"', () => {
  expect(generatedName({}, english.t)).toBe('New load')
  expect(
    generatedName(
      {
        cartridge: '308 Win.',
        bullet: 'Bravo Ridge',
        powder: 'Delta Fast',
        charge: '43.5 gr',
      },
      english.t,
    ),
  ).toBe('308 Win., Bravo Ridge, Delta Fast 43.5 gr')
  expect(generatedName({ cartridge: '308 Win.' }, english.t)).toBe('308 Win.')
  expect(generatedName({ bullet: 'Bravo Ridge', charge: '43.5 gr' }, english.t)).toBe(
    'Bravo Ridge, 43.5 gr',
  )
})

it('uses the typed name; an empty or blank one falls back to the generated name', () => {
  expect(loadName('Match', '308 Win.')).toBe('Match')
  expect(loadName(undefined, '308 Win.')).toBe('308 Win.')
  expect(loadName('', '308 Win.')).toBe('308 Win.')
  expect(loadName('   ', '308 Win.')).toBe('308 Win.')
})

it('names a copy and keeps it within the 200 characters a record name may have', () => {
  expect(copyName('Match')).toBe('Match copy')
  expect(copyName('x'.repeat(200))).toHaveLength(200)
  expect(copyName('x'.repeat(200)).endsWith(' copy')).toBe(true)
})

it('keys a saved load by name and data; a rename of the saved key changes only the name', () => {
  const data = { origin: 'user', charge: { value: 3 } }
  expect(namedKey(data, 'A')).not.toBe(namedKey(data, 'B'))
  expect(namedKey(data, 'A')).toBe(namedKey({ origin: 'user', charge: { value: 3 } }, 'A'))
  expect(renamedKey(namedKey(data, 'A'), 'B')).toBe(namedKey(data, 'B'))
})

it('names the switcher by the typed name, else cartridge and powder, else the generated name', () => {
  const generated = '308 Win., Demo 168, DP40 37 gr'
  expect(shortName({ cartridge: '308 Win.', powder: 'DP40', generated })).toBe('308 Win. · DP40')
  expect(shortName({ custom: 'Ladder', cartridge: '308 Win.', generated })).toBe('Ladder')
  expect(shortName({ custom: ' ', cartridge: '308 Win.', generated })).toBe('308 Win.')
  expect(shortName({ generated: 'New load' })).toBe('New load')
})

it('renames and copies the stored load, not the older copy of the list', async () => {
  const listed: LoadRecord = {
    kind: 'load',
    id: 'w1',
    name: 'Ladder',
    saved: '2026-10-01T10:00:00.000Z',
    data: { origin: 'user', charge: { value: 2.8 } },
  }
  const newer = {
    ...listed,
    saved: '2026-10-02T10:00:00.000Z',
    data: { origin: 'user', charge: { value: 3 } },
  }
  store.set('w1', newer)
  await renameStored('w1', 'Ladder 2')
  expect(store.get('w1')).toEqual({ ...newer, name: 'Ladder 2' })
  await duplicateStored(listed, 'w2')
  expect(store.get('w2')).toMatchObject({ id: 'w2', name: 'Ladder 2 copy', data: newer.data })
  store.delete('w1')
  await expect(renameStored('w1', 'Gone')).rejects.toThrow('no longer in this browser')
  expect(store.has('w1')).toBe(false)
})
