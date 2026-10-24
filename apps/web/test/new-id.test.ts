import { userId } from '@open-reloading/schema'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from '../src/lib/new-id.ts'

afterEach(() => vi.unstubAllGlobals())

describe('newId', () => {
  it('is a UUID the schema accepts', () => {
    expect(userId.safeParse(newId()).success).toBe(true)
  })

  it('still is one without crypto.randomUUID (an insecure origin)', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const ids = new Set(Array.from({ length: 50 }, newId))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(userId.safeParse(id).success).toBe(true)
  })
})
