import { createFileRoute } from '@tanstack/react-router'
import { OfflineState } from '../components/offline-state.tsx'
import { titleTemplate } from '../lib/title-template.ts'

export const Route = createFileRoute('/offline')({
  head: () => ({
    meta: [
      { title: titleTemplate.replace('%s', 'Offline') },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: OfflineState,
})
