import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'

// WCAG 2.4.3: a dialog, drawer or card that held the focus leaves it on a control, never on the page.
test.beforeEach(({ page }) => storeUnits(page))

const widths = [1280, 390]

/** The page bar's own button where the bar shows its actions, else Page actions, which opens them. */
const way = (page: Page, wide: number, name: string) =>
  page
    .getByRole('button', {
      name: page.viewportSize()?.width === wide ? name : 'Page actions',
      exact: true,
    })
    .locator('visible=true')

test('choosing a cartridge on the start card leaves the focus in the load form', async ({
  page,
}) => {
  await gotoHydrated(page, '/workbench')
  await page.getByRole('button', { name: '308 Win.' }).first().click()
  await expect(loadForm(page)).toBeVisible()
  await expect(loadForm(page).locator(':focus')).toHaveCount(1)
})

test('the example load on the start card leaves the focus in the load form', async ({ page }) => {
  await gotoHydrated(page, '/workbench')
  await page.getByRole('button', { name: 'Try the example load' }).click()
  await expect(loadForm(page)).toBeVisible()
  await expect(loadForm(page).locator(':focus')).toHaveCount(1)
})

for (const width of widths) {
  test(`Escape closes Saved loads and the focus goes back to the page bar at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await gotoHydrated(page, '/workbench')
    await (await barButton(page, 'Open')).click()
    await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
    await expect(page.getByRole('dialog', { name: 'Saved loads' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Saved loads' })).toBeHidden()
    await expect(way(page, 1280, 'Open')).toBeFocused()
  })

  test(`Escape closes the photo tool and the focus goes back to its opener at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await gotoHydrated(page, '/bullets/designer')
    // below 75em the designer's toolbar is in the Page actions panel
    if (width < 1280) await page.getByRole('button', { name: 'Page actions' }).click()
    await page.getByRole('button', { name: 'From a photo' }).click()
    await expect(page.getByRole('dialog', { name: 'Bullet from a photograph' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Bullet from a photograph' })).toBeHidden()
    await expect(way(page, 1280, 'From a photo')).toBeFocused()
  })
}
