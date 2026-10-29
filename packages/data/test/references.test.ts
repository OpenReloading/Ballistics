import { describe, expect, it } from 'vitest'
import type { Bundle } from '../src/records.ts'
import {
  checkLoadCapacityReferences,
  checkLoadCaseReferences,
  checkLoadComponentReferences,
  checkLoadPrimerReferences,
  checkLoadReferences,
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

/** The errors of `check` over `b`. */
const errorsOf = (check: (errors: string[]) => void) => {
  const errors: string[] = []
  check(errors)
  return errors
}

describe('load references', () => {
  it('names a bullet or powder record that does not exist and accepts a described one', () => {
    const b = bundle({
      loads: [
        { id: 'l1', bullet: 'catalogue:b1', powder: 'catalogue:p9' },
        { id: 'l2', bullet: 'b9', powder: { name: 'described' } },
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

  it('names a capacity that is no record', () => {
    const b = bundle({
      loads: [
        { id: 'l1', capacity: 'cap1' },
        { id: 'l2', capacity: 'cap9' },
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
})
