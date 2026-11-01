'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * The page bars' end slots, the newest last. A page left by a client navigation stays hidden in
 * the document with its effects cleaned up, so the last one is the bar of the page shown.
 */
const slots: HTMLElement[] = []
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/**
 * The page bar's end slot, empty, for the top bar's own buttons (site-header.tsx): from 75em the
 * bar sits in the top bar before them, so they follow its actions in the keyboard order too.
 */
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
