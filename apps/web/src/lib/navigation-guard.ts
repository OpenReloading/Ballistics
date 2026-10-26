/**
 * Navigation started from code: the app router's `push` and `replace` ask every registered
 * question first and do nothing when one is declined. Links are guarded by the File menu itself
 * (`file-menu.tsx`), Back and Forward through `guardPop`.
 */

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

/**
 * Runs `on` for every Back and Forward before the router sees it, so `on` can stop it; returns its
 * removal. Listeners on window run in the order they were added, the capture flag aside: one added
 * by a page comes after the router's, which then moves to another page before the page's runs.
 */
export function guardPop(on: (e: PopStateEvent) => void) {
  pops.add(on)
  return () => {
    pops.delete(on)
  }
}

// added when the root providers load, before the router mounts and adds its own
if (typeof window !== 'undefined')
  window.addEventListener('popstate', (e) => {
    for (const on of [...pops]) on(e)
  })

type Go = (href: string, options?: object) => void
type Router = { push: Go; replace: Go; guarded?: true | undefined }

// `window.next.router` is the instance `useRouter` hands out; `useRouter` copies its methods when
// a component first renders, so this module is imported by the root providers, before any page.
const router =
  typeof window === 'undefined'
    ? undefined
    : (window as { next?: { router?: Router | undefined } }).next?.router
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
