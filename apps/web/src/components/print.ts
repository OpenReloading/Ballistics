import { useEffect, useRef, useState } from 'react'

/**
 * Prints one part alone: `<html data-print={mode}>` switches the print rules (globals.css) until the
 * dialog closes, then `done` runs.
 */
export function printAlone(mode: string, done?: () => void) {
  const html = document.documentElement
  html.dataset.print = mode
  const end = () => {
    delete html.dataset.print
    removeEventListener('afterprint', end)
    done?.()
  }
  addEventListener('afterprint', end)
  print()
}

/**
 * Runs the latest `before` on `beforeprint` and `after` on `afterprint` while `on`. The browser takes
 * its print snapshot right after `beforeprint`: a state change there needs `flushSync`.
 */
export function usePrintEvents(before: () => void, after: () => void, on = true) {
  const latest = useRef({ before, after })
  latest.current = { before, after }
  useEffect(() => {
    if (!on) return
    const start = () => latest.current.before()
    const end = () => latest.current.after()
    addEventListener('beforeprint', start)
    addEventListener('afterprint', end)
    return () => {
      removeEventListener('beforeprint', start)
      removeEventListener('afterprint', end)
    }
  }, [on])
}

/** `document.body` after mount (undefined on the server and in the first render), for a portal. */
export function usePortalBody() {
  const [body, setBody] = useState<HTMLElement>()
  useEffect(() => setBody(document.body), [])
  return body
}
