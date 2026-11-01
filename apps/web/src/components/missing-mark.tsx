'use client'

import { Badge } from '@mantine/core'
import { useTranslation } from '../i18n/language.ts'

/** The plain mark of a record with values missing (`complete-records.ts`), after its name. */
export function MissingMark() {
  const { t } = useTranslation()
  return (
    <Badge ml="xs" variant="light" color="gray">
      {t('Values missing')}
    </Badge>
  )
}
