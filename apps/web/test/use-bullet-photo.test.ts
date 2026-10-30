import { afterEach, expect, it, vi } from 'vitest'
import { useWorker } from '../src/components/use-bullet-photo.ts'
import { renderHook } from './fake-hooks.ts'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./fake-hooks.ts')).fakeHooks,
}))

class StubWorker {
  static made: StubWorker[] = []
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  terminated = false
  posted: unknown[] = []
  constructor() {
    StubWorker.made.push(this)
  }
  postMessage(m: unknown) {
    this.posted.push(m)
  }
  terminate() {
    this.terminated = true
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  StubWorker.made = []
})

it('ends a waiting request when the worker fails and starts a new worker on the next', async () => {
  vi.stubGlobal('Worker', StubWorker)
  const onError = vi.fn()
  const ask = renderHook(() => useWorker(onError)).result
  const pending = ask({ kind: 'segment', exclude: [] })
  const first = StubWorker.made[0]
  first?.onerror?.()
  expect(await pending).toEqual({
    kind: 'error',
    id: 1,
    message: 'The photograph could not be processed in this browser.',
  })
  expect(first?.terminated).toBe(true)
  expect(onError).toHaveBeenCalledOnce()

  void ask({ kind: 'segment', exclude: [] })
  expect(StubWorker.made).toHaveLength(2)
  expect(StubWorker.made[1]?.posted).toHaveLength(1)
})
