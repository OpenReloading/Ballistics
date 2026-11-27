'use client'

import { useLingui } from '@lingui/react'
import { Button, Code } from '@mantine/core'
import { WifiOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { loadEnglish } from '../i18n/lingui.ts'
import { basePath } from '../lib/edition.ts'
import { offlinePage } from '../lib/offline.ts'
import { sections } from '../lib/sections.ts'
import englishMessages from '../locales/en/components/offline-state.json' with { type: 'json' }
import sectionsEnglish from '../locales/en/lib/sections.json' with { type: 'json' }
import { type PageLinks, StandIn } from './not-found-state.tsx'

loadEnglish(englishMessages, sectionsEnglish)

const none = () => () => {}

const offlineTitle = /*i18n*/ { id: 'page.offline', message: 'Offline' }

const [tools] = sections
// the tools and the pages of the user's own records (firearms, a case group) open offline
const offlineLinks: PageLinks = [
  ...tools.pages,
  { href: '/firearms', label: /*i18n*/ { id: 'page.firearms', message: 'Firearms' } },
  { href: '/cases/editor', label: /*i18n*/ { id: 'page.casesEditor', message: 'Brass group' } },
]

/** Served at the address of a page never stored on this device, so the address and Retry name that page; at its own address it names none. */
export function OfflineState() {
  const address = useSyncExternalStore(
    none,
    () => window.location.pathname + window.location.search,
    () => '',
  )
  const { i18n } = useLingui()
  const retry = (
    <Button onClick={() => window.location.reload()}>
      {i18n._({ id: 'states.retry', message: 'Retry' })}
    </Button>
  )
  const linksLabel = i18n._({ id: 'offline.links', message: 'Pages kept on this device' })
  if (address.split('?')[0]?.replace(/\/$/, '') === basePath + offlinePage)
    return (
      <StandIn
        page={offlineTitle}
        icon={WifiOff}
        title={i18n._({ id: 'offline.title', message: 'Works offline' })}
        description={i18n._({
          id: 'offline.about',
          message: 'The tools, your own records and pages you opened before work offline.',
        })}
        action={retry}
        links={offlineLinks}
        linksLabel={linksLabel}
      />
    )
  const [before = '', after = ''] = i18n
    ._({
      id: 'offline.notStored',
      message:
        '{address} was never opened on this device, so it is not stored. The tools, your own records and pages you opened before work offline.',
      values: { address: '{address}' },
    })
    .split('{address}')
  return (
    <StandIn
      page={offlineTitle}
      icon={WifiOff}
      title={i18n._({ id: 'offline.notStoredTitle', message: 'Not available offline' })}
      description={
        <>
          {before}
          {/* a space-holder before hydration keeps the line height */}
          <Code>{address || ' '}</Code>
          {after}
        </>
      }
      action={retry}
      links={offlineLinks}
      linksLabel={linksLabel}
    />
  )
}
