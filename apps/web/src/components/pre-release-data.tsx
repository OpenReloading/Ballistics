import { useLingui } from '@lingui/react'
import { useEffect, useRef } from 'react'
import { deleteDatabase, inStore, refusedEvent } from '@/platform/user-db.ts'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/pre-release-data.json' with { type: 'json' }
import { confirmDialog } from './confirm.tsx'

loadEnglish(englishMessages)

/** A pre-release database this version refuses (`refusedEvent`), asked once per page load; the page opens the database on mount, as a refusal in a worker never reaches this listener. */
export function PreReleaseData() {
  const { i18n } = useLingui()
  const asked = useRef(false)
  useEffect(() => {
    const ask = async () => {
      if (asked.current) return
      asked.current = true
      const ok = await confirmDialog({
        title: i18n._({ id: 'preRelease.title', message: 'Data of a pre-release version' }),
        message: i18n._({
          id: 'preRelease.message',
          message:
            'This browser holds data of a pre-release version of the app, which this version does not read. Delete it to save records in this browser again.',
        }),
        confirmLabel: i18n._({ id: 'preRelease.delete', message: 'Delete' }),
        danger: true,
      })
      // a failed delete asks again after the reload
      if (ok) void deleteDatabase().finally(() => location.reload())
    }
    window.addEventListener(refusedEvent, ask)
    // the read's own error (refused, or no IndexedDB here) is shown where a page reads
    inStore('records', 'readonly', (s) => s.count()).catch(() => {})
    return () => window.removeEventListener(refusedEvent, ask)
  }, [i18n])
  return null
}
