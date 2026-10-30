import type { UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { blankFirearm } from '../src/lib/firearm.ts'
import { gapNotes, loadGaps } from '../src/lib/load-gaps.ts'
import { loadUse, loadUseText } from '../src/lib/load-use.ts'

const saved = '2026-01-01T00:00:00.000Z'
const rifle = '0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601'

const session = (id: string, date?: string): UserRecord => ({
  kind: 'session',
  id,
  name: id,
  saved,
  data: {
    origin: 'user',
    ...(date && { date }),
    device: { kind: 'doppler-radar' },
    strings: [{ shots: [{ velocity: { value: 800 } }] }],
    provenance: { kind: 'measured', sources: [{ title: id }] },
  },
})

const load = (id: string, firearm?: string, sessions?: string[]): UserRecord => ({
  kind: 'load',
  id,
  name: id,
  saved,
  data: {
    origin: 'user',
    ...(firearm && { firearm: `user:${firearm}` }),
    ...(sessions && { sessions: sessions.map((s) => `user:${s}`) }),
  },
})

describe('load and firearm use', () => {
  const records = [
    session('s1', '2026-03-01'),
    session('s2', '2026-05-01'),
    session('s3'),
    load('a', rifle, ['s1', 's3']),
    load('b', rifle, ['s2']),
    load('c', undefined, ['s3']),
    load('d'),
  ]
  const { loads, firearms } = loadUse(records)

  it('gives a load its firearm, its session count and the latest dated day', () => {
    expect(loads.get('a')).toEqual({ firearm: rifle, sessions: 2, last: '2026-03-01' })
    expect(loads.get('b')).toEqual({ firearm: rifle, sessions: 1, last: '2026-05-01' })
  })

  it('counts undated sessions without a day, and a load without a firearm names none', () => {
    expect(loads.get('c')).toEqual({ firearm: undefined, sessions: 1, last: undefined })
    expect(loads.get('d')).toEqual({ firearm: undefined, sessions: 0, last: undefined })
  })

  it('counts the loads of a firearm and their latest session day', () => {
    expect(firearms.get(rifle)).toEqual({ loads: 2, last: '2026-05-01' })
    expect(firearms.size).toBe(1)
  })

  it('writes the firearm, the sessions and the last day, leaving out what a load lacks', () => {
    const text = (id: string, firearm?: string) => loadUseText(loads.get(id), firearm, english)
    expect(text('a', 'Rifle')).toBe('Rifle · 2 sessions · 1 March 2026')
    expect(text('c')).toBe('1 session')
    expect(text('d')).toBe('No session')
  })
})

const firearm = (id: string, cartridge?: string): UserRecord => ({
  kind: 'firearm',
  id,
  name: id,
  saved,
  data: { ...blankFirearm(), name: id, ...(cartridge && { cartridge }) },
})

const loadFor = (id: string, firearm: string | undefined, cartridge?: string): UserRecord => ({
  kind: 'load',
  id,
  name: `Load ${id}`,
  saved,
  data: {
    origin: 'user',
    ...(firearm && { firearm }),
    ...(cartridge && { cartridge }),
  },
})

describe('load and firearm gaps', () => {
  const m308 = 'catalogue:308-winchester'
  const m65 = 'catalogue:6-5-creedmoor'
  const design = '1a2b3c4d-5e6f-4a70-8b81-9c92d3e4f5a6'
  const pistol = '2b1c2d3e-4f50-4a61-8b72-9c83d4e5f602'
  const spare = '3b1c2d3e-4f50-4a61-8b72-9c83d4e5f603'
  const bare = '4b1c2d3e-4f50-4a61-8b72-9c83d4e5f604'
  const records: UserRecord[] = [
    firearm(rifle, m308),
    firearm(pistol, `user:${design}`),
    firearm(spare, m308),
    firearm(bare),
    {
      kind: 'cartridge',
      id: design,
      name: 'My wildcat',
      saved,
      data: { origin: 'user', basedOn: m308 },
    },
    loadFor('a', `user:${rifle}`, m308),
    loadFor('b', `user:${rifle}`, m65),
    loadFor('c', `user:${pistol}`, m308),
    loadFor('d', `user:${bare}`, m65),
    loadFor('e', undefined, m65),
    loadFor('f', 'user:5b1c2d3e-4f50-4a61-8b72-9c83d4e5f605', m65),
    loadFor('g', `user:${rifle}`),
  ]
  const gaps = loadGaps(records)
  const names: Record<string, string> = { [m308]: '.308 Winchester', [m65]: '6.5 Creedmoor' }
  const name = (ref: string | undefined) => (ref && gaps.designs.get(ref)) || (ref && names[ref])
  const notes = (id: string) => {
    const f = records.find((r) => r.id === id)
    return f?.kind === 'firearm' ? gapNotes(f, gaps, name, english.t) : []
  }

  it('notes a load of another cartridge than its firearm, naming both cartridges', () => {
    expect(notes(rifle)).toEqual(['Load b is for 6.5 Creedmoor, this firearm for .308 Winchester.'])
    expect(notes(pistol)).toEqual(['Load c is for .308 Winchester, this firearm for My wildcat.'])
  })

  it('compares only set cartridges: a firearm without one has no mismatch', () => {
    expect(notes(bare)).toEqual([])
  })

  it('notes a firearm no saved load names', () => {
    expect([...gaps.unused]).toEqual([spare])
    expect(notes(spare)).toEqual(['No saved load with this firearm.'])
  })

  it('takes a firearm reference that names no stored firearm for no mismatch', () => {
    const all = [...gaps.mismatches.values()].flat().map((m) => m.load)
    expect(all).toEqual(['Load b', 'Load c'])
  })

  it('describes the records only', () => {
    const text = [rifle, pistol, spare].flatMap(notes).join(' ')
    expect(text).not.toMatch(/\b(safe|unsafe|enough|recommended)\b/i)
  })
})
