'use client'

import { AppShell } from '@mantine/core'
import type { ReactNode } from 'react'
import { isToolRoute } from '../lib/sections.ts'
import { SiteHeader } from './site-header.tsx'
import { useRoute } from './use-route.ts'

/** One window-high frame from 62em, as their own parts scroll: a list's table, the burn-rate overlay's powders without a curve. */
const frameRoutes = new Set([
  '/workbench',
  '/groups',
  '/bullets',
  '/cartridges',
  '/powders',
  '/cases',
  '/primers',
  '/powders/burn-rates',
  '/bullets/designer',
  '/cartridges/designer',
  '/targets/designer',
  '/powders/designer',
])

/** Top bar 52 px (56 px from 75em), icon rail from 75em; `data-width` and `data-frame` come from the route, not the content, as a page left by a client navigation stays hidden in the document (Cache Components). */
export function PageShell({ children }: { children: ReactNode }) {
  const route = useRoute()
  return (
    <div
      className="page-shell"
      data-width={isToolRoute(route) ? 'tool' : undefined}
      data-frame={frameRoutes.has(route) || undefined}
    >
      <AppShell
        layout="default"
        header={{ height: { base: 52, lg: 56 } }}
        navbar={{ width: '4.5rem', breakpoint: 'lg', collapsed: { mobile: true } }}
      >
        <SiteHeader />
        {/* a div: the page holds the document's one <main> */}
        <AppShell.Main component="div" className="page-main">
          {children}
        </AppShell.Main>
      </AppShell>
    </div>
  )
}
