import { readdirSync } from 'node:fs'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { pageCoversRoute, sections } from '../../../web/src/lib/sections.ts'
import { gotoHydrated } from './nav.ts'

const appDir = path.join(__dirname, '../../../web/src/app')

// every page without a dynamic segment: the navigation reaches each of them, so each is swept
const routes = readdirSync(appDir, { recursive: true, encoding: 'utf8' })
  .filter((file) => path.basename(file) === 'page.tsx' && !file.includes('['))
  .map((file) => `/${path.dirname(file)}`.replace(/^\/\.$/, '/'))
  .sort()

/** Violations not fixed yet, `rule id` by route with the issue that tracks them. Empty: none known. */
const known: Record<string, Record<string, string>> = {}

test('every page without a dynamic segment is in the navigation, so the sweep covers it', () => {
  const pages = sections.flatMap((s) => s.pages)
  // the home page and the offline page have no entry of their own
  const unlisted = routes.filter(
    (route) =>
      route !== '/' && route !== '/offline' && !pages.some((p) => pageCoversRoute(p.href, route)),
  )
  expect(unlisted, 'add the page to `sections` in apps/web/src/lib/sections.ts').toEqual([])
  expect(routes).toEqual(expect.arrayContaining(pages.map((p) => p.href)))
})

for (const width of [390, 1280])
  for (const colorScheme of ['light', 'dark'] as const)
    for (const route of routes)
      test(`${route} has no axe violation at ${width} px, ${colorScheme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ colorScheme })
        await gotoHydrated(page, route)
        // the lists and cards fill in after hydration
        await page.waitForLoadState('networkidle')
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
        expect(
          violations
            .filter((v) => !(v.id in (known[route] ?? {})))
            .map(
              (v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.html}`).join(', ')}`,
            ),
        ).toEqual([])
      })
