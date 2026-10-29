'use client'

import { Text } from '@mantine/core'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { errorText } from '../lib/error-text.ts'
import { storedRecords } from '../lib/user-store.ts'
import { yourDataRows } from '../lib/your-data.ts'
import { ErrorNote, Loading } from './states.tsx'

/**
 * The Your data section of Settings, General: one row per kind of record in this browser with its
 * number, linked to the list that shows them. `onNavigate` closes the dialog for a link that stays
 * on the page's route.
 */
export function YourDataForm({ onNavigate }: { onNavigate: () => void }) {
  const [rows, setRows] = useState<ReturnType<typeof yourDataRows>>()
  const { t } = useTranslation()
  // the reason only: the sentence around it is built when shown, in the language shown
  const [failure, setFailure] = useState('')
  useEffect(() => {
    let live = true
    storedRecords().then(
      ({ records }) => live && setRows(yourDataRows(records)),
      (e) => {
        if (!live) return
        setRows(yourDataRows([]))
        setFailure(errorText(e))
      },
    )
    return () => {
      live = false
    }
  }, [])
  return (
    <>
      <Text size="sm" c="dimmed">
        {t('What you keep in this browser. A row opens its list with your records.')}
      </Text>
      {failure && (
        <ErrorNote>
          {t("The browser's records could not be read: {reason}", { reason: failure })}
        </ErrorNote>
      )}
      {rows === undefined ? (
        <Loading what="your data" rows={2} />
      ) : (
        <table className="your-data">
          <thead>
            <tr>
              <th scope="col">{t('Records')}</th>
              <th scope="col" className="num">
                {t('Yours')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kind}>
                <th scope="row">
                  <Link href={r.href} onClick={onNavigate}>
                    {t(r.label)}
                  </Link>
                </th>
                <td className="num">{plainNumber(r.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
