import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'

// The bullet list's filters by construction, tip and base, kept in the URL, and its picks for
// Compare. The filter values, counts and the leaving out of a one-value filter are Vitest tests
// (`apps/web/test/directory.test.ts`).
test('a bullet list filtered by tip and base narrows the list, survives a reload and clears', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets')
  const filters = page.locator('.directory-filters')
  const count = page.locator('.page-bar').getByText(/^\d[\d,]* (of [\d,]+ )?bullets$/)
  const total = await count.textContent()
  await filters.getByRole('button', { name: 'Tip', exact: true }).click()
  // each option counts the rows it leaves
  const hollow = page.getByRole('checkbox', { name: /^Hollow point\s*\d+$/ })
  await hollow.check()
  await page.keyboard.press('Escape')
  await filters.getByRole('button', { name: 'Base type', exact: true }).click()
  await page.getByRole('checkbox', { name: /^Boat tail\s*\d+$/ }).check()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/tip=hollow-point.*base=boat-tail/)
  await expect(count).toHaveText(/^\d[\d,]* of [\d,]+ bullets$/)
  await expect(count).not.toHaveText(total ?? '')
  await expect(page.getByRole('cell', { name: 'Hollow point, boat tail' }).first()).toBeVisible()
  // every catalogue bullet whose lead-free status is known contains lead: no filter of one value
  await expect(filters.getByRole('button', { name: /^Lead-free/ })).toHaveCount(0)

  await page.reload()
  await expect(filters.getByRole('button', { name: 'Tip: Hollow point' })).toBeVisible()
  await expect(filters.getByRole('button', { name: 'Base type: Boat tail' })).toBeVisible()
  await expect(count).toHaveText(/^\d[\d,]* of [\d,]+ bullets$/)

  await filters.getByRole('button', { name: 'Construction', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /^Lead core\s*\d+$/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await filters.getByRole('button', { name: 'Clear all' }).click()
  await expect(page).not.toHaveURL(/tip=|base=/)
  await expect(count).toHaveText(total ?? '')
})

test('picking bullets keeps the page bar and Compare in place and names the count only', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  await gotoHydrated(page, '/bullets?q=demo')
  const bar = page.locator('.page-bar')
  // a button below two picks, a link from two
  const compare = bar
    .getByRole('button', { name: /^Compare/ })
    .or(bar.getByRole('link', { name: /^Compare/ }))
  const place = async () => {
    const [b, c] = await Promise.all([bar.boundingBox(), compare.boundingBox()])
    return [b?.height, c?.x, c?.width]
  }
  const before = await place()
  const boxes = page.getByRole('checkbox', { name: /^Select Demo Bullets / })
  await boxes.first().click()
  await expect(bar.getByText('1 selected (max 4)')).toBeVisible()
  expect(await place()).toEqual(before)
  await compare.hover()
  await expect(page.getByRole('tooltip', { name: 'Pick 2 to 4' })).toBeVisible()
  await boxes.last().click()
  await expect(bar.getByText('2 selected (max 4)')).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Compare 2' })).toBeVisible()
  expect(await place()).toEqual(before)
  // no chips naming the picks: the ticked rows show them
  await expect(bar.getByRole('list')).toHaveCount(0)
  await bar.getByRole('button', { name: 'Clear selection' }).click()
  await expect(bar.getByText(/selected/)).toHaveCount(0)
  expect(await place()).toEqual(before)
})

test("a phone's page bar keeps its height with picks", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, '/bullets?q=demo')
  const bar = page.locator('.page-bar')
  const height = async () => (await bar.boundingBox())?.height
  const before = await height()
  const boxes = page.getByRole('checkbox', { name: /^Select Demo Bullets / })
  await boxes.first().click()
  await expect(bar.getByText('1 selected (max 4)')).toBeVisible()
  expect(await height()).toBe(before)
  await boxes.last().click()
  await expect(bar.getByText('2 selected (max 4)')).toBeVisible()
  expect(await height()).toBe(before)
})
