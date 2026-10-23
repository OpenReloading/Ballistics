import { describe, expect, it } from 'vitest'
import type {
  DisciplineSummary,
  FederationSummary,
  MappingSummary,
} from '../src/lib/face-disciplines.ts'
import { disciplineOptions } from '../src/lib/face-disciplines.ts'
import {
  compareDisciplines,
  compareEvents,
  compareFederations,
  compareNames,
  federationFaceIds,
} from '../src/lib/face-order.ts'

describe('comparators', () => {
  it('orders names alphabetically with numbers numerically', () => {
    expect(['Scheibe 100', 'Scheibe 25', 'Alpha', 'Scheibe 9'].sort(compareNames)).toEqual([
      'Alpha',
      'Scheibe 9',
      'Scheibe 25',
      'Scheibe 100',
    ])
  })

  it('orders events by distance, then name', () => {
    const events = [
      { distance: 100, name: 'B' },
      { distance: 25, name: 'Z' },
      { distance: 100, name: 'A' },
      { distance: 1000, name: 'A' },
    ]
    expect(events.sort(compareEvents).map((e) => `${e.distance} ${e.name}`)).toEqual([
      '25 Z',
      '100 A',
      '100 B',
      '1000 A',
    ])
  })

  it('orders disciplines by number, then name, and federations by abbreviation', () => {
    const d = [
      { number: '10.2', name: 'b' },
      { number: '2.1', name: 'z' },
      { number: '2.1', name: 'a' },
    ]
    expect(d.sort(compareDisciplines).map((x) => `${x.number} ${x.name}`)).toEqual([
      '2.1 a',
      '2.1 z',
      '10.2 b',
    ])
    expect([{ abbreviation: 'DSB' }, { abbreviation: 'BDS' }].sort(compareFederations)).toEqual([
      { abbreviation: 'BDS' },
      { abbreviation: 'DSB' },
    ])
  })
})

const federations = [
  { id: 'dsb', name: 'DSB', abbreviation: 'DSB' },
  { id: 'bds', name: 'BDS', abbreviation: 'BDS' },
] as FederationSummary[]
const disciplines = [
  { id: 'dsb-100', federation: 'dsb', name: 'Rifle', number: '100', distanceMm: 100000 },
  { id: 'dsb-25', federation: 'dsb', name: 'Rifle', number: '25', distanceMm: 25000 },
  { id: 'bds-1', federation: 'bds', name: 'Pistol', number: '1', distanceMm: 25000 },
] as DisciplineSummary[]
const mappings = [
  { id: 'm1', discipline: 'bds-1', face: 'bds-face', event: 'e' },
  { id: 'm2', discipline: 'dsb-25', face: 'dsb-face', event: 'e' },
] as MappingSummary[]
const data = { federations, disciplines, mappings }

describe('federation filter', () => {
  it('lists only the disciplines of the federation, numbers in numeric order', () => {
    expect(disciplineOptions([], data, 'dsb').map((o) => o.value)).toEqual(['dsb-25', 'dsb-100'])
    expect(disciplineOptions([], data).map((o) => o.value)).toEqual(['bds-1', 'dsb-25', 'dsb-100'])
  })

  it('keeps the faces the federation maps or publishes', () => {
    const faces = [
      { id: 'bds-face', organization: 'ISSF' },
      { id: 'dsb-face', organization: 'ISSF' },
      { id: 'own', organization: 'BDS' },
    ]
    expect([...federationFaceIds(faces, data, 'bds')].sort()).toEqual(['bds-face', 'own'])
  })
})
