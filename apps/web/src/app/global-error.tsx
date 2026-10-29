'use client'

import { useTranslation } from '../i18n/language.ts'

/**
 * An error in the root layout: replaces the whole document, so it carries its own html and body
 * and no app styles, theme or shell.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const { t, language } = useTranslation()
  return (
    <html lang={language}>
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: '2rem' }}>
        <title>{`${t('Something went wrong')} · OpenReloading Ballistics`}</title>
        <main>
          <h1>{t('Something went wrong')}</h1>
          <p role="alert">{t('OpenReloading could not be shown.')}</p>
          <p>
            {t(
              'Your saved records stay in this browser. Reload the page; if the error comes back, report an issue with the message below.',
            )}
          </p>
          <p>
            <small>{error.message}</small>
          </p>
          <button type="button" onClick={() => retry()}>
            {t('Try again')}
          </button>
        </main>
      </body>
    </html>
  )
}
