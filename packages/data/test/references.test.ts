import { describe, expect, it } from 'vitest'
import type { Bundle } from '../src/records.ts'
import {
  checkCartridgeReferences,
  checkLoadCapacityReferences,
  checkLoadCaseReferences,
  checkLoadComponentReferences,
  checkLoadPrimerReferences,
  checkLoadReferences,
  checkLoadSessionReferences,
  checkManufacturerReferences,
  recordIds,
} from '../src/references.ts'

/** A bundle of one cartridge, case, bullet, powder, primer, capacity and maker, with `parts`. */
const bundle = (parts: object = {}) =>
  ({
    cartridges: [{ id: 'c1' }, { id: 'c2' }],
    cases: [{ id: 'case-1', cartridge: 'catalogue:c1' }],
    bullets: [{ id: 'b1' }],
    powders: [{ id: 'p1' }],
    primers: [{ id: 'pr1' }],
    capacities: [{ id: 'cap1' }],
    manufacturers: [{ id: 'm1' }],
    chronoSessions: [],
    powdersOf: [],
    loads: [],
    renames: {},
    ...parts,
  }) as unknown as Bundle

const errorsOf = (check: (errors: string[]) => void) => {
  const errors: string[] = []
  check(errors)
  return errors
}

describe('recordIds', () => {
  it('holds the record ids and the old ids renames.json replaces, by kind', () => {
    const b = bundle({
      loads: [{ id: 'l1' }],
      renames: {
        cartridges: { 'old-c': 'c1' },
        cases: { 'old-case': 'case-1' },
        manufacturers: { 'old-m': 'm1' },
      },
    })
    expect(recordIds(b)).toEqual({
      cartridges: new Set(['c1', 'c2', 'old-c']),
      cases: new Set(['case-1', 'old-case']),
      loads: new Set(['l1']),
      manufacturers: new Set(['m1', 'old-m']),
    })
  })

  it('reads a bundle without renames', () => {
    const b = bundle({ renames: undefined })
    expect(recordIds(b).cartridges).toEqual(new Set(['c1', 'c2']))
  })
})

describe('checkCartridgeReferences', () => {
  it('names the unknown cartridge of a firing series, case, capacity and load as written', () => {
    const b = bundle({
      renames: { cartridges: { 'old-c1': 'c1' } },
      firings: [
        { id: 'f1', cartridge: 'c1' },
        { id: 'f2', cartridge: 'c9' },
      ],
      cases: [
        { id: 'case-1', cartridge: 'catalogue:old-c1' },
        { id: 'case-2', cartridge: 'catalogue:c9' },
      ],
      capacities: [
        { id: 'cap1', cartridge: 'catalogue:c2' },
        { id: 'cap2', cartridge: 'catalogue:c9' },
      ],
      loads: [
        { id: 'l1', cartridge: 'catalogue:c1' },
        { id: 'l2', cartridge: 'catalogue:c9' },
      ],
    })
    expect(errorsOf((e) => checkCartridgeReferences(b, recordIds(b), e))).toEqual([
      'firings/f2.json: unknown cartridge "c9"',
      'cases/case-2.json: unknown cartridge "catalogue:c9"',
      'capacities/cap2.json: unknown cartridge "catalogue:c9"',
      'loads/l2.json: unknown cartridge "catalogue:c9"',
    ])
  })

  it('names a listed cartridge of a powder that is unknown or an old id', () => {
    const b = bundle({
      renames: { cartridges: { 'old-c1': 'c1' } },
      firings: [],
      cases: [],
      capacities: [],
      loads: [],
      powders: [{ id: 'p1', listedCartridges: ['c1', 'old-c1', 'c9'] }, { id: 'p2' }],
    })
    expect(errorsOf((e) => checkCartridgeReferences(b, recordIds(b), e))).toEqual([
      'powders/p1.json: unknown listed cartridge "old-c1"',
      'powders/p1.json: unknown listed cartridge "c9"',
    ])
  })

  it('reads a cartridge given as a plain id', () => {
    const b = bundle({
      firings: [],
      cases: [{ id: 'case-1', cartridge: 'c1' }],
      capacities: [{ id: 'cap1', cartridge: 'c9' }],
      loads: [{ id: 'l1', cartridge: 'c2' }],
    })
    expect(errorsOf((e) => checkCartridgeReferences(b, recordIds(b), e))).toEqual([
      'capacities/cap1.json: unknown cartridge "c9"',
    ])
  })
})

