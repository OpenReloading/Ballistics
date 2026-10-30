import 'fake-indexeddb/auto'
import type { UserRecord } from '@open-reloading/schema'
import { beforeEach, expect, it, vi } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { type ImportReport, importTexts } from '../src/lib/data-files.ts'
import { type ImportReply, importWorker } from '../src/lib/import-entry.ts'
import { parseFiles } from '../src/lib/load-file-formats.ts'
import { exportAllText, userDataText, validRecords } from '../src/lib/user-data.ts'
import {
  deleteRecord,
  putInvalid,
  putRecords,
  storedPhotoIds,
  storedRecords,
} from '../src/lib/user-store.ts'
import { defined } from './defined.ts'
import { deleteUserDb } from './user-db-reset.ts'

beforeEach(deleteUserDb)

const saved = '2026-10-13T10:00:00.000Z'
const valid: UserRecord = {
  kind: 'bullet',
  id: '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  name: 'Valid design',
  saved,
  data: {
    origin: 'user',
    manufacturer: 'catalogue:example-a',
    overrides: {
      name: '168 gr',
      diameter: { value: 7.82 },
      mass: { value: 10.8862 },
      base: { type: 'boat-tail' },
      ogive: { form: 'tangent' },
    },
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
  const read = await parseFiles(
    [{ name: 'all.json', bytes: new TextEncoder().encode(exported.text) }],
    undefined,
    english.t,
  )
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
  await putInvalid([bad, badSheet])
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
  await putInvalid([bad, badSheet])
  await deleteRecord('old-1')
  expect((await storedRecords()).invalid.map((i) => i.id)).toEqual(['old-2'])
})

/** The store holding `valid`'s id as an invalid record. */
async function invalidOfValid() {
  const asInvalid = { ...valid, name: 'My old bullet', data: 'not an object' }
  await putInvalid([asInvalid])
  return asInvalid
}

const storedRaw = async () => {
  const { records, invalid } = await storedRecords()
  return { records, invalid: invalid.map((i) => i.raw) }
}

it('a data file import leaves a valid record out where an invalid record has its id', async () => {
  const asInvalid = await invalidOfValid()
  const bytes = new TextEncoder().encode(userDataText([valid]))
  const show = vi.fn<(report: ImportReport) => void>()
  await importTexts(
    [{ name: 'data.json', read: async () => bytes }],
    { noteStorage: () => {}, fail: () => {}, show, refs: async () => '' },
    english,
  )
  const report = defined(show.mock.calls[0]?.[0])
  expect(report.added).toBe(0)
  expect(report.conflicts).toEqual([])
  expect(report.said(english).held).toBe(
    '1 record not imported because an invalid browser record has its id: Valid design. Download it raw and delete it under Open, Invalid records, then import again.',
  )
  expect(await storedRaw()).toEqual({ records: [], invalid: [asInvalid] })
})

it('the Import entry leaves a valid record out where an invalid record has its id, Replace too', async () => {
  const asInvalid = await invalidOfValid()
  const replies: ImportReply[] = []
  const handle = importWorker({ records: storedRecords, put: putRecords }, (r) => replies.push(r))
  const bytes = new TextEncoder().encode(userDataText([valid])).buffer as ArrayBuffer
  await handle({ type: 'read', id: 1, bytes })
  expect(replies.pop()).toMatchObject({ build: { added: 0, changed: 0, blocked: 1 } })
  const imported = { source: 'Test', file: 'data.json', day: '2026-10-30' }
  await handle({ type: 'commit', id: 1, imported, replace: true })
  expect(replies.pop()).toMatchObject({ type: 'committed', written: 0, build: { blocked: 1 } })
  expect(await storedRaw()).toEqual({ records: [], invalid: [asInvalid] })
})
