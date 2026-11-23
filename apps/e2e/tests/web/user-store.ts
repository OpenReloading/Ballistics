import type { Page } from '@playwright/test'
import { storageName } from './edition.ts'

/** Records written to the browser's user store as the app saves them (creating the store if the app has not). */
export async function putRecords(page: Page, records: object[]) {
  await page.evaluate(
    async ([records, store]) => {
      const db: IDBDatabase = await new Promise((ok, no) => {
        const r = indexedDB.open(store)
        r.onupgradeneeded = () => {
          r.result.createObjectStore('records', { keyPath: 'id' })
          r.result.createObjectStore('handles')
          r.result.createObjectStore('files')
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
    },
    [records, storageName('rangefoundry-user-data')] as const,
  )
}
