import { type UserRecordKind, userRecord } from '@open-reloading/schema'
import { type RefObject, useEffect } from 'react'
import { type Message, msg } from '../i18n/translate.ts'
import { storedRecord } from '../lib/user-store.ts'
import type { FileMenuHandle } from './file-menu.tsx'

/** The status while a linked record is read. */
export const recordLoadingText = msg('Loading the record…')

/**
 * `?record=<id>` of a designer: the browser record is read, checked against the schema and
 * the designer's kind, and opened as the saved records listed by Open do, so Save
 * writes that record. Read once on mount; `say` gets the status message, undefined to clear it.
 */
export function useRecordLink(
  kind: UserRecordKind,
  menu: RefObject<FileMenuHandle | null>,
  say: (message: Message | undefined) => void,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: once on mount
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('record')
    if (!id) return
    say(recordLoadingText)
    storedRecord(id).then(
      async (raw) => {
        if (raw === undefined) return say(msg('That record is not in this browser.'))
        const r = userRecord.safeParse(raw)
        if (!r.success || r.data.kind !== kind)
          return say(msg('That record is not a design of this kind.'))
        say(undefined)
        await menu.current?.open(r.data)
      },
      () => say(msg('The records of this browser could not be read.')),
    )
  }, [])
}
