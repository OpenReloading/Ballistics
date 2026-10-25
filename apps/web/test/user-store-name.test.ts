import 'fake-indexeddb/auto'
import { afterEach, expect, it, vi } from 'vitest'
import { databaseName } from '../src/lib/user-store.ts'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const record = {
  kind: 'bulletDesign',
  id: 'p1',
  name: 'Preview',
  saved: '2026-10-13T10:00:00.000Z',
  data: { origin: 'user' },
}

it('names the preview database apart from the released site', () => {
  expect(databaseName(false)).toBe('openreloading-user-data')
  expect(databaseName(true)).toBe('openreloading-user-data-preview')
  expect(databaseName()).toBe('openreloading-user-data')
})

it('the preview build opens its own database and leaves the released site one alone', async () => {
  vi.stubEnv('NEXT_PUBLIC_PAGES_PREVIEW', '1')
  vi.resetModules()
  const preview = await import('../src/lib/user-store.ts')
  await preview.putRecords([record as never])
  const names = (await indexedDB.databases()).map((d) => d.name)
  expect(names).toContain('openreloading-user-data-preview')
  expect(names).not.toContain('openreloading-user-data')
})
