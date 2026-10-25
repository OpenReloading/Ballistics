'use client'

import { Kbd, Table } from '@mantine/core'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { type ShortcutId, shortcutLabel, shortcutMatches, shortcuts } from '../lib/shortcuts.ts'
import { AppModal } from './app-modal.tsx'

/** The shortcuts mounted now, counted per id, for the help dialog. */
const mounted = new Map<ShortcutId, number>()
const listeners = new Set<() => void>()
let snapshot = ''
const changed = () => {
  snapshot = [...mounted.keys()].join(' ')
  for (const l of listeners) l()
}

const inField = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/**
 * Binds the page's shortcuts of `lib/shortcuts.ts` while mounted and lists them in the help
 * dialog. `null` lists a shortcut handled elsewhere (the browser's print, an element's own keys).
 * A single key never fires from a text field; no shortcut runs while a modal dialog is open, and a
 * Ctrl one is then still kept from the browser, except Print.
 */
export function useShortcuts(bind: Partial<Record<ShortcutId, (() => void) | null>>) {
  const latest = useRef(bind)
  latest.current = bind
  const ids = Object.keys(bind).join(' ')
  useEffect(() => {
    const list = ids.split(' ') as ShortcutId[]
    for (const id of list) mounted.set(id, (mounted.get(id) ?? 0) + 1)
    changed()
    const onKey = (e: KeyboardEvent) => runShortcut(list, latest.current, e)
    document.documentElement.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.removeEventListener('keydown', onKey)
      for (const id of list) unmount(id)
      changed()
    }
  }, [ids])
}

function unmount(id: ShortcutId) {
  const n = (mounted.get(id) ?? 1) - 1
  if (n) mounted.set(id, n)
  else mounted.delete(id)
}

/** Whether a text field or an open dialog keeps shortcut `id` from running. */
function keptFromPage(id: ShortcutId, e: KeyboardEvent, modal: boolean) {
  const s = shortcuts[id]
  if (!s.fields && inField(e.target)) return true
  // the browser's own print stays with a dialog open: nothing else would print
  return modal && (s.keys.every((k) => k.length === 1) || id === 'print')
}

/** Runs the first mounted shortcut that matches `e`, with the modal and text field rules of `useShortcuts`. */
function runShortcut(
  list: ShortcutId[],
  bound: Partial<Record<ShortcutId, (() => void) | null>>,
  e: KeyboardEvent,
) {
  if (e.isComposing) return
  for (const id of list) {
    const run = bound[id]
    if (!run || !shortcutMatches(id, e)) continue
    const modal = document.querySelector('[aria-modal="true"]')
    if (keptFromPage(id, e, !!modal)) return
    e.preventDefault()
    if (!modal) run()
    return
  }
}

const openEvent = 'openreloading:shortcuts'
/** Opens the help dialog (the search's command, the "?" key). */
export const openShortcuts = () => window.dispatchEvent(new Event(openEvent))

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** The help dialog: the shortcuts the current page has mounted, in the table's order. */
export function ShortcutsHelp() {
  const [opened, setOpened] = useState(false)
  useEffect(() => {
    const open = () => setOpened(true)
    window.addEventListener(openEvent, open)
    return () => window.removeEventListener(openEvent, open)
  }, [])
  const active = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => '',
  ).split(' ')
  return (
    <AppModal opened={opened} onClose={() => setOpened(false)} title="Keyboard shortcuts">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Keys</Table.Th>
            <Table.Th>Action</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(Object.keys(shortcuts) as ShortcutId[])
            .filter((id) => active.includes(id))
            .map((id) => (
              <Table.Tr key={id}>
                <Table.Td>
                  {shortcutLabel(id)
                    .split(' or ')
                    .map((k, i) => (
                      <span key={k}>
                        {i > 0 && ' or '}
                        <Kbd size="xs">{k}</Kbd>
                      </span>
                    ))}
                </Table.Td>
                <Table.Td>{shortcuts[id].action}</Table.Td>
              </Table.Tr>
            ))}
        </Table.Tbody>
      </Table>
      {active.includes('redo') && (
        <p className="note">On macOS Cmd in place of Ctrl, but Ctrl+Y.</p>
      )}
    </AppModal>
  )
}
