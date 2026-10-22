import { afterEach, expect, it } from 'vitest'
import { fits, storedRecords } from '../src/lib/user-store.ts'

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'indexedDB')
})

it('opens the store again after a failed open', async () => {
  // no IndexedDB: open throws
  await expect(storedRecords()).rejects.toThrow()
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open: () => {
        throw new Error('second open')
      },
    },
  })
  await expect(storedRecords()).rejects.toThrow('second open')
})

it('replaces a stored record only when absent or saved at the base the writer read', () => {
  const stored = { saved: '2026-10-15T10:00:02.000Z' }
  expect(fits(undefined, undefined)).toBe(true)
  expect(fits(undefined, '2026-10-15T10:00:01.000Z')).toBe(true)
  expect(fits(stored, stored.saved)).toBe(true)
  // another writer saved it since, also a newer or older base
  expect(fits(stored, '2026-10-15T10:00:01.000Z')).toBe(false)
  expect(fits(stored, '2026-10-15T10:00:03.000Z')).toBe(false)
  // a new sheet's id another writer took
  expect(fits(stored, undefined)).toBe(false)
})
