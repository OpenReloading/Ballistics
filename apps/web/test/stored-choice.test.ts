import { afterEach, expect, it, vi } from 'vitest'
import { storedChoice } from '../src/lib/stored-choice.ts'

afterEach(() => vi.unstubAllGlobals())

it('follows a choice another tab stores', () => {
  const stored = new Map<string, string>()
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => stored.set(k, v),
    removeItem: (k: string) => stored.delete(k),
  })
  const choice = storedChoice(
    'choice',
    (text) => text !== 'off',
    (on) => (on ? null : 'off'),
  )
  let shown = choice.read()
  const stop = choice.subscribe(() => {
    shown = choice.read()
  })
  // the other tab writes the storage and this window gets its storage event
  stored.set('choice', 'off')
  window.dispatchEvent(Object.assign(new Event('storage'), { key: 'choice' }))
  expect(shown).toBe(false)
  stop()
})
