import type { Page } from '@playwright/test'

/** Records written to the browser's user store as the app saves them (creating the store if the app has not). */
export async function putRecords(page: Page, records: object[]) {
  await page.evaluate(async (records) => {
    const db: IDBDatabase = await new Promise((ok, no) => {
      const r = indexedDB.open('openreloading-user-data')
      r.onupgradeneeded = () => {
        for (const n of ['records', 'handles', 'files'])
          if (!r.result.objectStoreNames.contains(n))
            r.result.createObjectStore(n, n === 'records' ? { keyPath: 'id' } : undefined)
      }
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error ?? new Error('could not open the user store'))
    })
    const tx = db.transaction('records', 'readwrite')
    for (const record of records) tx.objectStore('records').put(record)
    await new Promise((ok) => {
      tx.oncomplete = ok
    })
    db.close()
  }, records)
}
