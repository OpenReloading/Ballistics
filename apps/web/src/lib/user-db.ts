/**
 * The browser's IndexedDB of user records, target photos and the workspace folder handle: opening
 * and deleting it and running a request on one store, without the schema, so a page that only
 * lists stored values stays small.
 */
import { storageName } from './edition.ts'

const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'))
  })

type Store = 'records' | 'handles' | 'files'

/** The database version. A database at a later one holds data of a pre-release version: refused, never read. */
const version = 1

const databaseName = storageName('openreloading-user-data')

/** Fired on the global scope when the database is refused: it holds data of a pre-release version. */
export const refusedEvent = 'user-db-refused'

let opened: Promise<IDBDatabase> | undefined
/** Opens the database at `version`, creating its stores when it is new. */
const database = () =>
  (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(databaseName, version)
    r.onupgradeneeded = () => {
      r.result.createObjectStore('records', { keyPath: 'id' })
      r.result.createObjectStore('handles')
      r.result.createObjectStore('files')
    }
    r.onsuccess = () => {
      // another tab deletes the database: close, the next call opens again
      r.result.onversionchange = () => {
        r.result.close()
        opened = undefined
      }
      resolve(r.result)
    }
    r.onerror = () => {
      reject(r.error ?? new Error('IndexedDB request failed'))
      // `globalThis`: the import worker opens the database too, without a `window`
      if (r.error?.name === 'VersionError') globalThis.dispatchEvent(new Event(refusedEvent))
    }
    // a failure, also a throw of `open` itself (no IndexedDB here), is not kept: the next call tries again
  }).catch((e) => {
    opened = undefined
    throw e
  }))

/** Deletes the database with every record, photo and folder handle in it. */
export const deleteDatabase = () => request(indexedDB.deleteDatabase(databaseName))

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
