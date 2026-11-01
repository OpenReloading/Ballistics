'use client'

import { Button } from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { download } from '../lib/download.ts'
import { controlSize } from '../lib/theme.ts'

/** Copy as CSV and Download CSV of a table; `csv` builds the text when a button is pressed. */
export function TableCsv({
  csv,
  disabled,
  name = 'powders.csv',
}: {
  csv: () => string
  disabled: boolean
  /** The downloaded file's name. */
  name?: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState<boolean | 'failed'>(false)
  const show = (state: true | 'failed') => {
    setCopied(state)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <>
      <Button
        size={controlSize.row.button}
        variant="default"
        disabled={disabled}
        onClick={() =>
          navigator.clipboard.writeText(csv()).then(
            () => show(true),
            () => show('failed'),
          )
        }
      >
        {copied === 'failed' ? t('Copy failed') : copied ? t('Copied') : t('Copy as CSV')}
      </Button>
      <Button
        size={controlSize.row.button}
        variant="default"
        disabled={disabled}
        onClick={() => download(new Blob([csv()], { type: 'text/csv;charset=utf-8' }), name)}
      >
        {t('Download CSV')}
      </Button>
    </>
  )
}
