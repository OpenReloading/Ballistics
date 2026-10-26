'use client'

import type { UserRecordKind } from '@open-reloading/schema'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { type History, historyOf } from '../lib/history.ts'
import type { UnitSystem } from '../lib/units.ts'
import type { FileMenuHandle } from './file-menu.tsx'
import { useShortcuts } from './shortcuts.tsx'
import { useUnits } from './units-settings.tsx'
import { useRecordLink } from './use-record-link.ts'

/** The actions every designer's reducer takes. */
type DesignerAction<D> =
  | { type: 'start'; design: D }
  | { type: 'new' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'units'; system: UnitSystem }

/** A shared action as the designer's own action type: every designer's reducer takes them. */
const asAction = <D, A>(a: DesignerAction<D>) => a as unknown as A

/** What a designer gives `useDesigner`. */
interface DesignerSetup<D, A> {
  reduce: (h: History<D>, a: A) => History<D>
  /** The design a new designer starts with. */
  init: (system: UnitSystem) => D
  kind: UserRecordKind
  fileData: (design: D) => unknown
  /** The design of a catalogue record, or the line shown when it does not start one; throws when it cannot be read. */
  load: (id: string, system: UnitSystem) => Promise<D | string>
  loadingText: string
  failText: string
}

/**
 * The state the designers share: the undo history and its shortcuts, the file record (`fileMenu`),
 * the units, `start` (a catalogue record, also the `?from=` link of a record page) and the browser
 * record link.
 */
export function useDesigner<D, A extends { type: string }>(setup: DesignerSetup<D, A>) {
  const { reduce, kind, fileData } = setup
  const { system } = useUnits()
  const [history, dispatch] = useReducer(reduce, undefined, () => historyOf(setup.init(system)))
  // outside the fields, which keep the browser's own text undo
  useShortcuts({
    undo: () => dispatch(asAction<D, A>({ type: 'undo' })),
    redo: () => dispatch(asAction<D, A>({ type: 'redo' })),
  })
  const [loading, setLoading] = useState<string>()
  const fileMenu = useRef<FileMenuHandle>(null)
  /** A new record (`next`) starts a new file record; false when the user keeps unsaved changes. */
  const startNew = useCallback(
    (next: D, then?: () => void) => {
      if (fileMenu.current) return fileMenu.current.startNew(fileData(next), then)
      then?.()
      return true
    },
    [fileData],
  )
  const current = useRef(history)
  current.current = history

  useEffect(() => dispatch(asAction<D, A>({ type: 'units', system })), [system])

  const latest = useRef(setup)
  latest.current = setup
  /** Starts the designer on `design`, after the question of unsaved changes; false when the user keeps them. */
  const begin = useCallback(
    async (design: D) => {
      if (!(await startNew(design))) return false
      dispatch(asAction<D, A>({ type: 'start', design }))
      return true
    },
    [startNew],
  )
  const start = useCallback(
    async (id: string) => {
      const { load, loadingText, failText } = latest.current
      setLoading(loadingText)
      try {
        const design = await load(id, system)
        if (typeof design === 'string') {
          setLoading(design)
          return
        }
        await begin(design)
        setLoading(undefined)
      } catch {
        setLoading(failText)
      }
    },
    [system, begin],
  )
  // a record page's "Start a new ... from this one" link
  // biome-ignore lint/correctness/useExhaustiveDependencies: once on mount
  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get('from')
    if (from) start(from)
  }, [])

  useRecordLink(kind, fileMenu, setLoading)

  /** The toolbar's dispatch: New asks before it drops unsaved changes. */
  const toolbarDispatch = useCallback(
    (a: A) => {
      if (a.type !== 'new') return dispatch(a)
      startNew(reduce(current.current, a).present, () => dispatch(a))
    },
    [startNew, reduce],
  )

  return {
    system,
    history,
    design: history.present,
    dispatch,
    loading,
    fileMenu,
    start,
    begin,
    toolbarDispatch,
  }
}
