import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/** A navigation the guard lets through. */
const go = vi.fn()
let popListener: ((e: PopStateEvent) => void) | undefined

// the module adds its Back and Forward listener when it loads
vi.stubGlobal('window', {
  addEventListener: (type: string, on: (e: PopStateEvent) => void) => {
    if (type === 'popstate') popListener = on
  },
  // a Back moves in a later task: its popstate arrives when the test pops
  history: { back: () => {} },
})
const { backQuietly, guardNavigation, guardPop, whenAllowed } = await import(
  '../src/lib/navigation-guard.ts'
)

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  go.mockClear()
})

/** Lets the guard's questions settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve))

describe('whenAllowed', () => {
  it('navigates at once without a question', () => {
    whenAllowed(go)
    expect(go).toHaveBeenCalled()
  })

  it('navigates when every question is accepted', async () => {
    const asked: string[] = []
    const removals = ['first', 'second'].map((q) =>
      guardNavigation(() => {
        asked.push(q)
        return Promise.resolve(true)
      }),
    )
    whenAllowed(go)
    await settle()
    expect(asked).toEqual(['first', 'second'])
    expect(go).toHaveBeenCalled()
    for (const remove of removals) remove()
  })

  it('stays when a question is declined and asks no later one', async () => {
    const later = vi.fn(() => Promise.resolve(true))
    const removals = [guardNavigation(() => Promise.resolve(false)), guardNavigation(later)]
    whenAllowed(go)
    await settle()
    expect(go).not.toHaveBeenCalled()
    expect(later).not.toHaveBeenCalled()
    for (const remove of removals) remove()
  })

  it('does not ask a removed question', async () => {
    const ask = vi.fn(() => Promise.resolve(false))
    guardNavigation(ask)()
    whenAllowed(go)
    await settle()
    expect(ask).not.toHaveBeenCalled()
    expect(go).toHaveBeenCalled()
  })
})

describe('guardPop', () => {
  const pop = () => {
    const e = { stopImmediatePropagation: vi.fn() } as never as PopStateEvent
    popListener?.(e)
    return e
  }

  it('runs the handlers in the order they were added, each able to stop the event', () => {
    const ran: string[] = []
    const removals = [
      guardPop(() => ran.push('first')),
      guardPop((e) => {
        ran.push('second')
        e.stopImmediatePropagation()
      }),
    ]
    const e = pop()
    expect(ran).toEqual(['first', 'second'])
    expect(e.stopImmediatePropagation).toHaveBeenCalled()
    for (const remove of removals) remove()
  })

  it('does not run a removed handler', () => {
    const on = vi.fn()
    guardPop(on)()
    pop()
    expect(on).not.toHaveBeenCalled()
  })

  it('does not run a handler added before a Back the app took itself arrives, only on the next', () => {
    const asked: string[] = []
    // saved: the first guard goes with its entry
    guardPop(() => asked.push('first'))()
    backQuietly()
    // unsaved again before that Back arrives
    const remove = guardPop(() => asked.push('second'))
    pop()
    expect(asked).toEqual([])
    pop()
    expect(asked).toEqual(['second'])
    remove()
  })
})
