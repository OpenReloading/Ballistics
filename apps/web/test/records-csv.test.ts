import type { UserRecord } from '@open-reloading/schema'
import { describe, expect, it, vi } from 'vitest'
import { toCsv } from '../src/lib/csv.ts'
import { localDay } from '../src/lib/dates.ts'
import { firearmRows, loadRows, saveFirearmsCsv, saveLoadsCsv } from '../src/lib/records-csv.ts'

const api = vi.hoisted(() => ({
  names: new Map<string, string | undefined>(),
  fetched: [] as string[],
  stored: [] as unknown[],
  saved: [] as { blob: Blob; name: string }[],
}))
vi.mock('../src/lib/api-fetch.ts', () => ({
  fetchRecord: (kind: string, id: string) => {
    api.fetched.push(`${kind}/${id}`)
    return api.names.has(`${kind}/${id}`)
      ? Promise.resolve({ name: api.names.get(`${kind}/${id}`) })
      : Promise.reject(new Error('not found'))
  },
}))
vi.mock('../src/lib/user-store.ts', () => ({
  storedRecords: async () => ({ records: api.stored, invalid: [] }),
}))
vi.mock('../src/lib/download.ts', () => ({
  download: (blob: Blob, name: string) => api.saved.push({ blob, name }),
}))

const saved = '2026-01-01T00:00:00.000Z'
const rifle = '0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601'

const names: Record<string, string> = {
  'cartridges catalogue:308-win': '.308 Winchester',
  [`firearms user:${rifle}`]: 'Bench rifle',
  'bullets catalogue:smk-175': 'MatchKing 175',
}
const nameOf = (kind: string, ref: string | undefined) =>
  ref === undefined ? '' : (names[`${kind} ${ref}`] ?? ref)

const records: UserRecord[] = [
  {
    kind: 'session',
    id: 's1',
    name: 's1',
    saved,
    data: {
      origin: 'user',
      date: '2026-04-12',
      device: { kind: 'doppler-radar' },
      strings: [{ shots: [{ velocity: { value: 800 } }] }],
      provenance: { kind: 'measured', sources: [{ title: 's1' }] },
    },
  },
  {
    kind: 'load',
    id: 'a',
    name: 'Match, "long"\nnight',
    saved,
    data: {
      origin: 'user',
      cartridge: 'catalogue:308-win',
      firearm: `user:${rifle}`,
      bullet: 'catalogue:smk-175',
      powder: 'catalogue:gone',
      charge: { value: 2.9 },
      seating: { by: 'baseToOgive', value: { value: 54.1 } },
      sessions: ['user:s1'],
    },
  },
  { kind: 'load', id: 'b', name: 'Empty', saved, data: { origin: 'user' } },
]

describe('saved loads CSV', () => {
  const rows = loadRows(records, nameOf)

  it('names the unit in the column heads and writes numbers as numbers', () => {
    expect(rows[0]).toEqual([
      'Name',
      'Cartridge',
      'Firearm',
      'Bullet',
      'Powder',
      'Charge (g)',
      'Seating (mm)',
      'Seated by',
      'Sessions',
      'Last session',
    ])
    expect(rows[1]).toEqual([
      'Match, "long"\nnight',
      '.308 Winchester',
      'Bench rifle',
      'MatchKing 175',
      'catalogue:gone',
      2.9,
      54.1,
      'baseToOgive',
      1,
      '2026-04-12',
    ])
  })

  it('leaves the values a load lacks empty, one row per load', () => {
    expect(rows).toHaveLength(3)
    expect(rows[2]).toEqual(['Empty', '', '', '', '', '', '', '', 0, ''])
  })

  it('takes the model and name of a bullet and powder typed into the load', () => {
    const typed: UserRecord = {
      kind: 'load',
      id: 't',
      name: 'Typed',
      saved,
      data: { origin: 'user', bullet: { model: 'Own 175' }, powder: { name: 'Own powder' } },
    } as UserRecord
    expect(loadRows([typed], nameOf)[1]?.slice(3, 5)).toEqual(['Own 175', 'Own powder'])
  })

  it('quotes a name with a comma, quotes or a line break', () => {
    expect(toCsv(rows).startsWith('Name,Cartridge,')).toBe(true)
    expect(toCsv(rows)).toContain('\n"Match, ""long""\nnight",.308 Winchester,Bench rifle,')
    expect(toCsv(rows)).toContain(',2.9,54.1,baseToOgive,1,2026-04-12\n')
  })
})

