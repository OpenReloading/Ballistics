'use client'

import { Button, Code, EmptyState, Group } from '@mantine/core'
import { type Icon, MagnifyingGlass, WifiSlash } from '@phosphor-icons/react'
import Link from 'next/link'
import { type ReactNode, useSyncExternalStore } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { Message } from '../i18n/translate.ts'
import { basePath } from '../lib/edition.ts'
import { offlinePage } from '../lib/offline.ts'
import { openSiteSearch } from './search-host.ts'

const none = () => () => {}

type PageLinks = readonly { href: string; label: Message }[]

/** A page that stands in for another: centred, its icon, title, text, one action and page links. */
function StandIn({
  icon: Glyph,
  title,
  description,
  action,
  links,
  linksLabel,
}: {
  icon: Icon
  title: string
  description: ReactNode
  action: ReactNode
  links: PageLinks
  linksLabel: string
}) {
  const { t } = useTranslation()
  return (
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
            {t(p.label)}
          </Link>
        ))}
      </Group>
    </EmptyState>
  )
}

/**
 * The service worker serves this page in place of a page never stored on this device, at that
 * page's address: the address and Retry name that page. At its own address it names no page.
 */
export function OfflineState({ links }: { links: PageLinks }) {
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
        icon={WifiSlash}
        title={t('Works offline')}
        description={t(
          'The tools, your own records and the pages you opened before work without the network.',
        )}
        action={retry}
        links={links}
        linksLabel={linksLabel}
      />
    )
  const [before = '', after = ''] = t(
    'The page {address} was not opened on this device before, so it is not stored. The tools, your own records and the pages you opened before work without the network.',
    { address: '{address}' },
  ).split('{address}')
  return (
    <StandIn
      icon={WifiSlash}
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
      links={links}
      linksLabel={linksLabel}
    />
  )
}

/** An address without a page: Search and the pages of the sections. */
export function NotFoundState({ links }: { links: PageLinks }) {
  const { t } = useTranslation()
  return (
    <StandIn
      icon={MagnifyingGlass}
      title={t('Nothing at this address')}
      description={t(
        'This page could not be found. Search the records, or open one of these pages.',
      )}
      action={<Button onClick={openSiteSearch}>{t('Search')}</Button>}
      links={links}
      linksLabel={t('Pages')}
    />
  )
}
