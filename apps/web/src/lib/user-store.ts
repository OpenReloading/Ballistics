/**
 * The browser store of user records and target photos (IndexedDB); the workspace folder handle is
 * kept in the same database (`workspace-folder.ts`).
 */
import type { UserRecord } from '@open-reloading/schema'
import { pagesPreview } from './edition.ts'
import { validRecords } from './user-data.ts'
import { photoIds } from './user-photos.ts'

const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'))
  })

type Store = 'records' | 'handles' | 'files'

/**
 * The database version. 1: the first databases, whose stores were not checked on open. 2: every
 * store exists. A change of the stores adds a version and a step in `upgrade`.
 */
const version = 2

/**
 * The database's name. The development preview shares the browser's origin with the released site:
 * a database of its own keeps a newer version or format of the preview away from the released site.
 */
export const databaseName = (preview = pagesPreview) =>
  preview ? 'openreloading-user-data-preview' : 'openreloading-user-data'

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
    const r = indexedDB.open(databaseName(), version)
    r.onupgradeneeded = () => upgrade(r.result)
    r.onsuccess = () => {
      // another tab deletes the database: close, the next call opens again
      r.result.onversionchange = () => {
        r.result.close()
        opened = undefined
      }
      resolve(r.result)
    }
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'))
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
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
  return result
}

/** The schema-valid records of the browser store and the invalid ones, as stored: none is dropped. */
export const storedRecords = async () =>
  validRecords((await inStore('records', 'readonly', (s) => s.getAll())) ?? [])

/** The photo id a stored value points at as a target sheet, whether or not it passes the schema. */
export const rawPhotoId = (raw: unknown) => {
  const photo = (raw as { data?: { photo?: unknown | undefined } } | null)?.data?.photo
  return typeof photo === 'string' ? photo : undefined
}

/**
 * Ids of the photos a stored target sheet points at, an invalid sheet's too: its photo stays
 * with it.
 */
export async function storedPhotoIds() {
  const { records, invalid } = await storedRecords()
  const raw = invalid.flatMap((i) => rawPhotoId(i.raw) ?? [])
  return new Set([...photoIds(records), ...raw])
}

/**
 * Stores the `invalid` entries of an Export all file as they are, each only where no stored
 * record has its id, so a valid record is never overwritten. Counts the entries stored (`added`),
 * left out for an id already in the store (`kept`) and without a text id, which no record has
 * (`unstorable`).
 */
export async function putInvalid(raw: unknown[]) {
  const n = { added: 0, kept: 0, unstorable: 0 }
  for (const r of raw) {
    if (typeof (r as { id?: unknown } | null)?.id !== 'string') n.unstorable++
    else if (await putRecordIfAbsent(r as UserRecord)) n.added++
    else n.kept++
  }
  return n
}

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

/**
 * Puts `record` unless the store holds a record, valid or not, with its id, read and written in
 * one transaction; false when it was left out.
 */
export async function putRecordIfAbsent(record: UserRecord) {
  const stored = await inStore('records', 'readwrite', (s) => {
    const r = s.get(record.id)
    r.addEventListener('success', () => {
      if (!r.result) s.put(record)
    })
    return r
  })
  return !stored
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
