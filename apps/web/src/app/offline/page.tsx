import type { Metadata } from 'next'
import { OfflineState } from '../../components/offline-state.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { sections } from '../../lib/sections.ts'

export const metadata: Metadata = { title: 'Offline', robots: { index: false } }

/** The service worker's answer for a page never opened on this device while offline. */
export default function Offline() {
  // the tools and the user's own records (Firearms, My cases) open offline
  const [tools, data] = sections
  return (
    <>
      <PageBar title="Offline" />
      <OfflineState
        links={[
          ...tools.pages,
          ...data.pages.filter((p) => p.href === '/firearms' || p.href === '/my-cases'),
        ]}
      />
    </>
  )
}
