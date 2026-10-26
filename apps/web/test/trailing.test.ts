import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trailing } from '../src/lib/trailing.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('trailing', () => {
  it('sends only the last value of a burst, after the wait', () => {
    const send = vi.fn()
    const t = trailing<number>(send, 100)
    for (const v of [1, 2, 3]) {
      t.push(v)
      vi.advanceTimersByTime(60)
    }
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(40)
    expect(send.mock.calls).toEqual([[3]])
    vi.advanceTimersByTime(1000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('flush sends the held value at once, once', () => {
    const send = vi.fn()
    const t = trailing<string>(send, 100)
    t.flush()
    expect(send).not.toHaveBeenCalled()
    t.push('a')
    t.push('b')
    t.flush()
    expect(send.mock.calls).toEqual([['b']])
    vi.advanceTimersByTime(1000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('cancel drops the held value', () => {
    const send = vi.fn()
    const t = trailing<number>(send, 100)
    t.push(1)
    t.cancel()
    vi.advanceTimersByTime(1000)
    t.flush()
    expect(send).not.toHaveBeenCalled()
  })

  it('sends again for a later burst', () => {
    const send = vi.fn()
    const t = trailing<number>(send, 100)
    t.push(1)
    vi.advanceTimersByTime(100)
    t.push(2)
    vi.advanceTimersByTime(100)
    expect(send.mock.calls).toEqual([[1], [2]])
  })
})
