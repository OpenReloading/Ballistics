'use client'

import Link from 'next/link'
import { type ReactNode, Suspense } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg } from '../i18n/translate.ts'
import { sections } from '../lib/sections.ts'
import { controlSize } from '../lib/theme.ts'
import { NavIcon } from './nav-icons.tsx'
import { PageBar } from './page-bar.tsx'
import { Panel } from './panel.tsx'
import { LinkButton } from './record-actions.tsx'

/** The text of the button of a tool card: a German noun keeps its capital, so no text is built from the label. */
const openLabels: Record<string, Message> = {
  '/workbench': msg('Open load workbench'),
  '/session': msg('Open session summary'),
  '/groups': msg('Open shot groups'),
}

/** A list's record count, in the language shown. */
export function RecordCount({ count }: { count: number }) {
  const { tn } = useTranslation()
  return tn(count, '{count} record', '{count} records')
}

/** A card's head: the page's icon left of its linked title. */
function CardTitle({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <h3>
      <NavIcon name={icon} size={22} />
      <Link href={href}>{label}</Link>
    </h3>
  )
}

/**
 * The home page's content: a card per tool and per library page. `counts` holds the record count
 * of each list the build reads, by route; the firearms are the viewer's own.
 */
export function Home({ counts }: { counts: Record<string, ReactNode> }) {
  const { t } = useTranslation()
  const [tools, library] = sections
  return (
    <>
      <PageBar title="OpenReloading Ballistics" titleHidden />
      <div className="home-lead">
        <p className="lead">
          {t('A ballistics database with interior and exterior ballistics simulations')}
        </p>
      </div>
      <Panel id="home-tools" title={t(tools.title)}>
        <ul className="home-cards">
          {tools.pages.map((p) => (
            <li key={p.href}>
              <CardTitle href={p.href} label={t(p.label)} icon={p.icon} />
              <p>{t(p.description)}</p>
              <LinkButton
                href={p.href}
                size={controlSize.row.button}
                primary={p.href === '/workbench'}
                className="screen-only"
              >
                {t(openLabels[p.href] ?? p.label)}
              </LinkButton>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel id="home-library" title={t(library.title)}>
        <ul className="home-cards">
          {library.pages.map((p) => (
            <li key={p.href}>
              <CardTitle href={p.href} label={t(p.label)} icon={p.icon} />
              <p>{t(p.description)}</p>
              <ul className="home-tabs">
                {p.tabs.map((tab) => (
                  <li key={tab.href}>
                    <Link href={tab.href}>{t(tab.label)}</Link>{' '}
                    <span className="home-count">
                      <Suspense>
                        {tab.href === '/firearms' ? t('In this browser') : counts[tab.href]}
                      </Suspense>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
