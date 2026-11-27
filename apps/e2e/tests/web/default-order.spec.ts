import { expect, test } from '@playwright/test'
import { based, gotoHydrated } from './nav.ts'

// The default order of a directory follows the federation's own rule and a clicked column header replaces it; the discipline directory stands for the others, whose shared table keeps the list order, and the orders themselves are Vitest tests.
const rows = (page: import('@playwright/test').Page, base: string) =>
  page.locator(`main a[href^="${based(base)}/"]:not([href$="/designer/"])`)

test('the discipline directory lists ISSF by category, distance, then name, and a header sorts', async ({
  page,
}) => {
  await gotoHydrated(page, '/disciplines?org=ISSF')
  const list = rows(page, '/disciplines')
  await expect(list.nth(0)).toHaveText('10m Air Rifle')
  await expect(list.nth(1)).toHaveText('10m Moving Target')
  await expect(list.nth(2)).toHaveText('10m Moving Target Mixed')
  await expect(list.nth(3)).toHaveText('10m Air Pistol')
  await page.getByRole('button', { name: 'Name' }).first().click()
  await expect(list.nth(0)).toHaveText('10m Air Pistol')
  await expect(page).toHaveURL(/sort=name/)
})
