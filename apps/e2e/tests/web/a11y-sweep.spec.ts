import { readdirSync } from 'node:fs'
import path from 'node:path'
import { expect, type Page, test } from '@playwright/test'
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

/** Switches the system colour scheme of the open page and waits for the app to follow it and settle. */
async function showScheme(page: Page, colorScheme: (typeof schemes)[number]) {
  await page.emulateMedia({ colorScheme })
  // with no stored theme the provider follows the system setting (theme.spec.ts)
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', colorScheme)
  // axe reads colours at rest, not in a colour transition
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  )
}

// one load per page and width, swept in each scheme: the switch is the app's own system-setting path
for (const width of widths)
  for (const route of routes)
    test(`${route} has no axe finding at ${width} px, light and dark`, async ({ page }) => {
      await page.setViewportSize({ width, height: tall })
      await page.emulateMedia({ colorScheme: schemes[0] })
      await gotoHydrated(page, route)
      // the lists and cards fill in after hydration
      await page.waitForLoadState('networkidle')
      const found: string[] = []
      for (const colorScheme of schemes) {
        await showScheme(page, colorScheme)
        found.push(...(await problems(page, route)).map((line) => `${colorScheme} ${line}`))
      }
      expect(found).toEqual([])
    })
