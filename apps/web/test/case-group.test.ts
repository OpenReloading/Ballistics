import { english } from '../src/i18n/translate.ts'
import 'fake-indexeddb/auto'
import {
  type Case,
  checkUserRefs,
  load as loadSchema,
  type UserRecord,
  userRecord,
} from '@open-reloading/schema'
import { expect, it } from 'vitest'
import {
  blankCaseGroup,
  caseGroupProblem,
  groupCapacity,
  ownCases,
  withCapacity,
} from '../src/lib/case-group.ts'
import {
  capacityRecord,
  measuredCapacityId,
  measuredCapacityRef,
  toLoad,
} from '../src/lib/load-record.ts'
import { waterVolume } from '../src/lib/units.ts'
import { exportAllText, parseUserDataFile, planImport } from '../src/lib/user-data.ts'
import { putRecords, storedRecords } from '../src/lib/user-store.ts'

const cartridge = 'catalogue:308-win'
const caseId = '5d6e7f80-1a2b-4c3d-8e4f-5a6b7c8d9e0f'
const saved = '2026-10-26T10:00:00.000Z'
const m3 = waterVolume(3.62)
const group: Case = {
  ...blankCaseGroup(),
  name: 'Match brass, lot 3',
  cartridge,
  numberOfFirings: 3,
  trimLength: { value: 51.1 },
  neckWall: { value: 0.35 },
  casesMeasured: 10,
  spread: { value: 0.04 },
}
const caseRecord = (data: Case): UserRecord =>
  userRecord.parse({ kind: 'case', id: caseId, name: data.name, saved, data })

it('asks for a name and a cartridge, then names the field the schema refuses', () => {
  expect(caseGroupProblem('', group, english.t)).toBe('Enter a name.')
  expect(caseGroupProblem('x', { ...group, cartridge: '' }, english.t)).toBe(
    'Choose the cartridge.',
  )
  expect(caseGroupProblem('x', group, english.t)).toBeUndefined()
  expect(caseGroupProblem('x', { ...group, casesMeasured: 0 }, english.t)).toBe(
    'Cases measured: not valid.',
  )
  expect(caseGroupProblem('x', { ...group, neckWall: { value: -1 } }, english.t)).toBe(
    'Neck wall: not valid.',
  )
})

it('names the capacity record of the workbench for the same cartridge and value, so a capacity is stored once', () => {
  const c = withCapacity(group, m3)
  expect(c.capacity).toBe(measuredCapacityRef(cartridge, m3))
  expect(capacityRecord(cartridge, m3, new Date(saved)).id).toBe(measuredCapacityId(cartridge, m3))
  // no value: the group keeps the reference it has; no cartridge: it names none
  expect(withCapacity({ ...group, capacity: c.capacity }, undefined).capacity).toBe(c.capacity)
  expect(withCapacity(group, undefined).capacity).toBeUndefined()
  expect(withCapacity({ ...group, cartridge: '' }, m3).capacity).toBeUndefined()
})

it('reads the measured capacity through the record the group names', () => {
  const capacity = capacityRecord(cartridge, m3, new Date(saved))
  const c = withCapacity(group, m3)
  expect(groupCapacity(c, [capacity])).toBe(3.62)
  expect(groupCapacity(c, [])).toBeUndefined()
  expect(groupCapacity(group, [capacity])).toBeUndefined()
  expect(ownCases([capacity, caseRecord(c)])).toEqual([
    {
      id: caseId,
      name: 'Match brass, lot 3',
      cartridge,
      capacity: c.capacity,
      grams: 3.62,
      trimLength: 51.1,
    },
  ])
})

it('is picked by a saved load as case.record, and a missing group is a dangling reference', () => {
  const l = toLoad({
    values: {},
    given: new Set(),
    notes: '',
    sessions: [],
    cartridge,
    caseRecord: `user:${caseId}`,
  })
  expect(l.case).toEqual({ record: `user:${caseId}` })
  expect(loadSchema.safeParse(l).success).toBe(true)
  const record = userRecord.parse({ kind: 'load', id: 'w1', name: 'Load', saved, data: l })
  expect(checkUserRefs([record]).map((d) => d.field)).toEqual(['case.record'])
  expect(checkUserRefs([record, caseRecord(group)])).toEqual([])
})

it('stays in the browser store and goes through an export and an import with its capacity', async () => {
  const capacity = capacityRecord(cartridge, m3, new Date(saved))
  const own = caseRecord(withCapacity(group, m3))
  await putRecords([capacity, own])
  const { records } = await storedRecords()
  expect(records.filter((r) => r.kind === 'case')).toEqual([own])
  const text = exportAllText(records)
  if (!text.ok) throw new Error(text.reason)
  const file = parseUserDataFile(text.text)
  if (!file.ok) throw new Error('not read')
  expect(file.records).toEqual(records)
  // opened in an empty browser the same two records are new
  expect(planImport(file.records, []).added).toHaveLength(2)
  expect(planImport(file.records, records).equal).toHaveLength(2)
  expect(checkUserRefs(file.records)).toEqual([])
})
