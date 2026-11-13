import 'fake-indexeddb/auto'
import { beforeEach, expect, it, vi } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { type ImportReport, importTexts } from '../src/lib/data-files.ts'
import { type ImportReply, importWorker } from '../src/lib/import-entry.ts'
import { userDataText } from '../src/lib/user-data.ts'
import { putInvalid, putRecords, storedRecords } from '../src/platform/user-store.ts'
import { defined } from './defined.ts'
import { deleteUserDb } from './user-db-reset.ts'
import { valid } from './user-store-contract/invalid-records.ts'

beforeEach(deleteUserDb)

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
