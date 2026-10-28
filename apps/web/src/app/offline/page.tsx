import type { Metadata } from 'next'
import { OfflineState } from '../../components/offline-state.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { msg } from '../../i18n/translate.ts'
import { sections } from '../../lib/sections.ts'

export const metadata: Metadata = { title: 'Offline', robots: { index: false } }

/** The service worker's answer for a page never opened on this device while offline. */
export default function Offline() {
  // the tools and the pages of the user's own records (firearms, a case group) open offline
  const [tools] = sections
  return (
    <>
      <PageBar title={msg('Offline')} translated />
      <OfflineState
        links={[
          ...tools.pages,
          { href: '/firearms', label: msg('Firearms') },
          { href: '/cases/editor', label: msg('Case group') },
        ]}
      />
    </>
  )
}
