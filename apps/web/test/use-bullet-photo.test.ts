import { afterEach, expect, it, vi } from 'vitest'
import { useWorker } from '../src/components/use-bullet-photo.ts'
import { linguiOf } from '../src/i18n/lingui.ts'
import { segment } from '../src/lib/bullet-photo.ts'
import { sayLingui } from '../src/lib/wording.ts'
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
    message: {
      id: 'bulletPhoto.workerFailed',
      message: 'The photograph could not be processed in this browser.',
    },
  })
  expect(first?.terminated).toBe(true)
  expect(onError).toHaveBeenCalledOnce()

  void ask({ kind: 'segment', exclude: [] })
  expect(StubWorker.made).toHaveLength(2)
  expect(StubWorker.made[1]?.posted).toHaveLength(1)
})

it("has the English of the worker's messages without another page", () => {
  const missing: string[] = []
  const en = linguiOf('en')
  const stop = en.on('missing', ({ id }) => missing.push(id))
  const [warning] = segment({ width: 4, height: 4, data: new Float32Array(16) }).warnings
  const text = warning && sayLingui(en, warning)
  stop()
  expect(missing).toEqual([])
  expect(text).toBe('The photograph has one grey only.')
})
