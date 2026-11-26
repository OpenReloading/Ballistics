import { expect, type Page, test } from '@playwright/test'
import { exported, gotoHydrated } from './nav.ts'

// proof only: every request after the click on Powders answered 1.5 s late, so the powders route loads slowly

const search = (page: Page) => page.getByRole('dialog').filter({ has: page.locator('input') })
const field = (page: Page) =>
  page.getByRole('textbox', { name: 'Search pages, cartridges, bullets, powders and commands' })

for (const wait of [false, true])
  test(`slow route, ${wait ? 'with' : 'without'} the wait for the page`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await gotoHydrated(page, '/workbench')
    await page.keyboard.press('Control+k')
    await expect(field(page)).toBeFocused()
    await field(page).fill('powders')
    await page.route('**/*', async (route) => {
      await new Promise((done) => setTimeout(done, 1500))
      await route.fallback()
    })
    await search(page).getByRole('button', { name: 'Powders', exact: true }).click()
    await expect(page).toHaveURL(exported('/powders'))
    if (wait)
      await expect(page.getByRole('heading', { level: 1, name: 'Powders' })).toHaveAttribute(
        'data-hydrated',
      )
    await page.keyboard.press('Control+k')
    await expect(field(page)).toBeFocused()
    await expect(field(page)).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1, name: 'Powders' })).toBeVisible()
    await expect(field(page)).toBeFocused()
  })
