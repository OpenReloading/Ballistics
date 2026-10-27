'use client'

import { AppShell } from '@mantine/core'
import type { ReactNode } from 'react'
import { isToolRoute } from '../lib/sections.ts'
import { SiteHeader } from './site-header.tsx'
import { useRoute } from './use-route.ts'

/**
 * Routes laid out as one window-high frame from 62em: tools, lists whose table scrolls, the
 * designers and the burn-rate overlay, whose list of powders without a curve scrolls.
 */
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

/**
 * The Mantine app shell: the top bar across the whole window (52 px, 56 px from 75em), the
 * icon rail under it from 75em (4.5rem), and the page in `AppShell.Main`. Sets the page width (`data-width`)
 * and the workbench frame (`data-frame`) from the route, not from the page's content: a page left
 * by a client navigation stays hidden in the document (Cache Components).
 */
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
