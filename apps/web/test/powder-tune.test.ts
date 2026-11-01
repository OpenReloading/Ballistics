import type { InteriorLoad } from '@open-reloading/core'
import type { SessionRecord, UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  fitStrings,
  loadStrings,
  loadsWithPowder,
  parseVelocities,
  revolverLeakNote,
  sessionStrings,
  tuneHref,
  tuneSessionIds,
} from '../src/lib/powder-tune.ts'
import { powdersWithStrings, readStringForm, stringResiduals } from '../src/lib/tune-strings.ts'

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
  it('gives the fit the shots not excluded and leaves out a string without one', () => {
    const shot = (value: number, excluded?: string) => ({
      velocity: { value },
      ...(excluded && { excluded }),
    })
    expect(
      fitStrings([
        { charge: 0.0025, shots: [shot(800), shot(700, 'flyer'), shot(802)] },
        { charge: 0.0026, shots: [shot(810, 'flyer')] },
      ]),
    ).toEqual([{ charge: 0.0025, velocities: [800, 802] }])
  })
})

describe('the load of the strings', () => {
  const shots = [{ velocity: { value: 800 } }]
  const at = (g: number, load?: string) => ({
    shots,
    ...(load && { load }),
    variation: { kind: 'charge' as const, value: { value: g } },
  })

  it('fits the strings of the first load and leaves out those of another', () => {
    const r = loadStrings([
      session([at(2.5, 'user:a'), { shots }, at(2.6, 'user:b'), at(2.7, 'user:a')]),
    ])
    expect(r.load).toBe('user:a')
    expect(r.strings).toEqual(loadStrings([session([at(2.5), at(2.7)])]).strings)
    expect(r.left).toEqual(loadStrings([session([at(2.6)])]).strings)
  })

  it('names no load for strings fired before the load was saved', () => {
    const r = loadStrings([session([at(2.5), at(2.6)])])
    expect(r.load).toBeUndefined()
    expect(r.strings).toHaveLength(2)
    expect(loadStrings([]).load).toBeUndefined()
  })
})

describe('the saved loads of a powder', () => {
  const shots = [{ velocity: { value: 800 } }]
  const mapped = {
    ...session([{ shots, variation: { kind: 'charge', value: { value: 2.5 } } }]),
    id: 'm',
  }
  const unmapped = { ...session([{ shots }]), id: 'u' }
  const load = (id: string, name: string, powder: string, sessions: string[]): UserRecord => ({
    kind: 'load',
    id,
    name,
    saved: '2026-01-01T00:00:00.000Z',
    data: { origin: 'user', powder, sessions },
  })

  it('lists the loads with the powder and strings mapped to a charge, by name', () => {
    const records: UserRecord[] = [
      mapped,
      unmapped,
      load('1', 'B', 'user:p', ['user:m']),
      load('2', 'A', 'user:p', ['user:m', 'user:gone']),
      load('3', 'C', 'user:p', ['user:u']),
      load('4', 'D', 'catalogue:x', ['user:m']),
    ]
    expect(loadsWithPowder(records, 'user:p')).toEqual([
      { id: '2', name: 'A' },
      { id: '1', name: 'B' },
    ])
    expect(loadsWithPowder(records, 'user:q')).toEqual([])
  })

  it('offers each powder of a saved load with mapped strings once, not a powder typed by name', () => {
    const typed = {
      ...load('5', 'E', 'x', ['user:m']),
      data: { origin: 'user', powder: { manufacturer: 'M', name: 'N' }, sessions: ['user:m'] },
    } as UserRecord
    const records: UserRecord[] = [
      mapped,
      unmapped,
      load('1', 'B', 'user:p', ['user:m']),
      load('2', 'A', 'user:p', ['user:m']),
      load('3', 'C', 'user:q', ['user:u']),
      load('4', 'D', 'catalogue:x', ['user:m']),
      typed,
    ]
    expect(powdersWithStrings(records)).toEqual(['user:p', 'catalogue:x'])
  })
})

