import type { UserRecord } from '@open-reloading/schema'
import { useCallback, useEffect, useRef, useState } from 'react'
import { putRecords, requestPersistentStorage } from '../lib/user-store.ts'

/** What the browser holds of the draft shown: nothing yet, a write under way, done or refused. */
export type Kept = 'blank' | 'saving' | 'saved' | 'failed'

/**
 * Keeps the draft of a designer in this browser: written 400 ms after the last change, and when
 * the page is hidden or goes. `stored` holds what the browser has for the record shown, or the
 * record opened, so opening a record is no change to save. `key` stands for the name and the data.
 */
export function useKeptDraft<K extends 'powder' | 'targetFaceDesign'>(
  kind: K,
  fallbackName: string,
  blankKey: string,
  recordId: string,
  name: string,
  data: Extract<UserRecord, { kind: K }>['data'],
  key: string,
) {
  const [kept, setKept] = useState<Kept>('blank')
  const stored = useRef({ key: blankKey, written: false })
  const current = useRef(recordId)
  useEffect(() => {
    current.current = recordId
  }, [recordId])
  const pending = useRef<{ record: UserRecord; key: string }>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const p = pending.current
    pending.current = undefined
    if (!p) return
    putRecords([p.record]).then(
      () => {
        if (current.current !== p.record.id) return
        stored.current = { key: p.key, written: true }
        setKept('saved')
        void requestPersistentStorage()
      },
      () => current.current === p.record.id && setKept('failed'),
    )
  }, [])
  /** Forgets the unwritten draft: a record opened over it has the same id and is the one to keep. */
  const drop = useCallback(() => {
    clearTimeout(timer.current)
    pending.current = undefined
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the name and the data
  useEffect(() => {
    if (key === stored.current.key) {
      pending.current = undefined
      setKept(stored.current.written ? 'saved' : 'blank')
      return
    }
    setKept('saving')
    pending.current = {
      key,
      record: {
        kind,
        id: recordId,
        name: name.trim().slice(0, 200) || fallbackName,
        saved: new Date().toISOString(),
        data,
      } as UserRecord,
    }
    timer.current = setTimeout(flush, 400)
    return () => clearTimeout(timer.current)
  }, [key, recordId])
  useEffect(() => {
    // a write begun in pagehide can be aborted with the page: hidden comes while it is still live
    const hidden = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])
  return { kept, flush, drop, stored }
}
