'use client'

import { useSyncExternalStore } from 'react'
import { storageName } from '../lib/edition.ts'

/** The workbench choosers' filter "Complete records only", on unless this browser turned it off. */
const key = storageName('completeRecordsOnly')
const listeners = new Set<() => void>()
/** The state while the browser refuses storage: kept for the page only. */
let unstored = true

const subscribe = (notify: () => void) => {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

function read() {
  try {
    return localStorage.getItem(key) !== 'false'
  } catch {
    return unstored
  }
}

/** The filter's state, kept per browser, and its setter; every chooser of the page follows it. */
export function useCompleteOnly() {
  const on = useSyncExternalStore(subscribe, read, () => true)
  const set = (value: boolean) => {
    unstored = value
    try {
      localStorage.setItem(key, String(value))
    } catch {
      // no storage: the filter does not persist
    }
    for (const notify of listeners) notify()
  }
  return [on, set] as const
}
