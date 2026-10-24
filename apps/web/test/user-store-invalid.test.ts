import 'fake-indexeddb/auto'
import type { UserRecord } from '@openreloading/schema'
import { expect, it } from 'vitest'
import { parseFiles } from '../src/lib/load-file-formats.ts'
import { exportAllText, validRecords } from '../src/lib/user-data.ts'
import {
  deleteRecord,
  putInvalid,
  putRecords,
  storedPhotoIds,
  storedRecords,
} from '../src/lib/user-store.ts'

const saved = '2026-10-13T10:00:00.000Z'
const valid: UserRecord = {
  kind: 'bulletDesign',
  id: 'b1',
  name: 'Valid design',
  saved,
  data: {
    manufacturerName: 'Example',
    name: '168 gr',
    choices: { 'base.type': 'boat-tail', 'ogive.form': 'tangent', 'tip.type': '' },
    siValues: { diameter: 7.82e-3, mass: 0.0108862 },
  },
}
const bad = { kind: 'bulletDesign', id: 'old-1', name: 'Old design', saved, data: 'not an object' }
const badSheet = {
  kind: 'targetSheet',
  id: 'old-2',
  name: 'Old sheet',
  saved,
  data: { photo: 'p1' },
}

it('an Export all file round trips its invalid records as invalid records', async () => {
  const { invalid } = validRecords([bad, badSheet])
  const exported = exportAllText([valid], [], invalid)
  if (!exported.ok) throw new Error(exported.reason)
  const read = parseFiles([{ name: 'all.json', text: exported.text }])
  expect(read.records).toEqual([valid])
  expect(read.invalid).toEqual([bad, badSheet])

  expect(await putInvalid(read.invalid)).toEqual({ added: 2, kept: 0, unstorable: 0 })
  const stored = await storedRecords()
  expect(stored.invalid.map((i) => i.raw)).toEqual([bad, badSheet])
  expect(stored.records).toEqual([])
  // an invalid sheet keeps its photo
  expect(await storedPhotoIds()).toEqual(new Set(['p1']))
})

it('an imported invalid record never overwrites a stored record with its id', async () => {
  await putRecords([valid])
  const asInvalid = { ...valid, data: 'not an object' }
  const other = { ...bad, name: 'Changed' }
  expect(await putInvalid([asInvalid, other, { name: 'no id' }, null])).toEqual({
    added: 0,
    kept: 2,
    unstorable: 2,
  })
  const stored = await storedRecords()
  expect(stored.records).toEqual([valid])
  // the invalid record of the same id stays as it was too
  expect(stored.invalid.map((i) => i.raw)).toEqual([bad, badSheet])
})

it('deletes an invalid record by its id', async () => {
  await deleteRecord('old-1')
  expect((await storedRecords()).invalid.map((i) => i.id)).toEqual(['old-2'])
})
