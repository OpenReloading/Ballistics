import { readdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { pageCoversRoute, sections } from '../../../web/src/lib/sections.ts'
import { problems, schemes, tall, widths } from './a11y.ts'
import { gotoHydrated } from './nav.ts'

const appDir = path.join(__dirname, '../../../web/src/app')

// every page without a dynamic segment: the navigation reaches each of them, so each is swept
const routes = readdirSync(appDir, { recursive: true, encoding: 'utf8' })
  .filter((file) => path.basename(file) === 'page.tsx' && !file.includes('['))
  .map((file) => `/${path.dirname(file)}`.replace(/^\/\.$/, '/'))
  .sort()

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

for (const width of widths)
  for (const colorScheme of schemes)
    for (const route of routes)
      test(`${route} has no axe finding at ${width} px, ${colorScheme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: tall })
        await page.emulateMedia({ colorScheme })
        await gotoHydrated(page, route)
        // the lists and cards fill in after hydration
        await page.waitForLoadState('networkidle')
        expect(await problems(page, route)).toEqual([])
      })