describe('load references', () => {
  it('names a bullet or powder record that does not exist and accepts a described one', () => {
    const b = bundle({
      loads: [
        { id: 'l1', bullet: 'catalogue:b1', powder: 'catalogue:p9' },
        { id: 'l2', bullet: 'b9', powder: { name: 'described' } },
        { id: 'l3', bullet: 'catalogue:b1', powder: 'catalogue:p1' },
      ],
    })
    expect(errorsOf((e) => checkLoadComponentReferences(b, e))).toEqual([
      'loads/l1.json: unknown powder "catalogue:p9"',
      'loads/l2.json: unknown bullet "b9"',
    ])
  })

  it('accepts a primer by its current or its old id and names an unknown one', () => {
    const b = bundle({
      renames: { primers: { 'old-pr': 'pr1' } },
      loads: [
        { id: 'l1', primer: { record: 'catalogue:pr1' } },
        { id: 'l2', primer: { record: 'old-pr' } },
        { id: 'l3', primer: { record: 'catalogue:pr9' } },
        { id: 'l4', primer: {} },
      ],
    })
    expect(errorsOf((e) => checkLoadPrimerReferences(b, e))).toEqual([
      'loads/l3.json: unknown primer "catalogue:pr9"',
    ])
  })

  it('reads primers without renames and a load without a primer', () => {
    const b = bundle({
      renames: undefined,
      loads: [{ id: 'l1', primer: { record: 'pr1' } }, { id: 'l2' }],
    })
    expect(errorsOf((e) => checkLoadPrimerReferences(b, e))).toEqual([])
  })

  it('names a capacity that is no record', () => {
    const b = bundle({
      loads: [
        { id: 'l1', capacity: 'cap1' },
        { id: 'l2', capacity: 'cap9' },
        { id: 'l3', capacity: 'catalogue:cap1' },
        { id: 'l4' },
      ],
    })
    expect(errorsOf((e) => checkLoadCapacityReferences(b, e))).toEqual([
      'loads/l2.json: unknown capacity "cap9"',
    ])
  })

  it('names a case that is unknown or of another cartridge, through renames of either', () => {
    const b = bundle({
      renames: { cases: { 'old-case': 'case-1' }, cartridges: { 'old-c1': 'c1' } },
      loads: [
        { id: 'l1', cartridge: 'catalogue:old-c1', case: { record: 'catalogue:old-case' } },
        { id: 'l2', cartridge: 'catalogue:c2', case: { record: 'case-1' } },
        { id: 'l3', cartridge: 'catalogue:c1', case: { record: 'case-9' } },
        { id: 'l4', cartridge: 'catalogue:c1' },
      ],
    })
    expect(errorsOf((e) => checkLoadCaseReferences(b, recordIds(b), e))).toEqual([
      'loads/l2.json: case "case-1" is a case of another cartridge',
      'loads/l3.json: unknown case "case-9"',
    ])
  })

  it('compares the cartridge of the case with that of the load through renames and plain ids', () => {
    const b = bundle({
      renames: { cartridges: { 'old-c1': 'c1' } },
      cases: [
        { id: 'case-1', cartridge: 'old-c1' },
        { id: 'case-2', cartridge: 'catalogue:c2' },
      ],
      loads: [
        { id: 'l1', cartridge: 'c1', case: { record: 'case-1' } },
        { id: 'l2', cartridge: 'catalogue:c1', case: { record: 'catalogue:case-1' } },
        { id: 'l3', cartridge: 'c1', case: { record: 'case-2' } },
      ],
    })
    expect(errorsOf((e) => checkLoadCaseReferences(b, recordIds(b), e))).toEqual([
      'loads/l3.json: case "case-2" is a case of another cartridge',
    ])
  })

  it('reads cases without renames', () => {
    const b = bundle({
      renames: undefined,
      loads: [{ id: 'l1', cartridge: 'catalogue:c1', case: { record: 'case-1' } }],
    })
    expect(errorsOf((e) => checkLoadCaseReferences(b, recordIds(b), e))).toEqual([])
  })

  it('names a session that is no record and reads a load without sessions', () => {
    const b = bundle({
      chronoSessions: [{ id: 's1', strings: [] }],
      loads: [{ id: 'l1', sessions: ['catalogue:s1', 's1', 's9'] }, { id: 'l2' }],
    })
    expect(errorsOf((e) => checkLoadSessionReferences(b, e))).toEqual([
      'loads/l1.json: unknown session "s9"',
    ])
  })

  it('names the load of a shot string that is no record', () => {
    const b = bundle({
      loads: [{ id: 'l1' }],
      chronoSessions: [{ id: 's1', strings: [{ load: 'catalogue:l1' }, { load: 'l9' }] }],
    })
    expect(errorsOf((e) => checkLoadReferences(b, recordIds(b), e))).toEqual([
      'chrono/s1.json: unknown load "l9"',
    ])
  })
})

