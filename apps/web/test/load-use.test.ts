import type { UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { loadUse } from '../src/lib/load-use.ts'

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
})
