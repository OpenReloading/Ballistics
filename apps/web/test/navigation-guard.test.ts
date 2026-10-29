import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/** The router's own methods, which the guard wraps. */
const push = vi.fn()
const replace = vi.fn()
const router = { push, replace }
let popListener: ((e: PopStateEvent) => void) | undefined

// the module patches the router and adds its Back and Forward listener when it loads
vi.stubGlobal('window', {
  next: { router },
  addEventListener: (type: string, on: (e: PopStateEvent) => void) => {
    if (type === 'popstate') popListener = on
  },
})
const { guardNavigation, guardPop } = await import('../src/lib/navigation-guard.ts')

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  push.mockClear()
  replace.mockClear()
})

/** Lets the guard's questions settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve))

describe('guardNavigation', () => {
  it('navigates at once without a question', () => {
    router.push('/a', { scroll: false })
    expect(push).toHaveBeenCalledWith('/a', { scroll: false })
  })

  it('navigates when every question is accepted', async () => {
    const asked: string[] = []
    const removals = ['first', 'second'].map((q) =>
      guardNavigation(() => {
        asked.push(q)
        return Promise.resolve(true)
      }),
    )
    router.push('/a')
    await settle()
    expect(asked).toEqual(['first', 'second'])
    expect(push).toHaveBeenCalledWith('/a', undefined)
    router.replace('/b')
    await settle()
    expect(replace).toHaveBeenCalledWith('/b', undefined)
    for (const remove of removals) remove()
  })

  it('stays when a question is declined and asks no later one', async () => {
    const later = vi.fn(() => Promise.resolve(true))
    const removals = [guardNavigation(() => Promise.resolve(false)), guardNavigation(later)]
    router.push('/a')
    router.replace('/b')
    await settle()
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(later).not.toHaveBeenCalled()
    for (const remove of removals) remove()
  })

  it('does not ask a removed question', async () => {
    const ask = vi.fn(() => Promise.resolve(false))
    guardNavigation(ask)()
    router.push('/a')
    await settle()
    expect(ask).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/a', undefined)
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
})
