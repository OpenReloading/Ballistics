// Stands in for apps/web/src/lib/user-db.ts with the same exports, the database opened and versioned by Dexie.
import Dexie from 'dexie'
import { storageName } from '../../../web/src/lib/edition.ts'

type Store = 'records' | 'handles' | 'files'

const databaseName = storageName('openreloading-user-data')

/** Fired on the global scope when the database is refused: it holds data of a pre-release version. */
export const refusedEvent = 'user-db-refused'

let db: Dexie | undefined

async function database(): Promise<IDBDatabase> {
  if (!db) {
    db = new Dexie(databaseName)
    db.version(1).stores({ records: 'id', handles: '', files: '' })
  }
  try {
    await db.open()
  } catch (e) {
    db = undefined
    if ((e as Error).name === 'VersionError') globalThis.dispatchEvent(new Event(refusedEvent))
    throw e
  }
  return db.backendDB()
}

const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'))
  })

/** Deletes the database with every record, photo and folder handle in it. */
export async function deleteDatabase() {
  db?.close()
  db = undefined
  await Dexie.delete(databaseName)
}

/** Runs `f` on one store; resolves once the transaction has committed. */
export async function inStore<T>(
  name: Store,
  mode: IDBTransactionMode,
  f: (s: IDBObjectStore) => IDBRequest<T> | undefined,
): Promise<T | undefined> {
  const tx = (await database()).transaction(name, mode)
  const r = f(tx.objectStore(name))
  const result = r && request(r)
  result?.catch(() => {})
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
  return result
}
