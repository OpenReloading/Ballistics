'use client'

import { Text } from '@mantine/core'
import { PageBar } from '../components/page-bar.tsx'
import { ErrorNote } from '../components/states.tsx'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'

/** A render error on any page without its own boundary: the shell stays, Retry renders it anew. */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <PageBar title={msg('Something went wrong')} translated />
      <ErrorNote title={t('This page could not be shown.')} onRetry={() => retry()}>
        {t(
          'Your saved records stay in this browser. Reload the page; if the error comes back, report an issue with the message below.',
        )}
        <Text size="xs" c="dimmed">
          {error.message}
        </Text>
      </ErrorNote>
    </>
  )
}
