'use client'

import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { type ReactNode, Suspense } from 'react'
import Link from '@/platform/link.tsx'
import { loadEnglish, ungrouped } from '../i18n/lingui.ts'
import { sections } from '../lib/sections.ts'
import { controlSize } from '../lib/theme.ts'
import englishMessages from '../locales/en/components/home.json' with { type: 'json' }
import sectionsEnglish from '../locales/en/lib/sections.json' with { type: 'json' }
import { ContinueStrip } from './continue-strip.tsx'
import { NavIcon } from './nav-icons.tsx'
import { PageBar } from './page-bar.tsx'
import { Panel } from './panel.tsx'
import { LinkButton } from './record-actions.tsx'

loadEnglish(englishMessages, sectionsEnglish)

/** The text of the button of a tool card: a German noun keeps its capital, so no text is built from the label. */
const openLabels: Record<string, MessageDescriptor> = {
  '/workbench': /*i18n*/ { id: 'home.open.workbench', message: 'Open load workbench' },
  '/session': /*i18n*/ { id: 'home.open.session', message: 'Open session summary' },
  '/groups': /*i18n*/ { id: 'home.open.groups', message: 'Open shot groups' },
}

/** The text of a card: only the home page shows it, so the pages' entries in `sections.ts`, which every route loads, leave it out. */
const abouts: Record<(typeof sections)[number]['pages'][number]['href'], MessageDescriptor> = {
  '/workbench': /*i18n*/ {
    id: 'home.about.workbench',
    message:
      'Simulated velocity, pressure against CIP limits and trajectory for your cartridge, bullet, powder and firearm, computed in your browser.',
  },
  '/session': /*i18n*/ {
    id: 'home.about.session',
    message: 'Shots and statistics per string from a chronograph export, read in your browser.',
  },
  '/groups': /*i18n*/ {
    id: 'home.about.groups',
    message:
      'Group size and dispersion from a target photo or a drawn target; the photo stays in your browser.',
  },
  '/cartridges': /*i18n*/ {
    id: 'home.about.database',
    message: 'The published records, each with its source, and your own beside them.',
  },
}

/** A list's record count, in the language shown. */
export function RecordCount({ count }: { count: number }) {
  const { i18n } = useLingui()
  return i18n._(
    'home.recordCount',
    { count },
    { message: '{count, plural, one {# record} other {# records}}', formats: ungrouped },
  )
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

/** `counts` holds the record count of each list the build reads, by route; the firearms are the viewer's own. */
export function Home({ counts }: { counts: Record<string, ReactNode> }) {
  const { i18n } = useLingui()
  const [tools, library] = sections
  return (
    <>
      <PageBar title="RangeFoundry Workbench" titleHidden />
      <div className="home-lead">
        <p className="lead">
          {i18n._({
            id: 'home.lead',
            message: 'A ballistics database with interior and exterior ballistics simulations',
          })}
        </p>
      </div>
      <ContinueStrip />
      <Panel id="home-tools" title={i18n._(tools.title)}>
        <ul className="home-cards">
          {tools.pages.map((p) => (
            <li key={p.href}>
              <CardTitle href={p.href} label={i18n._(p.label)} icon={p.icon} />
              <p>{i18n._(abouts[p.href])}</p>
              <LinkButton
                href={p.href}
                size={controlSize.row.button}
                primary={p.href === '/workbench'}
                className="screen-only"
              >
                {i18n._(openLabels[p.href] ?? p.label)}
              </LinkButton>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel id="home-library" title={i18n._(library.title)}>
        <ul className="home-cards">
          {library.pages.map((p) => (
            <li key={p.href}>
              <CardTitle href={p.href} label={i18n._(p.label)} icon={p.icon} />
              <p>{i18n._(abouts[p.href])}</p>
              <ul className="home-tabs">
                {p.tabs.map((tab) => (
                  <li key={tab.href}>
                    <Link href={tab.href}>{i18n._(tab.label)}</Link>{' '}
                    <span className="home-count">
                      <Suspense>
                        {tab.href === '/firearms'
                          ? i18n._({ id: 'firearms.inThisBrowser', message: 'In this browser' })
                          : counts[tab.href]}
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
