'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

/** Newest last: a page left by a client navigation stays hidden with its effects cleaned up, so the last slot is the shown page's. */
const slots: HTMLElement[] = []
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** From 75em the page bar sits in the top bar before its own buttons (`site-header.tsx`), so its actions come first in the keyboard order too. */
export function useBarEndSlot() {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!slot) return
    slots.push(slot)
    emit()
    return () => {
      slots.splice(slots.indexOf(slot), 1)
      emit()
    }
  }, [slot])
  return setSlot
}

/** The end slot of the page bar shown, or null on a page without one. */
export function useBarEnd() {
  return useSyncExternalStore(
    subscribe,
    () => slots.at(-1) ?? null,
    () => null,
  )
}
