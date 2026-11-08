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
): DisciplineKey => ({ federation, number, name, distanceMm })
/** An ISSF discipline: without a number, by category. */
const issf = (
  name: string,
  distanceMm: number,
  category?: DisciplineKey['category'],
): DisciplineKey => ({ federation: 'issf', number: undefined, name, distanceMm, category })
const numbers = (items: DisciplineKey[]) => items.toSorted(compareDisciplines).map((x) => x.number)

describe('compareNames, compareFederations and compareEvents', () => {
  it('orders numbers numerically inside names', () => {
    expect(['Scheibe 100', 'Scheibe 25', 'Alpha'].toSorted(compareNames)).toEqual([
      'Alpha',
      'Scheibe 25',
      'Scheibe 100',
    ])
  })

  it('orders federations by abbreviation and events by distance, then name', () => {
    expect([{ abbreviation: 'DSB' }, { abbreviation: 'BDS' }].toSorted(compareFederations)).toEqual(
      [{ abbreviation: 'BDS' }, { abbreviation: 'DSB' }],
    )
    const events = [
      { distance: 100, name: 'B' },
      { distance: 25, name: 'Z' },
      { distance: 100, name: 'A' },
    ]
    expect(events.toSorted(compareEvents).map((e) => `${e.distance} ${e.name}`)).toEqual([
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

  it.each(['', '1\n'])('reads a long code of "!" followed by %j in linear time', (tail) => {
    const long = d('dsb', '!'.repeat(50000) + tail)
    expect(compareDisciplines(long, d('dsb', '1'))).toBeTypeOf('number')
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
})

describe('compareDisciplines with a prefix', () => {
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
      issf('50m Pistol', 50000, 'pistol'),
      issf('300m Rifle Prone', 300000, 'rifle'),
      issf('10m Air Rifle', 10000, 'air-rifle'),
      issf('50m Rifle Prone', 50000, 'rifle'),
      issf('25m Pistol', 25000, 'pistol'),
      issf('10m Air Pistol', 10000, 'air-pistol'),
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
})

describe('compareDisciplines numbered and unnumbered', () => {
  it('puts a federation first, numbered before unnumbered, then distance and name', () => {
    const sorted = [
      d('dsb', undefined, 'Gewehr 50 m'),
      d('bds', '2101', 'b', 50000),
      d('dsb', '1.10'),
      d('bds', '2101', 'a', 50000),
      d('bds', '2101', 'z', 25000),
    ].toSorted(compareDisciplines)
    expect(sorted.map((x) => `${x.federation} ${x.number ?? '-'} ${x.name}`)).toEqual([
      'bds 2101 z',
      'bds 2101 a',
      'bds 2101 b',
      'dsb 1.10 x',
      'dsb - Gewehr 50 m',
    ])
  })

  it('puts an unnumbered discipline without a category after those with one', () => {
    const sorted = [
      issf('Running Target', 10000),
      issf('50m Rifle Prone', 50000, 'rifle'),
    ].toSorted(compareDisciplines)
    expect(sorted.map((x) => x.name)).toEqual(['50m Rifle Prone', 'Running Target'])
  })
})

const faceOf = (federation: string, name: string) => ({ federation, name })

describe('compareTargetFaces', () => {
  it('BDS by the printed code, then name; DSB and ISSF by name with numbers numeric', () => {
    expect(
      [
        faceOf('BDS', 'BDS-PG-Scheibe (Z18)'),
        faceOf('BDS', 'BDS-300m-ZF-Scheibe (Z8)'),
        faceOf('BDS', 'BDS-50m-ZF-Scheibe (Z2)'),
        faceOf('DSB', 'Scheibe Nr. 10'),
        faceOf('DSB', 'Scheibe Nr. 2'),
        faceOf('ISSF', '300m Rifle Target'),
        faceOf('ISSF', '50m Rifle Target'),
        faceOf('BDS', 'BDS ohne Code'),
      ]
        .toSorted(compareTargetFaces)
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

  it('puts a face without a federation first and orders faces without a code by name', () => {
    const faces = [{ name: 'b' }, { federation: 'BDS', name: 'a' }, { name: 'a' }]
    expect(faces.toSorted(compareTargetFaces)).toEqual([
      { name: 'a' },
      { name: 'b' },
      { federation: 'BDS', name: 'a' },
    ])
    expect(compareTargetFaces({ name: 'x' }, { name: 'x' })).toBe(0)
  })
})

describe('compareTargetFaces per federation', () => {
  it.each([
    ['BDMP', ['BDMP-Scheibe Nr. 1', 'BDMP-Scheibe Nr. 3', 'BDMP-Scheibe Nr. 10']],
    ['BDS', ['BDS-50m-ZF-Scheibe (Z2)', 'BDS-300m-ZF-Scheibe (Z8)', 'BDS-PG-Scheibe (Z18)']],
    ['DSB', ['Scheibe Nr. 2 (15 m Gewehr)', 'Scheibe Nr. 6 (Muskete 50 m)', 'Scheibe Nr. 10']],
    ['DSU', ['DSU-Scheibe 25 Meter', 'DSU-Scheibe 200 Meter Präzision']],
    ['ISSF', ['10m Air Rifle Target', '50m Rifle Target', '300m Rifle Target']],
    ['VdRBw', ['Scheibe Bundeswehr Nr. 2', 'Scheibe Bundeswehr Nr. 2 klein']],
  ])('%s', (federation, names) => {
    const faces = names.map((name) => ({ federation, name }))
    expect(faces.toReversed().toSorted(compareTargetFaces)).toEqual(faces)
  })
})

describe('compareMappings per federation', () => {
  it.each([
    ['bdmp', ['SG 2', 'SG 10']],
    ['bds', ['2101', '4110', '73xx']],
    ['dsb', ['1.9', '1.10', '2.53/2.59/2.55']],
    ['dsu', ['LDG 2', 'LDG 10']],
    ['issf', [undefined]],
    ['vdrbw', ['G-H 6', 'G-H 10']],
  ])('%s: by discipline, then face, then id', (federation, codes) => {
    const m = (id: string, face: string, number: string | undefined) => ({
      id,
      face,
      discipline: d(federation, number),
    })
    const first = codes.map((c, i) => m(`a${i}`, 'f1', c))
    const expected = [...first, m('b', 'f2', codes.at(-1)), m('c', 'f2', codes.at(-1))]
    expect(expected.toReversed().toSorted(compareMappings)).toEqual(expected)
  })
})
