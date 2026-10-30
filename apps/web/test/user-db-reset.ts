/** Deletes the browser store; an open connection closes on the version change and the next call opens it again. */
export const deleteUserDb = () =>
  new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase('openreloading-user-data')
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'))
  })
