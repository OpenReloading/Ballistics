import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('a bullet record lists the cartridges it fits, linked', async ({ page }) => {
  await gotoHydrated(page, '/bullets/demo-bullet-168')
  const list = page.getByRole('list', { name: 'Cartridges' })
  await expect(list.getByRole('link', { name: '308 Win.', exact: true })).toHaveAttribute(
    'href',
    '/cartridges/308-win/',
  )
  await expect(page.getByRole('table', { name: 'Ballistic coefficients' })).toContainText('G7')
  // the symbol keys move over the rows the group filter shows only
  const data = page.getByRole('table', { name: 'Bullet data' })
  await page
    .getByRole('radiogroup', { name: 'Bullet data: group' })
    .getByText('Size', { exact: true })
    .click()
  await expect(data.locator('tr:not([data-off]) [tabindex]')).toHaveCount(2)
  await data.locator('[tabindex="0"]').focus()
  await page.keyboard.press('End')
  await expect(data.locator('tr:not([data-off]) [tabindex]').last()).toBeFocused()
})

test('a cartridge record links the bullet list of the bullets that fit it, the rule on hover; none for a cartridge without', async ({
  page,
}) => {
  await page.goto('/cartridges/308-win')
  const link = page.getByRole('link', { name: /^Bullets \(\d+\)$/ })
  await expect(link).toHaveAttribute('href', '/bullets/?fits=308-win')
  await link.focus()
  await expect(page.getByRole('tooltip')).toContainText('over the middle of the land and groove')
  const count = Number((await link.innerText()).match(/\d+/)?.[0])
  await link.click()
  await expect(page).toHaveURL(/\/bullets\/\?fits=308-win$/)
  await expect(page.getByRole('link', { name: '30 Cal 168 gr HPBT Demo' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Bullets, fitting 308 Win.' })).toBeVisible()
  // "n of m bullets", or "n bullets" where every bullet fits
  await expect(page.locator('.page-bar-status [role="status"]')).toHaveText(
    new RegExp(`^${count}( of \\d+)? bullets$`),
  )
  await page.goto('/cartridges/223-rem')
  await expect(page.getByRole('heading', { name: 'Chamber' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Bullets \(/ })).toHaveCount(0)
})
