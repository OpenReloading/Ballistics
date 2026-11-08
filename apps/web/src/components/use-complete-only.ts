'use client'

import { useSyncExternalStore } from 'react'
import { storageName } from '../lib/edition.ts'
import { storedChoice } from '../lib/stored-choice.ts'

/** The workbench choosers' filter "Complete records only", on unless this browser turned it off. */
const completeOnly = storedChoice(
  storageName('completeRecordsOnly'),
  (text) => text !== 'false',
  String,
)

/** The filter's state, kept per browser, and its setter; every chooser of the page follows it. */
export function useCompleteOnly() {
  const on = useSyncExternalStore(completeOnly.subscribe, completeOnly.read, () => true)
  return [on, completeOnly.set] as const
}
