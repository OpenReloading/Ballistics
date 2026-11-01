'use client'

import type { Load } from '@open-reloading/schema'
import { useCallback, useMemo, useState } from 'react'

/** The Powders tab's charge mode and filters as a load keeps them (`analysis.powders`), stored units. */
export type SavedPowderTab = NonNullable<NonNullable<Load['analysis']>['powders']>

/**
 * The Powders tab's choice the load is saved with: the tab writes it as it changes, an opened load
 * puts its own back. `key` changes with each opened load, so a tab already shown starts from it.
 */
export function usePowderTab() {
  const [saved, setSaved] = useState<SavedPowderTab | undefined>()
  const [key, setKey] = useState(0)
  const open = useCallback((from: SavedPowderTab | undefined) => {
    setSaved(from)
    setKey((n) => n + 1)
  }, [])
  // the tab writes on every render of a change: the same text keeps the same object
  const set = useCallback(
    (next: SavedPowderTab | undefined) =>
      setSaved((now) => (JSON.stringify(now) === JSON.stringify(next) ? now : next)),
    [],
  )
  return useMemo(() => ({ saved, set, open, key }), [saved, set, open, key])
}
