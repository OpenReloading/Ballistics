'use client'

import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { Button, Code, EmptyState, Group } from '@mantine/core'
import { type LucideIcon, Search as SearchIcon, WifiOff } from 'lucide-react'
import { type ReactNode, useSyncExternalStore } from 'react'
import Link from '@/platform/link.tsx'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish } from '../i18n/lingui.ts'
import { basePath } from '../lib/edition.ts'
import { offlinePage } from '../lib/offline.ts'
import { type PageEntry, sections } from '../lib/sections.ts'
import englishMessages from '../locales/en/components/offline-state.json' with { type: 'json' }
import sectionsEnglish from '../locales/en/lib/sections.json' with { type: 'json' }
import { PageBar } from './page-bar.tsx'
import { openSiteSearch } from './search-host.ts'

loadEnglish(englishMessages, sectionsEnglish)

const none = () => () => {}

type PageLinks = readonly { href: string; label: MessageDescriptor }[]

const offlineTitle = /*i18n*/ { id: 'page.offline', message: 'Offline' }

const [tools] = sections
// the tools and the pages of the user's own records (firearms, a case group) open offline
const offlineLinks: PageLinks = [
  ...tools.pages,
  { href: '/firearms', label: /*i18n*/ { id: 'page.firearms', message: 'Firearms' } },
  { href: '/cases/editor', label: /*i18n*/ { id: 'page.casesEditor', message: 'Brass group' } },
]

/** A page that stands in for another: its page bar, then centered its icon, title, text, one action and page links. */
function StandIn({
  page,
  icon: Glyph,
  title,
  description,
  action,
  links,
  linksLabel,
}: {
  page: MessageDescriptor
  icon: LucideIcon
  title: string
  description: ReactNode
  action: ReactNode
  links: PageLinks
  linksLabel: string
}) {
  const { i18n } = useLingui()
  return (
    <>
      <PageBar title={page} translated />
      <EmptyState
        icon={<Glyph size={32} aria-hidden />}
        withIndicatorBackground
        title={title}
        description={description}
        mt="xl"
        styles={{ description: { maxWidth: '60ch' } }}
      >
        <EmptyState.Actions>{action}</EmptyState.Actions>
        <Group component="nav" aria-label={linksLabel} gap="md" justify="center">
          {links.map((p) => (
            <Link key={p.href} href={p.href}>
              {i18n._(p.label)}
            </Link>
          ))}
        </Group>
      </EmptyState>
    </>
  )
}

/** Served at the address of a page never stored on this device, so the address and Retry name that page; at its own address it names none. */
export function OfflineState() {
  const address = useSyncExternalStore(
    none,
    () => window.location.pathname + window.location.search,
    () => '',
  )
  const { t } = useTranslation()
  const retry = <Button onClick={() => window.location.reload()}>{t('Retry')}</Button>
  const linksLabel = t('Pages kept on this device')
  if (address.split('?')[0]?.replace(/\/$/, '') === basePath + offlinePage)
    return (
      <StandIn
        page={offlineTitle}
        icon={WifiOff}
        title={t('Works offline')}
        description={t('The tools, your own records and pages you opened before work offline.')}
        action={retry}
        links={offlineLinks}
        linksLabel={linksLabel}
      />
    )
  const [before = '', after = ''] = t(
    '{address} was never opened on this device, so it is not stored. The tools, your own records and pages you opened before work offline.',
    { address: '{address}' },
  ).split('{address}')
  return (
    <StandIn
      page={offlineTitle}
      icon={WifiOff}
      title={t('Not available offline')}
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

/** An address without a page: Search and the pages of the sections. */
export function NotFoundState() {
  const { t } = useTranslation()
  return (
    <StandIn
      page={/*i18n*/ { id: 'page.notFound', message: 'Page not found' }}
      icon={SearchIcon}
      title={t('Nothing at this address')}
      description={t(
        'This page could not be found. Search the records, or open one of these pages.',
      )}
      action={<Button onClick={openSiteSearch}>{t('Search')}</Button>}
      links={sections.flatMap((s): readonly PageEntry[] => s.pages)}
      linksLabel={t('Pages')}
    />
  )
}
