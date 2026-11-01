import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('the case list opens a case record with its cartridge', async ({ page }) => {
  await gotoHydrated(page, '/cases')
  await page.getByRole('link', { name: /308 Win\. Brass Demo/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('308 Win. Brass Demo')
  // the cartridge is a card of the fact row, linked
  await expect(page.locator('.fact-cards').getByRole('link', { name: '308 Win.' })).toHaveAttribute(
    'href',
    '/cartridges/308-win/',
  )
  // the properties as Quantity, Value and Unit (no drawing, so no Symbol column), across the page
  const properties = page.getByRole('table', { name: 'Properties' })
  await expect(properties.locator('thead').getByRole('columnheader')).toHaveText([
    'Quantity',
    'Value',
    'Unit',
  ])
  await expect(
    properties.getByRole('row').filter({ hasText: 'Flash hole diameter' }).getByRole('cell'),
  ).toHaveText([/^2(\.0+)?$/, 'mm'])
  const [main, panel] = await Promise.all([
    page.locator('.record-grid').boundingBox(),
    page.locator('#record-data').boundingBox(),
  ])
  expect(panel?.width).toBeGreaterThan((main?.width ?? 0) * 0.95)
})

test('a primer record shows its properties as Quantity, Value and Unit across the page', async ({
  page,
}) => {
  await page.goto('/primers/demo-primer-large-rifle')
  const properties = page.getByRole('table', { name: 'Properties' })
  await expect(properties.locator('thead').getByRole('columnheader')).toHaveText([
    'Quantity',
    'Value',
    'Unit',
  ])
  await expect(
    properties.getByRole('row').filter({ hasText: 'Cup thickness' }).getByRole('cell'),
  ).toHaveText([/^0\.50?$/, 'mm'])
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
