import 'fake-indexeddb/auto'
import type { UserRecord } from '@open-reloading/schema'
import { beforeEach, expect, it } from 'vitest'
import { deleteRecord, putRecordIf, putRecords, storedRecord } from '../src/lib/user-store.ts'

const id = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b'
/** A record as the store holds it; only the id, name and `saved` matter here. */
const sheet = (name: string, saved: string) =>
  ({ kind: 'target', id, name, saved }) as never as UserRecord

const earlier = '2026-10-15T10:00:01.000Z'
const stored = '2026-10-15T10:00:02.000Z'
const later = '2026-10-15T10:00:03.000Z'

beforeEach(async () => {
  await deleteRecord(id)
})

it('puts a record that is absent, with or without a base', async () => {
  expect(await putRecordIf(sheet('new', later), undefined)).toBe(true)
  expect((await storedRecord(id))?.name).toBe('new')
  await deleteRecord(id)
  expect(await putRecordIf(sheet('again', later), earlier)).toBe(true)
  expect((await storedRecord(id))?.name).toBe('again')
})

it('replaces a record saved at the base the writer read', async () => {
  await putRecords([sheet('mine', stored)])
  expect(await putRecordIf(sheet('changed', later), stored)).toBe(true)
  expect(await storedRecord(id)).toMatchObject({ name: 'changed', saved: later })
})

it('leaves a record another writer saved since, and says so', async () => {
  await putRecords([sheet('theirs', stored)])
  expect(await putRecordIf(sheet('mine', later), earlier)).toBe(false)
  expect(await storedRecord(id)).toMatchObject({ name: 'theirs', saved: stored })
})

it('leaves a stored record a writer without a base would take', async () => {
  await putRecords([sheet('theirs', stored)])
  expect(await putRecordIf(sheet('new', later), undefined)).toBe(false)
  expect((await storedRecord(id))?.name).toBe('theirs')
})
