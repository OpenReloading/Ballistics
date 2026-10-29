/**
 * React's hooks for one hook or component called as a plain function, for the tests without a DOM:
 * state and refs kept by call order across renders, effects run after each render when their
 * dependencies change, cleanups on the next run and on `unmount`. Mock `react` with `fakeHooks`.
 */
type Effect = { deps: readonly unknown[] | undefined; cleanup: (() => void) | undefined }

let slots: unknown[] = []
let at = 0
let queued: (() => void)[] = []
let effects: Effect[] = []

function slot<T>(init: () => T): T {
  const k = at++
  if (!(k in slots)) slots[k] = init()
  return slots[k] as T
}

const changed = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) =>
  !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]))

function useEffect(f: () => unknown, deps?: readonly unknown[]) {
  const e = slot<Effect & { first: boolean }>(() => ({
    deps: undefined,
    cleanup: undefined,
    first: true,
  }))
  if (!e.first && !changed(e.deps, deps)) return
  if (e.first) effects.push(e)
  e.first = false
  e.deps = deps
  queued.push(() => {
    e.cleanup?.()
    const cleanup = f()
    e.cleanup = typeof cleanup === 'function' ? (cleanup as () => void) : undefined
  })
}

export const fakeHooks = {
  useState: <T>(init: T | (() => T)) => {
    const cell = slot(() => ({ v: init instanceof Function ? init() : init }))
    const set = (n: T | ((v: T) => T)) => {
      cell.v = n instanceof Function ? n(cell.v) : n
    }
    return [cell.v, set] as const
  },
  useRef: <T>(v: T) => slot(() => ({ current: v })),
  useCallback: <F>(f: F, deps: readonly unknown[]) => {
    const c = slot(() => ({ f, deps }))
    if (changed(c.deps, deps)) Object.assign(c, { f, deps })
    return c.f
  },
  useEffect,
  useLayoutEffect: useEffect,
}

/** Calls `hook` as its first render; `rerender` calls it again with the state kept. */
export function renderHook<T>(hook: () => T) {
  slots = []
  effects = []
  const render = () => {
    at = 0
    queued = []
    const result = hook()
    for (const run of queued) run()
    return result
  }
  return {
    result: render(),
    rerender: render,
    unmount: () => {
      for (const e of effects) e.cleanup?.()
    },
  }
}
