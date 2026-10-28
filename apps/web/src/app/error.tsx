'use client'

import { PageBar } from '../components/page-bar.tsx'
import { ErrorNote } from '../components/states.tsx'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'

/** A render error on any page without its own boundary: the shell stays, Retry renders it anew. */
export default function RootError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <PageBar title={msg('Something went wrong')} translated />
      <ErrorNote title={t('This page could not be shown.')} onRetry={() => retry()} />
    </>
  )
}
