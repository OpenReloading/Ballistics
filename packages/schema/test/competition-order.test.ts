import { describe, expect, it } from 'vitest'
import {
  compareDisciplines,
  compareEvents,
  compareFederations,
  compareMappings,
  compareNames,
  compareTargetFaces,
  type DisciplineKey,
} from '../src/index.ts'

const d = (
  federation: string,
  number: string | undefined,
  name = 'x',
  distanceMm = 25000,
  category?: DisciplineKey['category'],
): DisciplineKey => ({ federation, number, name, distanceMm, category })
const numbers = (items: DisciplineKey[]) => items.toSorted(compareDisciplines).map((x) => x.number)

describe('compareNames, compareFederations and compareEvents', () => {
  it('orders numbers numerically inside names', () => {
    expect(['Scheibe 100', 'Scheibe 25', 'Alpha'].sort(compareNames)).toEqual([
      'Alpha',
      'Scheibe 25',
      'Scheibe 100',
    ])
  })

  it('orders federations by abbreviation and events by distance, then name', () => {
    expect([{ abbreviation: 'DSB' }, { abbreviation: 'BDS' }].sort(compareFederations)).toEqual([
      { abbreviation: 'BDS' },
      { abbreviation: 'DSB' },
    ])
    const events = [
      { distance: 100, name: 'B' },
      { distance: 25, name: 'Z' },
      { distance: 100, name: 'A' },
    ]
    expect(events.sort(compareEvents).map((e) => `${e.distance} ${e.name}`)).toEqual([
      '25 Z',
      '100 A',
      '100 B',
    ])
  })
})

describe('compareDisciplines', () => {
  it('BDS: codes of 4 digits by value, group codes padded, one multi-code entry by its first code', () => {
    expect(
      numbers([
        d('bds', '73xx'),
        d('bds', '4110'),
        d('bds', '2101'),
        d('bds', '10xx'),
        d('bds', '2101/2102'),
        d('bds', '3101'),
      ]),
    ).toEqual(['10xx', '2101', '2101/2102', '3101', '4110', '73xx'])
  })

  it('DSB: dotted section and item by segment, several codes by the first', () => {
    expect(
      numbers([
        d('dsb', '7.10'),
        d('dsb', '1.37/1.51/1.54'),
        d('dsb', '1.9'),
        d('dsb', '1.10'),
        d('dsb', '2.53/2.59'),
        d('dsb', '2.20'),
      ]),
    ).toEqual(['1.9', '1.10', '1.37/1.51/1.54', '2.20', '2.53/2.59', '7.10'])
  })

  it.each(['dsu', 'bdmp', 'vdrbw'])('%s: prefix, then number', (federation) => {
    expect(
      numbers([
        d(federation, 'SG 10'),
        d(federation, 'SPPDG 1'),
        d(federation, 'SG 2'),
        d(federation, 'SP3'),
        d(federation, 'SG 1'),
        d(federation, 'SP 1/SP 2'),
      ]),
    ).toEqual(['SG 1', 'SG 2', 'SG 10', 'SP 1/SP 2', 'SP3', 'SPPDG 1'])
  })

  it('VdRBw: a code with a dot or a tail keeps its prefix', () => {
    expect(
      numbers([
        d('vdrbw', 'G-H 6'),
        d('vdrbw', 'G-EK 1'),
        d('vdrbw', 'G-.30 M1'),
        d('vdrbw', 'G-H 10'),
      ]),
    ).toEqual(['G-.30 M1', 'G-EK 1', 'G-H 6', 'G-H 10'])
  })

  it('ISSF: without a number by category, distance, then name', () => {
    const names = [
      d('issf', undefined, '50m Pistol', 50000, 'pistol'),
      d('issf', undefined, '300m Rifle Prone', 300000, 'rifle'),
      d('issf', undefined, '10m Air Rifle', 10000, 'air-rifle'),
      d('issf', undefined, '50m Rifle Prone', 50000, 'rifle'),
      d('issf', undefined, '25m Pistol', 25000, 'pistol'),
      d('issf', undefined, '10m Air Pistol', 10000, 'air-pistol'),
    ]
    expect(names.toSorted(compareDisciplines).map((x) => x.name)).toEqual([
      '10m Air Rifle',
      '10m Air Pistol',
      '50m Rifle Prone',
      '300m Rifle Prone',
      '25m Pistol',
      '50m Pistol',
    ])
  })

  it('puts a federation first, numbered before unnumbered, then distance and name', () => {
    const sorted = [
      d('dsb', undefined, 'Gewehr 50 m'),
      d('bds', '2101', 'b', 50000),
      d('dsb', '1.10'),
      d('bds', '2101', 'a', 50000),
      d('bds', '2101', 'z', 25000),
    ].sort(compareDisciplines)
    expect(sorted.map((x) => `${x.federation} ${x.number ?? '-'} ${x.name}`)).toEqual([
      'bds 2101 z',
      'bds 2101 a',
      'bds 2101 b',
      'dsb 1.10 x',
      'dsb - Gewehr 50 m',
    ])
  })
})

describe('compareTargetFaces', () => {
  const face = (organization: string, name: string) => ({ organization, name })
  it('BDS by the printed code, then name; DSB and ISSF by name with numbers numeric', () => {
    expect(
      [
        face('BDS', 'BDS-PG-Scheibe (Z18)'),
        face('BDS', 'BDS-300m-ZF-Scheibe (Z8)'),
        face('BDS', 'BDS-50m-ZF-Scheibe (Z2)'),
        face('DSB', 'Scheibe Nr. 10'),
        face('DSB', 'Scheibe Nr. 2'),
        face('ISSF', '300m Rifle Target'),
        face('ISSF', '50m Rifle Target'),
        face('BDS', 'BDS ohne Code'),
      ]
        .sort(compareTargetFaces)
        .map((f) => f.name),
    ).toEqual([
      'BDS-50m-ZF-Scheibe (Z2)',
      'BDS-300m-ZF-Scheibe (Z8)',
      'BDS-PG-Scheibe (Z18)',
      'BDS ohne Code',
      'Scheibe Nr. 2',
      'Scheibe Nr. 10',
      '50m Rifle Target',
      '300m Rifle Target',
    ])
  })
})

describe('compareMappings', () => {
  it('follows the discipline order, then face id, then id', () => {
    const m = (id: string, face: string, number: string) => ({
      id,
      face,
      discipline: d('bds', number),
    })
    expect(
      [m('c', 'f1', '4110'), m('b', 'f2', '2101'), m('a', 'f1', '2101'), m('d', 'f1', '73xx')]
        .sort(compareMappings)
        .map((x) => x.id),
    ).toEqual(['a', 'b', 'c', 'd'])
  })
})
