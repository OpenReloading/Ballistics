import 'fake-indexeddb/auto'
import type { UserRecord } from '@open-reloading/schema'
import { beforeEach, expect, it } from 'vitest'
import {
  deletePhoto,
  deleteRecord,
  deleteRecords,
  putInvalid,
  putPhoto,
  putRecordIf,
  putRecords,
  storedPhoto,
  storedPhotoIds,
  storedRecord,
  storePhotos,
  updateRecord,
} from '../src/lib/user-store.ts'

const id = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b'
/** A record as the store holds it; only the id, name and `saved` matter here. */
const sheet = (name: string, saved: string) =>
  ({ kind: 'target', id, name, saved }) as never as UserRecord

const earlier = '2026-10-15T10:00:01.000Z'
const stored = '2026-10-15T10:00:02.000Z'
const later = '2026-10-15T10:00:03.000Z'

const other = '6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c'
const third = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d'

beforeEach(async () => {
  await deleteRecords([id, other, third])
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

it('stores invalid entries by text id where the id is free, and counts each outcome', async () => {
  await putRecords([sheet('valid', stored)])
  const n = await putInvalid([
    { id: other, kind: 'target' },
    { id: third },
    { id },
    { id: 5 },
    null,
  ])
  expect(n).toEqual({ added: 2, kept: 1, unstorable: 2 })
  expect(await storedRecord(other)).toEqual({ id: other, kind: 'target' })
  expect(await storedRecord(id)).toMatchObject({ name: 'valid', saved: stored })
})

it('lists the text photo id of an invalid stored sheet', async () => {
  await putInvalid([
    { id, data: { photo: 'ph1' } },
    { id: other, data: { photo: 5 } },
  ])
  expect([...(await storedPhotoIds())]).toEqual(['ph1'])
})

it('writes what the change makes of the stored record, and leaves it when the change gives nothing', async () => {
  await putRecords([sheet('mine', stored)])
  const seen: unknown[] = []
  const written = await updateRecord(id, (r) => {
    seen.push(r)
    return sheet('changed', later)
  })
  expect(seen).toEqual([sheet('mine', stored)])
  expect(written).toEqual(sheet('changed', later))
  expect(await storedRecord(id)).toEqual(sheet('changed', later))
  expect(await updateRecord(id, () => undefined)).toBeUndefined()
  expect(await storedRecord(id)).toEqual(sheet('changed', later))
})

it('keeps, reads and deletes a photo, and stores only the photos the records point at', async () => {
  await putPhoto('ph0', new Blob(['abc'], { type: 'image/png' }))
  expect(await (await storedPhoto('ph0'))?.text()).toBe('abc')
  await deletePhoto('ph0')
  expect(await storedPhoto('ph0')).toBeUndefined()
  const file = (photo: string) => ({ id: photo, type: 'image/png' as const, data: btoa(photo) })
  await storePhotos([file('ph1'), file('ph2')], [
    { kind: 'targetSheet', id, data: { photo: 'ph1' } },
  ] as never)
  expect(await (await storedPhoto('ph1'))?.text()).toBe('ph1')
  expect(await storedPhoto('ph2')).toBeUndefined()
  await deletePhoto('ph1')
})
