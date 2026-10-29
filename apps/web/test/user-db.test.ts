import 'fake-indexeddb/auto'
import { afterEach, expect, it, vi } from 'vitest'
import { inStore } from '../src/lib/user-db.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

const deleted = (name: string) =>
  new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(name)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })

it('tries again after a failed open, as where the browser has no IndexedDB', async () => {
  const real = indexedDB
  vi.stubGlobal('indexedDB', {
    open: () => {
      throw new DOMException('No IndexedDB here.', 'InvalidStateError')
    },
  })
  await expect(inStore('handles', 'readonly', (s) => s.get('folder'))).rejects.toThrow(
    'No IndexedDB here.',
  )
  vi.stubGlobal('indexedDB', real)
  await expect(inStore('handles', 'readonly', (s) => s.get('folder'))).resolves.toBeUndefined()
})

it('resolves once the write has committed, with or without a request', async () => {
  await inStore('handles', 'readwrite', (s) => s.put({ name: 'loads' }, 'folder'))
  await expect(inStore('handles', 'readonly', (s) => s.get('folder'))).resolves.toEqual({
    name: 'loads',
  })
  await expect(inStore('handles', 'readonly', () => undefined)).resolves.toBeUndefined()
})

it('rejects a request the store refuses, and the write it was part of', async () => {
  await inStore('records', 'readwrite', (s) => s.put({ id: 'r1' }))
  await expect(inStore('records', 'readwrite', (s) => s.add({ id: 'r1' }))).rejects.toThrow()
  await expect(inStore('records', 'readonly', (s) => s.count())).resolves.toBe(1)
})

it('opens again with every store after another tab deleted the database', async () => {
  await inStore('records', 'readwrite', (s) => s.put({ id: 'r2' }))
  await deleted('openreloading-user-data')
  await expect(inStore('records', 'readonly', (s) => s.count())).resolves.toBe(0)
  await expect(inStore('files', 'readonly', (s) => s.count())).resolves.toBe(0)
})