describe('the residual of each string', () => {
  const shot = (value: number, excluded?: 'other') => ({
    velocity: { value },
    ...(excluded && { excluded }),
  })
  const strings = [
    { charge: 2.6e-3, shots: [shot(800)] },
    { charge: 2.7e-3, shots: [shot(810, 'other')] },
    { charge: 2.8e-3, shots: [shot(820)] },
  ]
  const r = (charge: number, kind = 'velocity') => ({ kind, charge, residual: 1 })

  it('pairs the residuals with the strings the fit read, a string without a shot left empty', () => {
    const pressure = r(2.6e-3, 'pressure')
    const out = stringResiduals(strings, [r(2.6e-3), pressure, r(2.8e-3)])
    expect(out.map((x) => x?.charge)).toEqual([2.6e-3, undefined, 2.8e-3])
  })

  it('gives none for residuals of other strings', () => {
    expect(stringResiduals(strings, [r(2.6e-3)])).toEqual([undefined, undefined, undefined])
    expect(stringResiduals(strings, [r(2.6e-3), r(2.9e-3)])).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(stringResiduals(strings, undefined)).toEqual([undefined, undefined, undefined])
  })
})

describe('the add form', () => {
  const units = {
    charge: (x: number) => x / 1000,
    velocity: (x: number) => x,
    temperature: (x: number) => x + 273.15,
  }

  it('reads a charge, velocities and a temperature in SI', () => {
    expect(readStringForm({ charge: '2.5', shots: '800 810', temperature: '-5' }, units)).toEqual({
      string: {
        charge: 0.0025,
        shots: [{ velocity: { value: 800 } }, { velocity: { value: 810 } }],
        temperature: 268.15,
      },
    })
    const plain = readStringForm({ charge: '2.5', shots: '800', temperature: '' }, units)
    expect('string' in plain && plain.string.temperature).toBe(undefined)
  })

  it('names each field that does not read', () => {
    expect(readStringForm({ charge: '0', shots: '', temperature: 'warm' }, units)).toEqual({
      errors: { charge: true, shots: true, temperature: true },
    })
    expect(readStringForm({ charge: '2.5', shots: '800 -1', temperature: '' }, units)).toEqual({
      errors: { shots: true },
    })
  })
})

describe('revolver leak note', () => {
  const load = { charge: 3e-4 } as InteriorLoad
  const leak = (area: number): InteriorLoad => ({
    ...load,
    leakage: { area: [{ travel: 0, area }] },
  })

  it('notes a load of the pistol and revolver table without a leak area', () => {
    expect(revolverLeakNote('IV', load)).toBe(true)
    expect(revolverLeakNote('IV', leak(0))).toBe(true)
  })

  it('leaves out a load with a leak area', () => {
    expect(revolverLeakNote('IV', leak(1e-7))).toBe(false)
  })

  it('leaves out a rifle cartridge, a cartridge without a record and no load', () => {
    expect(revolverLeakNote('I', load)).toBe(false)
    expect(revolverLeakNote(undefined, load)).toBe(false)
    expect(revolverLeakNote('IV', undefined)).toBe(false)
  })

  it('follows the linked firearm where it states its action, whatever the cartridge table', () => {
    expect(revolverLeakNote('I', load, 'revolver')).toBe(true)
    expect(revolverLeakNote(undefined, load, 'revolver')).toBe(true)
    expect(revolverLeakNote(undefined, leak(1e-7), 'revolver')).toBe(false)
    expect(revolverLeakNote('IV', load, 'pistol')).toBe(false)
    expect(revolverLeakNote('IV', load, 'rifle')).toBe(false)
  })

  it('keeps the table IV rule for a firearm without the field or no firearm', () => {
    expect(revolverLeakNote('IV', load, undefined)).toBe(true)
    expect(revolverLeakNote('I', load, undefined)).toBe(false)
  })
})
