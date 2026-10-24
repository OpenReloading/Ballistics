import { afterEach, describe, expect, it, vi } from 'vitest'
import { setStartIntent, startIntentEvent, takeStartIntent } from '../src/lib/start-intent.ts'

afterEach(() => vi.unstubAllGlobals())

describe('start intent', () => {
  it('is read once, by the workbench that takes it', () => {
    const seen: string[] = []
    vi.stubGlobal('window', {
      dispatchEvent: (e: Event) => seen.push(e.type),
    })
    setStartIntent('example')
    expect(seen).toEqual([startIntentEvent])
    expect(takeStartIntent()).toBe('example')
    expect(takeStartIntent()).toBeUndefined()
  })
})
