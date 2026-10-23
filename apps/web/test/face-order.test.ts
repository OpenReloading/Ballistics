import { describe, expect, it } from 'vitest'
import type {
  DisciplineSummary,
  FederationSummary,
  MappingSummary,
} from '../src/lib/face-disciplines.ts'
import { disciplineOptions } from '../src/lib/face-disciplines.ts'
import { federationFaceIds } from '../src/lib/face-order.ts'

const federations = [
  { id: 'dsb', name: 'DSB', abbreviation: 'DSB' },
  { id: 'bds', name: 'BDS', abbreviation: 'BDS' },
] as FederationSummary[]
const disciplines = [
  { id: 'dsb-100', federation: 'dsb', name: 'Rifle', number: '100', distanceMm: 100000 },
  { id: 'dsb-25', federation: 'dsb', name: 'Rifle', number: '25', distanceMm: 25000 },
  { id: 'bds-1', federation: 'bds', name: 'Pistol', number: '1', distanceMm: 25000 },
  { id: 'bds-73', federation: 'bds', name: 'Group', number: '73xx', distanceMm: 25000 },
  { id: 'bds-4110', federation: 'bds', name: 'Rifle', number: '4110', distanceMm: 25000 },
] as DisciplineSummary[]
const mappings = [
  { id: 'm1', discipline: 'bds-1', face: 'bds-face', event: 'e' },
  { id: 'm2', discipline: 'dsb-25', face: 'dsb-face', event: 'e' },
] as MappingSummary[]
const data = { federations, disciplines, mappings }

describe('federation filter', () => {
  it('lists only the disciplines of the federation, numbers in numeric order', () => {
    expect(disciplineOptions([], data, 'dsb').map((o) => o.value)).toEqual(['dsb-25', 'dsb-100'])
    expect(disciplineOptions([], data).map((o) => o.value)).toEqual([
      'bds-1',
      'bds-4110',
      'bds-73',
      'dsb-25',
      'dsb-100',
    ])
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
