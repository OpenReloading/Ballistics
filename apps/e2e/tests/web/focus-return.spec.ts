import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { showGerman } from './german.ts'
import { pickFiles, withoutOpenPicker } from './import.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'

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
  await gotoHydrated(page, '/workbench/')
  await page.getByRole('button', { name: '308 Win.' }).first().click()
  await expect(loadForm(page)).toBeVisible()
  await expect(loadForm(page).locator(':focus')).toHaveCount(1)
})

test('the example load on the start card leaves the focus in the load form', async ({ page }) => {
  await gotoHydrated(page, '/workbench/')
  await page.getByRole('button', { name: 'Try the example load' }).click()
  await expect(loadForm(page)).toBeVisible()
  await expect(loadForm(page).locator(':focus')).toHaveCount(1)
})

test('a saved load that opens by itself on arrival leaves the focus on the page', async ({
  page,
}) => {
  // a native picker cannot be driven: the file goes to the origin private file system
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })
  await gotoHydrated(page, '/workbench/')
  await applyExampleLoad(page)
  await (await barButton(page, 'Save')).click()
  await expect(page.locator('.file-state')).toContainText('Saved')
  await page.reload()
  await expect(loadForm(page)).toBeVisible()
  // the focus moves in the frame after the cards replace the start card
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  )
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
})

test('Escape closes Saved loads opened from the load switcher and the focus goes back to it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, '/workbench/')
  const switcher = page.getByRole('button', { name: /switch load/ })
  await switcher.click()
  await page.getByRole('button', { name: 'Saved loads' }).click()
  await expect(page.getByRole('dialog', { name: 'Saved loads' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Saved loads' })).toBeHidden()
  await expect(switcher).toBeFocused()
})

for (const width of widths) {
  test(`Escape closes Saved loads and the focus goes back to the page bar at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await gotoHydrated(page, '/workbench/')
    await (await barButton(page, 'Open')).click()
    await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
    await expect(page.getByRole('dialog', { name: 'Saved loads' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Saved loads' })).toBeHidden()
    await expect(way(page, 1280, 'Open')).toBeFocused()
  })

  test(`Escape closes the Import entry and the focus goes back to the page bar at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await withoutOpenPicker(page)
    await gotoHydrated(page, '/bullets/designer')
    const entry = await pickFiles(page, [{ name: 'notes.txt', buffer: Buffer.from('no table') }])
    await expect(entry).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(entry).toBeHidden()
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

test('in German, Escape closes Saved loads and the focus goes back to Page actions at 390 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await gotoHydrated(page, '/workbench/')
  await showGerman(page)
  await (await barButton(page, 'Öffnen', 'Seitenaktionen')).click()
  await page.getByRole('menuitem', { name: /^Gespeicherte Laborierungen/ }).click()
  await expect(page.getByRole('dialog', { name: 'Gespeicherte Laborierungen' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Gespeicherte Laborierungen' })).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Seitenaktionen', exact: true }).locator('visible=true'),
  ).toBeFocused()
})
