import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import {
  putPhoto,
  putRecords,
  storedPhoto,
  storedPhotoIds,
  storedRecords,
} from '../src/lib/user-store.ts'

const name = 'openreloading-user-data'
const saved = '2026-10-13T10:00:00.000Z'
const load = {
  kind: 'load',
  id: 'w1',
  name: '308 Win.',
  saved,
  data: { origin: 'user', charge: { value: 2.8 }, cartridge: 'catalogue:308-win' },
}
const old = { kind: 'bulletDesign', id: 'o1', name: 'Old', saved, data: 'not an object' }

const open = (version?: number, upgrade?: (db: IDBDatabase) => void) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(name, version)
    if (upgrade) r.onupgradeneeded = () => upgrade(r.result)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

it('opens a version 1 database without the later stores and keeps its records', async () => {
  const v1 = await open(1, (db) => {
    db.createObjectStore('records', { keyPath: 'id' })
  })
  await new Promise<void>((resolve) => {
    const tx = v1.transaction('records', 'readwrite')
    tx.objectStore('records').put(load)
    tx.objectStore('records').put(old)
    tx.oncomplete = () => resolve()
  })
  v1.close()

  const { records, invalid } = await storedRecords()
  expect(records).toEqual([load])
  expect(invalid.map((i) => i.raw)).toEqual([old])

  // the stores the old database lacked are there now
  await putPhoto('p1', new Blob(['photo']))
  expect(await storedPhoto('p1')).toBeDefined()
  await putRecords([{ ...load, id: 'w2' } as never])
  expect((await storedRecords()).records.map((r) => r.id)).toEqual(['w1', 'w2'])

  const db = await open()
  expect(db.version).toBe(2)
  expect([...db.objectStoreNames].sort()).toEqual(['files', 'handles', 'records'])
  db.close()
})

it('counts the photo of an invalid target sheet as used', async () => {
  const sheet = {
    kind: 'targetSheet',
    id: 's1',
    name: 'Sheet',
    saved,
    data: { photo: 'p-invalid' },
  }
  await putRecords([sheet as never])
  expect((await storedRecords()).invalid.map((i) => i.id)).toContain('s1')
  expect([...(await storedPhotoIds())]).toContain('p-invalid')
})