describe('checkManufacturerReferences', () => {
  it('reads the case maker of a capacity as a reference or a plain id', () => {
    const b = bundle({
      capacities: [
        { id: 'cap1', caseManufacturer: 'catalogue:m1' },
        { id: 'cap2', caseManufacturer: 'm9' },
        { id: 'cap3' },
      ],
    })
    expect(errorsOf((e) => checkManufacturerReferences(b, {}, recordIds(b), e))).toEqual([
      'capacities/cap2.json: unknown caseManufacturer "m9"',
    ])
  })

  it('names the unknown maker of every kind, by file and field', () => {
    const b = bundle({
      powders: [
        { id: 'p1', manufacturer: 'm1' },
        { id: 'p2', manufacturer: 'm2' },
      ],
      primers: [
        { id: 'pr1', manufacturer: 'm1' },
        { id: 'pr2', manufacturer: 'm3' },
      ],
      bullets: [
        { id: 'b1', manufacturer: 'm1' },
        { id: 'b2', manufacturer: 'm4' },
      ],
      cases: [
        { id: 'case-1', manufacturer: 'catalogue:m1' },
        { id: 'case-2', manufacturer: 'catalogue:m5' },
      ],
      capacities: [],
      chronoSessions: [
        { id: 's1', device: { manufacturer: 'catalogue:m1' } },
        { id: 's2', device: { manufacturer: 'catalogue:m6' } },
        { id: 's3', device: {} },
      ],
      loads: [
        {
          id: 'l1',
          bullet: { manufacturer: 'catalogue:m7' },
          powder: { manufacturer: 'catalogue:m8' },
          case: { manufacturer: 'catalogue:m9' },
        },
        {
          id: 'l2',
          bullet: { manufacturer: 'catalogue:m1' },
          powder: 'catalogue:p1',
          case: { record: 'case-1' },
        },
        { id: 'l3', bullet: 'catalogue:b1', powder: {} },
      ],
    })
    const tables = { 'a.pdf': { manufacturer: 'm1' }, 'b.pdf': { manufacturer: 'm10' } }
    expect(
      errorsOf((e) => checkManufacturerReferences(b, tables as never, recordIds(b), e)),
    ).toEqual([
      'powders/p2.json: unknown manufacturer "m2"',
      'primers/pr2.json: unknown manufacturer "m3"',
      'bullets/b2.json: unknown manufacturer "m4"',
      'cases/case-2.json: unknown manufacturer "m5"',
      'chrono/s2.json: unknown device.manufacturer "m6"',
      'loads/l1.json: unknown bullet.manufacturer "m7"',
      'loads/l1.json: unknown powder.manufacturer "m8"',
      'loads/l1.json: unknown case.manufacturer "m9"',
      'load-tables.json: b.pdf: unknown manufacturer "m10"',
    ])
  })
})
