/** `push` and `replace` ask every registered question first; links are guarded by `file-menu.tsx`, Back and Forward by `guardPop`. */

// shortcut: a dev Fast Refresh of this module empties the set until a reload, keep it on the router if that bites
const questions = new Set<() => Promise<boolean>>()

/** Registers a question asked before a navigation from code; returns its removal. */
export function guardNavigation(ask: () => Promise<boolean>) {
  questions.add(ask)
  return () => {
    questions.delete(ask)
  }
}

const pops = new Set<(e: PopStateEvent) => void>()

/** Window listeners run in the order added, so one added by a page would run after the router has moved on. */
export function guardPop(on: (e: PopStateEvent) => void) {
  pops.add(on)
  return () => {
    pops.delete(on)
  }
}

/** Backs the app took itself whose popstate has not arrived yet. */
let ownBacks = 0

/** A Back no `guardPop` handler takes for the user's, also one added before its popstate arrives. */
export function backQuietly() {
  ownBacks++
  window.history.back()
}

// added when the root providers load, before the router mounts and adds its own
if (typeof window !== 'undefined')
  window.addEventListener('popstate', (e) => {
    if (ownBacks) {
      ownBacks--
      // a guard added meanwhile has its own entry under this move, which the router must not see either
      if (pops.size) e.stopImmediatePropagation()
      return
    }
    for (const on of [...pops]) on(e)
  })

type Go = (href: string, options?: object) => void
type Router = { push: Go; replace: Go; guarded?: true }

// `window.next.router` is the instance `useRouter` hands out, and `useRouter` copies its methods on first render, so the root providers import this module before any page.
const router =
  typeof window === 'undefined'
    ? undefined
    : (window as { next?: { router?: Router } }).next?.router
if (router && !router.guarded) {
  for (const key of ['push', 'replace'] as const) {
    const go = router[key]
    router[key] = (href, options) => {
      // without a question the navigation starts at once, as the router's own does
      if (!questions.size) return go(href, options)
      void (async () => {
        for (const ask of [...questions]) if (!(await ask())) return
        go(href, options)
      })()
    }
  }
  router.guarded = true
}
