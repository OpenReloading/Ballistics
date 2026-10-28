import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const keysIn = async () => {
  vi.resetModules()
  const { storageName } = await import('../src/lib/edition.ts')
  const { openLoadsKey } = await import('../src/lib/open-loads.ts')
  const { colorSchemeKey } = await import('../src/lib/theme.ts')
  return { name: storageName('openreloading-user-data'), openLoadsKey, colorSchemeKey }
}

it('the stable edition keeps the plain storage names', async () => {
  expect(await keysIn()).toEqual({
    name: 'openreloading-user-data',
    openLoadsKey: 'openLoads',
    colorSchemeKey: 'theme',
  })
  vi.stubEnv('NEXT_PUBLIC_PAGES_EDITION', '')
  expect((await keysIn()).name).toBe('openreloading-user-data')
})

it('the next edition names its database and keys apart, since both editions share one origin', async () => {
  vi.stubEnv('NEXT_PUBLIC_PAGES_EDITION', 'next')
  expect(await keysIn()).toEqual({
    name: 'next:openreloading-user-data',
    openLoadsKey: 'next:openLoads',
    colorSchemeKey: 'next:theme',
  })
})
