import { Text } from '@mantine/core'
import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { PageBar } from '../components/page-bar.tsx'
import { ErrorNote } from '../components/states.tsx'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'

// anything may be thrown
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

const kept = msg(
  'Your saved records stay in this browser. Reload the page; if the error comes back, report an issue with the message below.',
)

/** A page's render or load error, as the Next app's `app/error.tsx`: the frame stays, Retry loads and renders it anew. */
export function PageError({ error }: ErrorComponentProps) {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <>
      <PageBar title={msg('Something went wrong')} translated />
      <ErrorNote
        title={t('This page could not be shown.')}
        onRetry={() => void router.invalidate()}
      >
        {t(kept)}
        <Text size="xs" c="dimmed">
          {messageOf(error)}
        </Text>
      </ErrorNote>
    </>
  )
}

/** The frame's own error, as the Next app's `app/global-error.tsx`: no frame, the document's providers stay. */
export function AppError({ error }: ErrorComponentProps) {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <main style={{ margin: '2rem' }}>
      <title>{`${t('Something went wrong')} · RangeFoundry Workbench`}</title>
      <h1>{t('Something went wrong')}</h1>
      <p role="alert">{t('RangeFoundry Workbench could not be shown.')}</p>
      <p>{t(kept)}</p>
      <p>
        <small>{messageOf(error)}</small>
      </p>
      <button type="button" onClick={() => void router.invalidate()}>
        {t('Try again')}
      </button>
    </main>
  )
}
