import 'fake-indexeddb/auto'
import { describe, vi } from 'vitest'
import { deleteUserDb } from './user-db-reset.ts'
import { basics } from './user-store-contract/basics.ts'
import type { UserStoreImplementation } from './user-store-contract/implementation.ts'
import { invalidEntries } from './user-store-contract/invalid.ts'
import { refit } from './user-store-contract/refit.ts'
import { write } from './user-store-contract/write.ts'

const raw: UserStoreImplementation = {
  store: await import('../src/platform/user-store.ts'),
  fresh: () => {
    vi.resetModules()
    return import('../src/platform/user-store.ts')
  },
  reset: deleteUserDb,
}

describe('the IndexedDB user store', () => {
  describe('basics', () => basics(raw))
  describe('writes', () => write(raw))
  describe('refit chains', () => refit(raw))
  describe('invalid entries', () => invalidEntries(raw))
})
