import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { applyExampleLoad } from './workbench.ts'

test('a menu click handled after its timeout applies the example once', async ({ page }) => {
  // a busy page: each click on a menu item is handled 1.5 s late, past the helper's 1 s click timeout
  await page.addInitScript(() =>
    document.addEventListener(
      'click',
      (e) => {
        if (!(e.target instanceof Element) || !e.target.closest('[role=menuitem]')) return
        const html = document.documentElement
        html.dataset.itemClicks = String(Number(html.dataset.itemClicks ?? 0) + 1)
        const end = performance.now() + 1500
        while (performance.now() < end) {}
      },
      { capture: true },
    ),
  )
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
  await expect(page.locator('html')).toHaveAttribute('data-item-clicks', '1')
})
