import { useLingui } from '@lingui/react'
import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { PageErrorState } from '../components/page-error-state.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/routes/-error.json' with { type: 'json' }

loadEnglish(englishMessages)

// anything may be thrown
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** A page's render or load error, as the Next app's `app/error.tsx`: the frame stays, Retry loads and renders it anew. */
export function PageError({ error }: ErrorComponentProps) {
  const router = useRouter()
  return <PageErrorState message={messageOf(error)} retry={() => void router.invalidate()} />
}

/** The frame's own error, as the Next app's `app/global-error.tsx`: no frame, the document's providers stay. */
export function AppError({ error }: ErrorComponentProps) {
  const { i18n } = useLingui()
  const router = useRouter()
  const title = i18n._({ id: 'page.error', message: 'Something went wrong' })
  return (
    <main style={{ margin: '2rem' }}>
      <title>{`${title} · RangeFoundry Workbench`}</title>
      <h1>{title}</h1>
      <p role="alert">
        {i18n._({ id: 'appError.notShown', message: 'RangeFoundry Workbench could not be shown.' })}
      </p>
      <p>
        {i18n._({
          id: 'pageError.kept',
          message:
            'Your saved records stay in this browser. Reload the page; if the error comes back, report an issue with the message below.',
        })}
      </p>
      <p>
        <small>{messageOf(error)}</small>
      </p>
      <button type="button" onClick={() => void router.invalidate()}>
        {i18n._({ id: 'appError.tryAgain', message: 'Try again' })}
      </button>
    </main>
  )
}
