'use client'

import { useSyncExternalStore } from 'react'
import { storageName } from '../lib/edition.ts'

/** The workbench choosers' filter "Complete records only", on unless this browser turned it off. */
const key = storageName('completeRecordsOnly')
const listeners = new Set<() => void>()
/** The state while the browser refuses to store it: kept for the page only, read before storage. */
let unstored: boolean | undefined

const subscribe = (notify: () => void) => {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

function read() {
  if (unstored !== undefined) return unstored
  try {
    return localStorage.getItem(key) !== 'false'
  } catch {
    return true
  }
}

/** The filter's state, kept per browser, and its setter; every chooser of the page follows it. */
export function useCompleteOnly() {
  const on = useSyncExternalStore(subscribe, read, () => true)
  const set = (value: boolean) => {
    try {
      localStorage.setItem(key, String(value))
      unstored = undefined
    } catch {
      // no storage, or a full one: the filter holds for the page only
      unstored = value
    }
    for (const notify of listeners) notify()
  }
  return [on, set] as const
}
