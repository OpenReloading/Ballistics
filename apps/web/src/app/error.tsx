'use client'

import { PageBar } from '../components/page-bar.tsx'
import { ErrorNote } from '../components/states.tsx'

/** A render error on any page without its own boundary: the shell stays, Retry renders it anew. */
export default function RootError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <>
      <PageBar title="Something went wrong" />
      <ErrorNote title="This page could not be shown." onRetry={() => retry()} />
    </>
  )
}
