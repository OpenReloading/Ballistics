import { createFileRoute } from '@tanstack/react-router'
import { OfflineState } from '../components/offline-state.tsx'
import { PageBar } from '../components/page-bar.tsx'
import { msg } from '../i18n/translate.ts'
import { sections } from '../lib/sections.ts'
import { titleTemplate } from '../lib/title-template.ts'

// the tools and the pages of the user's own records (firearms, a case group) open offline
const [tools] = sections
const links = [
  ...tools.pages,
  { href: '/firearms', label: msg('Firearms') },
  { href: '/cases/editor', label: msg('Brass group') },
]

/** The service worker's answer for a page never opened on this device while offline. */
function OfflinePage() {
  return (
    <>
      <PageBar title={msg('Offline')} translated />
      <OfflineState links={links} />
    </>
  )
}

export const Route = createFileRoute('/offline')({
  head: () => ({
    meta: [
      { title: titleTemplate.replace('%s', 'Offline') },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: OfflinePage,
})
