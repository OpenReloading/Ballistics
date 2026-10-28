import type { SessionRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  parseVelocities,
  sessionStrings,
  tuneHref,
  tuneSessionIds,
} from '../src/lib/powder-tune.ts'

const session = (strings: SessionRecord['data']['strings']): SessionRecord => ({
  kind: 'session',
  id: 's1',
  name: 'Ladder',
  saved: '2026-01-01T00:00:00.000Z',
  data: {
    origin: 'user',
    device: { kind: 'doppler-radar' },
    strings,
    provenance: { kind: 'measured', sources: [{ title: 'Ladder' }] },
  },
})

describe('powder tuning route', () => {
  it('carries the session ids in the link and reads them back in order', () => {
    expect(tuneHref([])).toBe('/powders/tune')
    const href = tuneHref(['a b', 'c'])
    expect(tuneSessionIds(href.slice(href.indexOf('?')))).toEqual(['a b', 'c'])
  })

  it('keeps the strings mapped to a charge, in kg', () => {
    const shots = [{ velocity: { value: 800 } }]
    const strings = sessionStrings([
      session([{ shots, variation: { kind: 'charge', value: { value: 2.5 } } }, { shots }]),
    ])
    expect(strings).toEqual([{ charge: 0.0025, shots }])
  })

  it('reads velocities separated by spaces or semicolons, with either decimal mark', () => {
    expect(parseVelocities('800 801,5; 802.5', (x) => x)).toEqual([800, 801.5, 802.5])
    expect(parseVelocities('2600', (x) => x * 2)).toEqual([5200])
  })

  it('refuses an empty list and a value that is no positive number', () => {
    expect(parseVelocities('  ', (x) => x)).toBeUndefined()
    expect(parseVelocities('800 abc', (x) => x)).toBeUndefined()
    expect(parseVelocities('800 0', (x) => x)).toBeUndefined()
  })
})
