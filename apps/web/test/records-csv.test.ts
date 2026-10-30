import type { UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { toCsv } from '../src/lib/csv.ts'
import { firearmRows, loadRows } from '../src/lib/records-csv.ts'

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
