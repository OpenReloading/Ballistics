'use client'

import { Tabs } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { libraryOf } from '../lib/sections.ts'
import { useRoute } from './use-route.ts'

/**
 * The tab bar of a library page (the Database) on the route of one of its tabs, nothing on any
 * other route. Each tab is a route of its own: a tab opens it, keeping the search text (`q`) so one
 * search follows the user across the kinds. Manual activation, so the arrow keys move between the tabs
 * and Enter or Space opens one, not each tab the arrow passes.
 */
export function LibraryTabs() {
  const route = useRoute()
  const router = useRouter()
  const { t } = useTranslation()
  const page = libraryOf(route)
  const list = useRef<HTMLDivElement>(null)
  // the strip scrolls on a phone: the current tab stays in view
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the route changes
  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [route])
  if (!page?.tabs) return null
  return (
    <Tabs
      value={route}
      activateTabWithKeyboard={false}
      className="library-tabs"
      onChange={(href) => {
        if (!href || href === route) return
        // read at the click: the list keeps its search in the address without rendering again
        const q = new URLSearchParams(window.location.search).get('q')
        router.push(q ? `${href}?${new URLSearchParams({ q })}` : href)
      }}
    >
      <Tabs.List ref={list} aria-label={t(page.label)}>
        {page.tabs.map((tab) => (
          <Tabs.Tab key={tab.href} value={tab.href}>
            {t(tab.label)}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  )
}
