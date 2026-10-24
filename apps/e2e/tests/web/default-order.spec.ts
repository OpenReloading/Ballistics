import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'

// The default order of the discipline and target face directories follows the federation's own
// rule; a clicked column header replaces it. The orders themselves are Vitest tests.
const rows = (page: import('@playwright/test').Page, base: string) =>
  page.locator(`main a[href^="${base}/"]:not([href$="/designer"])`)

test('the discipline directory lists ISSF by category, distance, then name, and a header sorts', async ({
  page,
}) => {
  await gotoHydrated(page, '/disciplines?org=ISSF')
  const list = rows(page, '/disciplines')
  await expect(list.nth(0)).toHaveText('10m Air Rifle')
  await expect(list.nth(1)).toHaveText('10m Air Pistol')
  await page.getByRole('button', { name: 'Name' }).first().click()
  await expect(list.nth(0)).toHaveText('10m Air Pistol')
  await expect(page).toHaveURL(/sort=name/)
})

test('the target face directory lists BDS faces by their printed code', async ({ page }) => {
  await gotoHydrated(page, '/targets?org=BDS')
  const list = rows(page, '/targets')
  await expect(list.nth(0)).toHaveText('BDS-50m-ZF-Scheibe (Z2)')
  await expect(list.nth(1)).toHaveText('BDS-100m-ZF-Scheibe (Z4)')
})
