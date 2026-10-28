import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'

// The choice filters of the Database lists: kept in the URL, counted, cleared, and opened by a
// link. The counting and the URL format are Vitest tests (`apps/web/test/facets.test.ts`).
test('a discipline filtered by federation and a distance in yards survives a reload and clears', async ({
  page,
}) => {
  await gotoHydrated(page, '/disciplines')
  await page
    .locator('.directory-filters')
    .getByRole('button', { name: 'Federation', exact: true })
    .click()
  await page.getByRole('checkbox', { name: /^BDMP/ }).check()
  await page.keyboard.press('Escape')
  await page
    .locator('.directory-filters')
    .getByRole('button', { name: 'Distance', exact: true })
    .click()
  // a rule book that states "25 Meter/Yards" is found by either unit
  const yards = page.getByRole('checkbox', { name: /^25 yd/ })
  await yards.check()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/org=BDMP.*dist=25yd|dist=25yd.*org=BDMP/)
  const count = page.locator('.page-bar').getByText(/^\d+ of \d+ disciplines$/)
  await expect(count).toBeVisible()
  await expect(page.getByRole('cell', { name: '25 m / 25 yd' }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Federation: BDMP' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Distance: 25 yd' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(page).not.toHaveURL(/org=|dist=/)
  await expect(page.getByRole('button', { name: 'Clear all' })).toHaveCount(0)
})

test('a federation record links to the discipline list filtered to it, and no match offers Clear filters', async ({
  page,
}) => {
  await gotoHydrated(page, '/federations/dsb')
  await page.getByRole('link', { name: 'In the discipline list' }).click()
  await expect(page).toHaveURL(/\/disciplines\/?\?org=DSB/)
  await expect(page.getByRole('button', { name: 'Federation: DSB' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search' }).fill('zzzz')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(
    page.locator('.directory-filters').getByRole('button', { name: 'Federation', exact: true }),
  ).toBeVisible()
})
