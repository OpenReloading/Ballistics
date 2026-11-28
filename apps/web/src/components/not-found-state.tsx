import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { Button, EmptyState, Group } from '@mantine/core'
import { type LucideIcon, Search as SearchIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import Link from '@/platform/link.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import { type PageEntry, sections } from '../lib/sections.ts'
import englishMessages from '../locales/en/components/not-found-state.json' with { type: 'json' }
import sectionsEnglish from '../locales/en/lib/sections.json' with { type: 'json' }
import { PageBar } from './page-bar.tsx'
import { openSiteSearch } from './search-host.ts'

// the not-found boundary loads on every route, so the offline page's texts stay in `offline-state.tsx`
loadEnglish(englishMessages, sectionsEnglish)

export type PageLinks = readonly { href: string; label: MessageDescriptor }[]

/** A page that stands in for another: its page bar, then centered its icon, title, text, one action and page links. */
export function StandIn({
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

/** An address without a page: Search and the pages of the sections. */
export function NotFoundState() {
  const { i18n } = useLingui()
  return (
    <StandIn
      page={/*i18n*/ { id: 'page.notFound', message: 'Page not found' }}
      icon={SearchIcon}
      title={i18n._({ id: 'notFound.title', message: 'Nothing at this address' })}
      description={i18n._({
        id: 'notFound.about',
        message: 'This page could not be found. Search the records, or open one of these pages.',
      })}
      action={
        <Button onClick={openSiteSearch}>
          {i18n._({ id: 'shell.search', message: 'Search' })}
        </Button>
      }
      links={sections.flatMap((s): readonly PageEntry[] => s.pages)}
      linksLabel={i18n._({ id: 'notFound.links', message: 'Pages' })}
    />
  )
}
