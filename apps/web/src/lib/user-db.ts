/**
 * The browser's IndexedDB of user records, target photos and the workspace folder handle: opening
 * and upgrading it and running a request on one store, without the schema, so a page that only
 * lists stored values stays small.
 */
import { storageName } from './edition.ts'

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

const databaseName = storageName('openreloading-user-data')

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
    const r = indexedDB.open(databaseName, version)
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
  // a failed request also fails the transaction, whose rejection below carries its error
  result?.catch(() => {})
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
  return result
}