describe('firearm list CSV', () => {
  const firearm = (id: string, name: string, roundCount?: number) =>
    ({
      kind: 'firearm',
      id,
      name,
      saved,
      data: { cartridge: 'catalogue:308-win', ...(roundCount !== undefined && { roundCount }) },
    }) as Extract<UserRecord, { kind: 'firearm' }>

  it('gives one row per firearm with its round count, loads and last session day', () => {
    const uses = new Map([[rifle, { loads: 2, last: '2026-04-12' }]])
    const cartridgeName = (ref: string | undefined) => nameOf('cartridges', ref)
    expect(
      firearmRows(
        [firearm(rifle, 'Bench rifle', 1200), firearm('x', 'Spare')],
        uses,
        cartridgeName,
      ),
    ).toEqual([
      ['Name', 'Cartridge', 'Round count', 'Loads', 'Last session'],
      ['Bench rifle', '.308 Winchester', 1200, 2, '2026-04-12'],
      ['Spare', '.308 Winchester', '', 0, ''],
    ])
  })
})

describe('saving the CSV files', () => {
  const lastSaved = async () => {
    const { blob, name } = api.saved.at(-1) ?? { blob: new Blob(), name: '' }
    const bytes = new Uint8Array(await blob.arrayBuffer())
    return { name, type: blob.type, bom: [...bytes.slice(0, 3)], text: await blob.text() }
  }

  it('names the records of the saved loads from this browser, else from the API once each', async () => {
    api.names = new Map([
      ['cartridges/308-win', '.308 Winchester'],
      ['bullets/smk-175', 'Match 175'],
      ['cartridges/nameless', undefined],
      ['powders/n150', 'N150'],
    ])
    api.fetched = []
    const load = (id: string, data: object) => ({
      kind: 'load',
      id,
      name: id,
      saved,
      data: { origin: 'user', ...data },
    })
    api.stored = [
      {
        kind: 'firearm',
        id: rifle,
        name: 'Bench rifle',
        saved,
        data: { cartridge: 'catalogue:6-5-creedmoor' },
      },
      load('a', {
        cartridge: 'catalogue:308-win',
        firearm: `user:${rifle}`,
        bullet: 'catalogue:smk-175',
        powder: 'catalogue:n150',
      }),
      load('b', {
        cartridge: 'catalogue:nameless',
        firearm: 'user:missing',
        bullet: 'catalogue:gone',
        powder: 'no ref',
      }),
      load('c', {}),
    ]
    await saveLoadsCsv()
    const file = await lastSaved()
    expect(file.name).toBe(`openreloading-loads-${localDay(new Date())}.csv`)
    expect(file.type).toBe('text/csv;charset=utf-8')
    expect(file.bom).toEqual([0xef, 0xbb, 0xbf])
    const lines = file.text.replace('\ufeff', '').split('\n')
    expect(lines[1]).toBe('a,.308 Winchester,Bench rifle,Match 175,N150,,,,0,')
    expect(lines[2]).toBe('b,catalogue:nameless,user:missing,catalogue:gone,no ref,,,,0,')
    expect(lines[3]).toBe('c,,,,,,,,0,')
    expect(lines).toHaveLength(5)
    expect(lines[4]).toBe('')
    expect(api.fetched.sort()).toEqual([
      'bullets/gone',
      'bullets/smk-175',
      'cartridges/308-win',
      'cartridges/nameless',
      'powders/n150',
    ])
  })

  it('saves the firearm list under its own name', async () => {
    const bare = { kind: 'firearm', id: 'x', name: 'Spare', saved, data: {} } as Extract<
      UserRecord,
      { kind: 'firearm' }
    >
    saveFirearmsCsv([bare], new Map(), () => undefined)
    const file = await lastSaved()
    expect(file.name).toBe(`openreloading-firearms-${localDay(new Date())}.csv`)
    expect(file.text.replace('\ufeff', '')).toBe(
      'Name,Cartridge,Round count,Loads,Last session\nSpare,,,0,\n',
    )
  })
})
