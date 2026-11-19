import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'

// The bullet list's filters by construction, tip and base, kept in the URL, and its picks for Compare; the filter values, counts and the leaving out of a one-value filter are Vitest tests (`apps/web/test/directory.test.ts`).
test('a bullet list filtered by tip and base narrows the list, survives a reload and clears', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets')
  const filters = page.locator('.directory-filters')
  // the mounted count: a streamed copy not yet revealed holds the same text without the role
  const count = page.locator('.page-bar-status [role="status"]')
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
  await expect(page.getByRole('checkbox', { name: /^Cup and core\s*\d+$/ })).toBeVisible()
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

for (const { list, width, query, pick, shownLabel, hiddenLabels } of [
  {
    list: 'bullets',
    width: 390,
    query: '168',
    pick: 'demo-bullet-224-55,demo-bullet-150,demo-bullet-168',
    shownLabel: /30 Cal 168 gr HPBT Demo/,
    hiddenLabels: [/22 Cal 55 gr FMJ Boat Tail Demo/, /30 Cal 150 gr Flat Base Demo/],
  },
  {
    list: 'bullets',
    width: 1280,
    query: '168',
    pick: 'demo-bullet-224-55,demo-bullet-150,demo-bullet-168',
    shownLabel: /30 Cal 168 gr HPBT Demo/,
    hiddenLabels: [/22 Cal 55 gr FMJ Boat Tail Demo/, /30 Cal 150 gr Flat Base Demo/],
  },
  {
    list: 'powders',
    width: 390,
    query: 'dp40',
    pick: 'demo-powder-dp15,demo-powder-dp70,demo-powder-dp40',
    shownLabel: /DP40/,
    hiddenLabels: [/DP15/, /DP70/],
  },
]) {
  test(`at ${width} px the ${list} the search hides are listed under "hidden" and unticked there (#866)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await gotoHydrated(page, `/${list}?q=${query}&pick=${pick}`)
    const bar = page.locator('.page-bar')
    const status = bar.locator('.page-bar-status')
    await expect(status.getByText('3 selected (max', { exact: false })).toBeVisible()
    const hidden = status.getByRole('button', { name: '2 hidden' })
    // inside the status line, which clips what does not fit
    const [line, button] = await Promise.all([status.boundingBox(), hidden.boundingBox()])
    expect(button && line && button.x + button.width <= line.x + line.width).toBe(true)
    await hidden.click()
    const dialog = page.getByRole('dialog', { name: 'Hidden by the search or a filter' })
    await expect(dialog.getByRole('listitem')).toHaveText(hiddenLabels)
    await dialog
      .getByRole('button', { name: /^Untick / })
      .first()
      .click()
    await expect(status.getByText('2 selected (max', { exact: false })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`[?&]pick=${pick.split(',').slice(1).join('(%2C|,)')}`))
    // the focus goes to the untick now in its place
    await expect(dialog.getByRole('button', { name: /^Untick / })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(status.getByText('1 selected (max', { exact: false })).toBeVisible()
    await expect(status.getByRole('button', { name: /hidden$/ })).toHaveCount(0)
    await expect(page.getByRole('checkbox', { name: shownLabel })).toBeChecked()
    await expect(page.getByRole('searchbox', { name: 'Search' })).toBeFocused()
  })
}
