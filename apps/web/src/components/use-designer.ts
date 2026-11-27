'use client'

import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { type UserRecord, userRecord } from '@rangefoundry/schema'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { type History, historyOf } from '../lib/history.ts'
import { newId } from '../lib/new-id.ts'
import type { UnitSystem } from '../lib/units.ts'
import { namedKey } from '../lib/user-data.ts'
import type { FileMenuHandle } from './file-menu.tsx'
import { useShortcuts } from './shortcuts.tsx'
import { useUnits } from './units-settings.tsx'
import { type KeptData, useKeptDraft } from './use-kept-draft.ts'
import { useRecordLink } from './use-record-link.ts'

/** The actions every designer's reducer takes. */
type DesignerAction<D> =
  | { type: 'start'; design: D }
  | { type: 'new' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'units'; system: UnitSystem }

const epoch = new Date(0).toISOString()

/** The last design the record format takes, as the browser keeps it. */
interface Draft<K extends UserRecord['kind']> {
  data: KeptData<K>
  key: string
  name: string
}

/** A shared action as the designer's own action type: every designer's reducer takes them. */
const asAction = <D, A>(a: DesignerAction<D>) => a as unknown as A

/** The line `load` shows in place of a design. */
interface LoadNote {
  loadNote: MessageDescriptor
}

/** What a designer gives `useDesigner`. */
interface DesignerSetup<D, A, K extends UserRecord['kind']> {
  reduce: (h: History<D>, a: A) => History<D>
  /** The design a new designer starts with. */
  init: (system: UnitSystem) => D
  kind: K
  fileData: (design: D) => KeptData<K>
  /** The name the browser keeps the draft under; empty for `fallbackName`. */
  draftName: (design: D) => string
  fallbackName: string
  /** The name typed, when the record keeps it outside its data: a change to keep. */
  nameKey?: (design: D) => string
  /** The design of a catalogue record, or the line shown when it does not start one; throws when it cannot be read. */
  load: (id: string, system: UnitSystem) => Promise<D | LoadNote>
  loadingText: MessageDescriptor
  failText: MessageDescriptor
}

/** `start` is a catalogue record, also the `?from=` link of a record page; every change is kept in the browser as the record `recordId`. */
export function useDesigner<D, A extends { type: string }, K extends UserRecord['kind']>(
  setup: DesignerSetup<D, A, K>,
) {
  const { reduce, kind, fileData } = setup
  const { system } = useUnits()
  const [history, dispatch] = useReducer(reduce, undefined, () => historyOf(setup.init(system)))
  // outside the fields, which keep the browser's own text undo
  useShortcuts({
    undo: () => dispatch(asAction<D, A>({ type: 'undo' })),
    redo: () => dispatch(asAction<D, A>({ type: 'redo' })),
  })
  const { i18n } = useLingui()
  // held as the message, so a language change rewrites the line shown
  const [loading, setLoading] = useState<MessageDescriptor>()
  const fileMenu = useRef<FileMenuHandle>(null)
  const current = useRef(history)
  current.current = history

  useEffect(() => dispatch(asAction<D, A>({ type: 'units', system })), [system])

  const latest = useRef(setup)
  latest.current = setup
  const keyOf = useCallback(
    (d: D) => namedKey(fileData(d), latest.current.nameKey?.(d) ?? ''),
    [fileData],
  )
  const design = history.present
  const data = useMemo(() => fileData(design), [fileData, design])
  const key = useMemo(() => keyOf(design), [keyOf, design])
  const [blankKey] = useState(key)
  const [recordId, setRecordId] = useState(newId)
  const valid = useMemo(
    () => userRecord.safeParse({ kind, id: recordId, name: kind, saved: epoch, data }).success,
    [kind, recordId, data],
  )
  // the record format refuses some values a field holds while typed: the last valid draft stays kept
  const [draft, setDraft] = useState<Draft<K>>(() => ({ data, key, name: setup.draftName(design) }))
  if (valid && key !== draft.key) setDraft(() => ({ data, key, name: setup.draftName(design) }))
  const { kept, flush, drop, stored } = useKeptDraft<K>(
    kind,
    setup.fallbackName,
    blankKey,
    recordId,
    draft.name,
    draft.data,
    draft.key,
  )
  /** A new record for the design about to show, kept once its key differs from `from`. */
  const renew = useCallback(
    (from: string) => {
      flush()
      setRecordId(newId())
      stored.current = { key: from, written: false }
    },
    [flush, stored],
  )

  /** Shows `next` as a new record, kept once its key differs from `from`, after the File menu's question when an edit not kept would go; false when the user keeps it. */
  const startNew = useCallback(
    (next: D, from: string, show: () => void) => {
      const then = () => {
        renew(from)
        show()
      }
      if (fileMenu.current) return fileMenu.current.startNew(fileData(next), then)
      then()
      return true
    },
    [renew, fileData],
  )

  /** Starts the designer on `design` as a new record, kept at once. */
  const begin = useCallback(
    async (design: D) =>
      startNew(design, blankKey, () => dispatch(asAction<D, A>({ type: 'start', design }))),
    [startNew, blankKey],
  )
  const start = useCallback(
    async (id: string) => {
      const { load, loadingText, failText } = latest.current
      setLoading(loadingText)
      try {
        const design = await load(id, system)
        if (typeof design === 'object' && design !== null && 'loadNote' in design) {
          setLoading(design.loadNote)
          return
        }
        // a catalogue design is kept from its first edit: a reload of its link adds no record
        await startNew(design, keyOf(design), () =>
          dispatch(asAction<D, A>({ type: 'start', design })),
        )
        setLoading(undefined)
      } catch {
        setLoading(failText)
      }
    },
    [system, startNew, keyOf],
  )
  // a record page's "Start a new ... from this one" link
  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get('from')
    if (from) start(from)
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, [])

  useRecordLink(kind, fileMenu, setLoading)

  /** Shows the record `id` the File menu opened (and stored) as `next`. */
  const opened = useCallback(
    (id: string, next: D) => {
      // an older draft of the same id must not overwrite the opened record
      if (id === recordId) drop()
      else flush()
      setRecordId(id)
      stored.current = { key: keyOf(next), written: true }
      dispatch(asAction<D, A>({ type: 'start', design: next }))
    },
    [recordId, drop, flush, stored, keyOf],
  )

  /** The toolbar's dispatch: New starts a new record. */
  const toolbarDispatch = useCallback(
    (a: A) => {
      if (a.type !== 'new') return dispatch(a)
      const next = reduce(current.current, a).present
      startNew(next, keyOf(next), () => dispatch(a))
    },
    [startNew, keyOf, reduce],
  )

  return {
    system,
    history,
    design,
    dispatch,
    loading: loading && i18n._(loading),
    fileMenu,
    start,
    begin,
    opened,
    recordId,
    kept: key === draft.key ? kept : ('failed' as const),
    toolbarDispatch,
  }
}
