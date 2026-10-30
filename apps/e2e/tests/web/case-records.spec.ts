import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('the case list opens a case record with its cartridge', async ({ page }) => {
  await gotoHydrated(page, '/cases')
  await page.getByRole('link', { name: /308 Win\. Brass Demo/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('308 Win. Brass Demo')
  await expect(page.getByRole('link', { name: '308 Win.' })).toHaveAttribute(
    'href',
    '/cartridges/308-win/',
  )
})

test('a case record chosen above the cards gives the stated capacity, a typed one replaces it', async ({
  page,
}) => {
  await gotoHydrated(page, '/workbench?cartridge=308-win')
  const capacity = loadForm(page).getByRole('textbox', { name: /^Case capacity/ })
  await expect(capacity).not.toHaveAttribute('placeholder', /\d/)
  await page.getByRole('combobox', { name: 'Brass record' }).click()
  await page.getByRole('option', { name: 'Demo Cases 308 Win. Brass Demo' }).click()
  await expect(capacity).toHaveAttribute('placeholder', /^\d/)
  await capacity.fill('3.9')
  await expect(capacity).toHaveValue('3.9')
})
