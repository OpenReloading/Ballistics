'use client'

/**
 * An error in the root layout: replaces the whole document, so it carries its own html and body
 * and no app styles, theme or shell.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: '2rem' }}>
        <title>Something went wrong · OpenReloading Ballistics</title>
        <main>
          <h1>Something went wrong</h1>
          <p role="alert">OpenReloading could not be shown.</p>
          <button type="button" onClick={() => retry()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
