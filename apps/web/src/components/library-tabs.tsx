'use client'

import { Tabs } from '@mantine/core'
import { useRouter } from 'next/navigation'
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
  const page = libraryOf(route)
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
      <Tabs.List aria-label={page.label}>
        {page.tabs.map((t) => (
          <Tabs.Tab key={t.href} value={t.href}>
            {t.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  )
}
