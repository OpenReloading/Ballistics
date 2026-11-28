/** `push` and `replace` of `@/platform/navigation.ts` ask every registered question first (`whenAllowed`); links are guarded by `file-menu.tsx`, Back and Forward by `guardPop`. */

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

// added when the settings provider loads, before the router mounts and adds its own
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

/** Runs `go` once every registered question is accepted, at once without a question, as the router's own navigation starts. */
export function whenAllowed(go: () => void) {
  if (!questions.size) return go()
  void (async () => {
    for (const ask of [...questions]) if (!(await ask())) return
    go()
  })()
}
