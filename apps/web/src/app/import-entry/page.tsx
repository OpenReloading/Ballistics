import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ImportEntryPage } from '../../components/import-entry-page.tsx'
import { PageBar } from '../../components/page-bar.tsx'

export const metadata: Metadata = { title: 'Import entry (prototype)', robots: { index: false } }

export default function Page() {
  return (
    <>
      <PageBar title="Import entry" />
      <div style={{ padding: '1rem' }}>
        <Suspense>
          <ImportEntryPage />
        </Suspense>
      </div>
    </>
  )
}
