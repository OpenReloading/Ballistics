import { expect, it } from 'vitest'
import { anySignal } from '../src/lib/any-signal.ts'

it('aborts with the reason of the first signal to abort', () => {
  const a = new AbortController()
  const b = new AbortController()
  const any = anySignal([a.signal, b.signal])
  expect(any.aborted).toBe(false)
  b.abort('b')
  a.abort('a')
  expect(any.aborted).toBe(true)
  expect(any.reason).toBe('b')
})

it('is aborted at once when a signal already is', () => {
  const any = anySignal([new AbortController().signal, AbortSignal.abort('gone')])
  expect(any.aborted).toBe(true)
  expect(any.reason).toBe('gone')
})
