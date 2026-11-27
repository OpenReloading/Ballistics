'use client'

import { PageErrorState } from '../components/page-error-state.tsx'

/** A render error on any page without its own boundary: the shell stays, Retry renders it anew. */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <PageErrorState message={error.message} retry={() => retry()} />
}
