'use client'

import { Tabs } from '@mantine/core'
import { useEffect, useRef } from 'react'
import { useRouter } from '@/platform/navigation.ts'
import { useTranslation } from '../i18n/language.ts'
import { libraryOf } from '../lib/sections.ts'
import { useRoute } from './use-route.ts'

/** A tab keeps `q`, so one search follows the user across the kinds; manual activation, so the arrow keys move without opening each tab they pass. */
export function LibraryTabs() {
  const route = useRoute()
  const router = useRouter()
  const { t } = useTranslation()
  const page = libraryOf(route)
  const list = useRef<HTMLDivElement>(null)
  // the strip scrolls on a phone: the current tab stays in view
  useEffect(() => {
    const box = list.current
    const tab = box?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (box && tab) box.scrollLeft = tab.offsetLeft - (box.clientWidth - tab.offsetWidth) / 2
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
