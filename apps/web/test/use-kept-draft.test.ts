import type { UserRecord } from '@open-reloading/schema'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./fake-hooks.ts')).fakeHooks,
}))
const store = vi.hoisted(() => ({
  written: [] as UserRecord[],
  fail: false,
  persist: 0,
}))
vi.mock('../src/lib/user-store.ts', () => ({
  putRecords: (records: UserRecord[]) => {
    if (store.fail) return Promise.reject(new Error('quota'))
    store.written.push(...records)
    return Promise.resolve()
  },
  requestPersistentStorage: () => {
    store.persist++
    return Promise.resolve(true)
  },
}))

const { renderHook } = await import('./fake-hooks.ts')
const { useKeptDraft } = await import('../src/components/use-kept-draft.ts')

/** The page events the hook listens to, by name. */
let listeners: Map<string, () => void>
let page: { visibilityState: string }
const target = () => ({
  addEventListener: (name: string, f: () => void) => listeners.set(name, f),
  removeEventListener: (name: string) => listeners.delete(name),
})

beforeEach(() => {
  vi.useFakeTimers()
  store.written = []
  store.fail = false
  store.persist = 0
  listeners = new Map()
  vi.stubGlobal('window', target())
  page = { ...target(), visibilityState: 'visible' }
  vi.stubGlobal('document', page)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const data = { name: 'x' } as never
/** The hook over a draft whose name, key and record id the test changes. */
function draft(init: { key: string; name?: string; id?: string }) {
  const now = { name: 'My powder', id: 'r1', ...init }
  const view = renderHook(() =>
    useKeptDraft('powder', 'Untitled powder', 'blank', now.id, now.name, data, now.key),
  )
  return {
    now,
    view,
    kept: () => view.rerender().kept,
  }
}
const settle = () => vi.advanceTimersByTimeAsync(0)

it('is blank for the blank draft and writes nothing', async () => {
  const d = draft({ key: 'blank' })
  await vi.advanceTimersByTimeAsync(1000)
  expect(d.kept()).toBe('blank')
  expect(store.written).toEqual([])
})

it('writes a change 400 ms after the last one, then says saved and asks for lasting storage', async () => {
  const d = draft({ key: 'a' })
  expect(d.kept()).toBe('saving')
  await vi.advanceTimersByTimeAsync(300)
  d.now.key = 'b'
  d.view.rerender()
  await vi.advanceTimersByTimeAsync(300)
  expect(store.written).toEqual([])
  await vi.advanceTimersByTimeAsync(100)
  expect(store.written).toHaveLength(1)
  expect(store.written[0]).toMatchObject({ kind: 'powder', id: 'r1', name: 'My powder' })
  expect(d.kept()).toBe('saved')
  expect(store.persist).toBe(1)
  // the written key again is no change to save
  expect(d.kept()).toBe('saved')
})

it('names an unnamed draft with the fallback and cuts a long name at 200 characters', async () => {
  draft({ key: 'a', name: '   ' })
  await vi.advanceTimersByTimeAsync(400)
  expect(store.written[0]?.name).toBe('Untitled powder')
  draft({ key: 'a', name: ` ${'n'.repeat(250)}` })
  await vi.advanceTimersByTimeAsync(400)
  expect(store.written[1]?.name).toBe('n'.repeat(200))
})

it('says failed when the browser refuses the write', async () => {
  store.fail = true
  const d = draft({ key: 'a' })
  await vi.advanceTimersByTimeAsync(400)
  expect(d.kept()).toBe('failed')
})

it.each([false, true])(
  'ignores the answer of a write for a record no longer shown (refused: %s)',
  async (fail) => {
    store.fail = fail
    const d = draft({ key: 'a' })
    // the write is under way when another record is opened
    listeners.get('pagehide')?.()
    d.now.id = 'r2'
    d.now.key = 'blank'
    d.view.rerender()
    await settle()
    expect(store.written).toHaveLength(fail ? 0 : 1)
    expect(d.kept()).toBe('blank')
    expect(store.persist).toBe(0)
  },
)

it('writes at once when the page is hidden or goes, and when it unmounts', async () => {
  const d = draft({ key: 'a' })
  page.visibilityState = 'hidden'
  listeners.get('visibilitychange')?.()
  await settle()
  expect(store.written).toHaveLength(1)
  d.now.key = 'b'
  d.view.rerender()
  listeners.get('pagehide')?.()
  await settle()
  expect(store.written).toHaveLength(2)
  d.now.key = 'c'
  d.view.rerender()
  d.view.unmount()
  await settle()
  expect(store.written).toHaveLength(3)
  expect(listeners.size).toBe(0)
})

it('keeps a visible page waiting for the pause', async () => {
  draft({ key: 'a' })
  listeners.get('visibilitychange')?.()
  await settle()
  expect(store.written).toEqual([])
})

it('drop forgets the unwritten draft', async () => {
  const d = draft({ key: 'a' })
  d.view.rerender().drop()
  await vi.advanceTimersByTimeAsync(1000)
  expect(store.written).toEqual([])
})
