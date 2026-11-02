import { afterEach, describe, expect, it, vi } from 'vitest'
import { fits, rawPhotoId } from '../src/lib/user-store.ts'

afterEach(() => {
  vi.unstubAllGlobals()
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

it('reads the photo id of a stored value only as text', () => {
  expect(rawPhotoId({ data: { photo: 'ph1' } })).toBe('ph1')
  expect(rawPhotoId({ data: { photo: 5 } })).toBeUndefined()
  expect(rawPhotoId({})).toBeUndefined()
  expect(rawPhotoId(null)).toBeUndefined()
})

describe('requestPersistentStorage', () => {
  /** A fresh module, so its one request per page load starts again. */
  async function request(storage: object | undefined) {
    vi.resetModules()
    vi.stubGlobal('navigator', { storage })
    const { requestPersistentStorage } = await import('../src/lib/user-store.ts')
    return requestPersistentStorage
  }

  it('gives the answer of the browser and asks once', async () => {
    const persist = vi.fn(() => Promise.resolve(false))
    const ask = await request({ persist })
    expect(await ask()).toBe(false)
    expect(await ask()).toBe(false)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('is true without the API or when the request fails', async () => {
    expect(await (await request(undefined))()).toBe(true)
    expect(await (await request({}))()).toBe(true)
    expect(await (await request({ persist: () => Promise.reject(new Error('no')) }))()).toBe(true)
  })
})
