import { afterEach, expect, it, vi } from 'vitest'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}))

const { setSingleKeys, useSingleKeys } = await import('../src/components/shortcuts.tsx')

afterEach(() => vi.unstubAllGlobals())

it('keeps the session choice when a write succeeds and a later read throws', () => {
  vi.stubGlobal('window', { dispatchEvent: () => true })
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {},
    removeItem: () => {},
  })
  setSingleKeys(false)
  expect(useSingleKeys()).toBe(false)
  setSingleKeys(true)
  expect(useSingleKeys()).toBe(true)
})
