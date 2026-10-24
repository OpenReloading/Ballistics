/**
 * The browser store of user records and target photos (IndexedDB); the workspace folder handle is
 * kept in the same database (`workspace-folder.ts`).
 */
import type { UserRecord } from '@openreloading/schema'
import { validRecords } from './user-data.ts'

const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

type Store = 'records' | 'handles' | 'files'

/**
 * The database version. 1: the first databases, whose stores were not checked on open. 2: every
 * store exists. A change of the stores adds a version and a step in `upgrade`.
 */
const version = 2

/** Brings a new or older database to `version`: adds the stores it lacks, touches no record. */
function upgrade(db: IDBDatabase) {
  for (const name of ['records', 'handles', 'files'] as const)
    if (!db.objectStoreNames.contains(name))
      db.createObjectStore(name, name === 'records' ? { keyPath: 'id' } : undefined)
}

let opened: Promise<IDBDatabase> | undefined
/** Opens the database at `version`, upgrading an older one in place. */
const database = () =>
  (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('openreloading-user-data', version)
    r.onupgradeneeded = () => upgrade(r.result)
    r.onsuccess = () => {
      // another tab deletes the database: close, the next call opens again
      r.result.onversionchange = () => {
        r.result.close()
        opened = undefined
      }
      resolve(r.result)
    }
    r.onerror = () => reject(r.error)
    // a failure, also a throw of `open` itself (no IndexedDB here), is not kept: the next call tries again
  }).catch((e) => {
    opened = undefined
    throw e
  }))

/** Runs `f` on one store; resolves once the transaction has committed. */
export async function inStore<T>(
  name: Store,
  mode: IDBTransactionMode,
  f: (s: IDBObjectStore) => IDBRequest<T> | undefined,
): Promise<T | undefined> {
  const tx = (await database()).transaction(name, mode)
  const r = f(tx.objectStore(name))
  const result = r && request(r)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error)
  })
  return result
}

/** The schema-valid records of the browser store and the invalid ones, as stored: none is dropped. */
export const storedRecords = async () =>
  validRecords((await inStore('records', 'readonly', (s) => s.getAll())) ?? [])

/** The stored record `id` as written, unvalidated; undefined when absent. */
export const storedRecord = (id: string) =>
  inStore('records', 'readonly', (s) => s.get(id)) as Promise<UserRecord | undefined>

export const putRecords = (records: UserRecord[]) =>
  inStore('records', 'readwrite', (s) => {
    for (const r of records) s.put(r)
    return
  })

/**
 * Whether a writer that last read or wrote the record saved at `base` may replace `stored`: it is
 * absent, or no other writer saved it since. Without `base` only an absent record fits.
 */
export const fits = (stored: { saved: string } | undefined, base: string | undefined) =>
  !stored || stored.saved === base

/** Puts `record` when the stored one `fits` `base`, read and written in one transaction; false when not. */
export async function putRecordIf(record: UserRecord, base: string | undefined) {
  const stored = await inStore('records', 'readwrite', (s) => {
    const r = s.get(record.id)
    r.addEventListener('success', () => {
      if (fits(r.result, base)) s.put(record)
    })
    return r
  })
  return fits(stored, base)
}

export const deleteRecords = (ids: string[]) =>
  inStore('records', 'readwrite', (s) => {
    for (const id of ids) s.delete(id)
    return
  })

export const deleteRecord = (id: string) => deleteRecords([id])

/** A user file (a target photo) kept in this browser under `id`; never sent anywhere. */
export const putPhoto = (id: string, file: Blob) =>
  inStore('files', 'readwrite', (s) => s.put(file, id))

export const storedPhoto = (id: string) =>
  inStore('files', 'readonly', (s) => s.get(id)) as Promise<Blob | undefined>

export const deletePhoto = (id: string) => inStore('files', 'readwrite', (s) => s.delete(id))

let persisted: Promise<boolean> | undefined
/**
 * Asks once per page load for persistent storage, so the browser does not evict the
 * records under storage pressure; true where the API is missing.
 */
export const requestPersistentStorage = () =>
  (persisted ??= (navigator.storage?.persist?.() ?? Promise.resolve(true)).catch(() => true))
