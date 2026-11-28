import { useLingui } from '@lingui/react'
import { Text } from '@mantine/core'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/page-error-state.json' with { type: 'json' }
import { PageBar } from './page-bar.tsx'
import { ErrorNote } from './states.tsx'

loadEnglish(englishMessages)

/** A page's render or load error: the frame stays, Retry renders it anew; `message` is the error's own text. */
export function PageErrorState({ message, retry }: { message: string; retry: () => void }) {
  const { i18n } = useLingui()
  return (
    <>
      <PageBar title={/*i18n*/ { id: 'page.error', message: 'Something went wrong' }} translated />
      <ErrorNote
        title={i18n._({ id: 'pageError.title', message: 'This page could not be shown.' })}
        onRetry={retry}
      >
        {i18n._({
          id: 'pageError.kept',
          message:
            'Your saved records stay in this browser. Reload the page; if the error comes back, report an issue with the message below.',
        })}
        <Text size="xs" c="dimmed">
          {message}
        </Text>
      </ErrorNote>
    </>
  )
}
