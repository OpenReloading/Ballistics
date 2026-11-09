'use client'

import { useEffect, useRef } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { deleteDatabase, inStore, refusedEvent } from '../lib/user-db.ts'
import { confirmDialog } from './confirm.tsx'

/** A pre-release database this version refuses (`refusedEvent`), asked once per page load; the page opens the database on mount, as a refusal in a worker never reaches this listener. */
export function PreReleaseData() {
  const { t } = useTranslation()
  const asked = useRef(false)
  useEffect(() => {
    const ask = async () => {
      if (asked.current) return
      asked.current = true
      const ok = await confirmDialog({
        title: t('Data of a pre-release version'),
        message: t(
          'This browser holds data of a pre-release version of the app, which this version does not read. Delete it to save records in this browser again.',
        ),
        confirmLabel: t('Delete'),
        danger: true,
      })
      // a failed delete asks again after the reload
      if (ok) void deleteDatabase().finally(() => location.reload())
    }
    window.addEventListener(refusedEvent, ask)
    // the read's own error (refused, or no IndexedDB here) is shown where a page reads
    inStore('records', 'readonly', (s) => s.count()).catch(() => {})
    return () => window.removeEventListener(refusedEvent, ask)
  }, [t])
  return null
}
