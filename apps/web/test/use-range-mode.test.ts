import { type UserRecord, userRecord } from '@open-reloading/schema'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { blankFirearm } from '../src/lib/firearm.ts'
import {
  addShot,
  localDate,
  rangeSessionId,
  rangeSteps,
  withSession,
} from '../src/lib/range-entry.ts'
import { presetUnits } from '../src/lib/units.ts'
import { defined } from './defined.ts'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./fake-hooks.ts')).fakeHooks,
}))
const store = vi.hoisted(() => new Map<string, unknown>())
vi.mock('../src/lib/user-store.ts', () => ({
  storedRecords: () => Promise.resolve({ records: [...store.values()], invalid: [] }),
  storedRecord: (id: string) => Promise.resolve(store.get(id)),
  updateRecord: (id: string, change: (stored: unknown) => unknown) => {
    const next = change(store.get(id))
    if (next !== undefined) store.set(id, next)
    return Promise.resolve(next)
  },
  requestPersistentStorage: () => Promise.resolve(true),
}))
vi.mock('../src/i18n/language.ts', async () => {
  const t = (await import('../src/i18n/number.ts')).untranslated()
  return { useTranslation: () => ({ t }) }
})
vi.mock('../src/components/units-settings.tsx', () => ({
  useUnits: () => ({ system: presetUnits('metric-grams') }),
}))

const { renderHook } = await import('./fake-hooks.ts')
const { useRangeMode } = await import('../src/components/use-range-mode.ts')

const firearmId = '0b6f2a4e-1c3d-4e5f-8a7b-9c0d1e2f3a4b'
const loadIds = ['1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e']

/** A load of the firearm whose session of today holds two shots, linked when the count was 100. */
function storeLoad(id: string) {
  const now = new Date()
  const data = { origin: 'user', firearm: `user:${firearmId}`, charge: { value: 42 } } as const
  const sessionId = rangeSessionId(`user:${id}`, localDate(now))
  const context = { id: sessionId, name: 'Range', loadRef: `user:${id}`, now }
  const step = defined(rangeSteps(data)[0])
  const session = addShot(context, step, 851)(addShot(context, step, 850)(undefined))
  const load = userRecord.parse({ kind: 'load', id, name: id, saved: '2026-10-30T10:00:00Z', data })
  store.set(sessionId, session)
  store.set(id, defined(withSession(load, `user:${sessionId}`, 100, now)))
}

beforeEach(() => {
  store.clear()
  const firearm: UserRecord = userRecord.parse({
    kind: 'firearm',
    id: firearmId,
    name: 'Rifle',
    saved: '2026-10-30T10:00:00Z',
    data: { ...blankFirearm(), name: 'Rifle', roundCount: 100 },
  })
  store.set(firearmId, firearm)
  for (const id of loadIds) storeLoad(id)
  vi.stubGlobal('window', {
    location: new URL('https://example.test/range/'),
    history: { replaceState: () => {} },
  })
})

afterEach(() => vi.unstubAllGlobals())

it('prefills the rounds of each session chosen and keeps an edit within one session', async () => {
  const h = renderHook(useRangeMode)
  /** Lets the store reads settle, rendering after each. */
  const settle = async () => {
    let r = h.rerender()
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve))
      r = h.rerender()
    }
    return r
  }
  let r = await settle()
  r.choose(loadIds[0])
  r = await settle()
  expect(r.roundOffer?.shots).toBe(2)
  expect(r.rounds).toBe('2')
  r.setRounds('5')
  r = await settle()
  expect(r.rounds).toBe('5')
  // another session with the same number of shots starts from its own shots; React renders
  // again at once when the session is cleared, before the offer for the old one is read
  r.choose(loadIds[1])
  h.rerender()
  r = await settle()
  expect(r.roundOffer?.shots).toBe(2)
  expect(r.rounds).toBe('2')
  // an exclusion in that session reads the offer again and keeps what was typed
  r.setRounds('7')
  await r.exclude(0, true)
  r = await settle()
  expect(r.string?.shots[0]?.excluded).toBeDefined()
  expect(r.rounds).toBe('7')
  h.unmount()
})
