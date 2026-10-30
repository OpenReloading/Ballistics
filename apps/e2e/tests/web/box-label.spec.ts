import { expect, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { showGerman } from './german.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** The label in each language: German row names are longer, the label must still hold them. */
const languages = [
  { name: 'English', button: /^Print a box label of /, lot: 'Primer lot' },
  { name: 'German', button: /^Schachtel-Etikett von .* drucken$/, lot: 'Zündhütchen-Los' },
]

for (const language of languages)
  test(`a saved load prints its box label of 90 x 60 mm with the QR code on A4 in ${language.name}`, async ({
    page,
  }, testInfo) => {
    // neither dialog can be driven: the file goes to the origin private file system, and the page
    // stays in its print state
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
        (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
      window.print = () => {}
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoHydrated(page, '/workbench')
    await applyExampleLoad(page)
    // every lot typed: the tallest label
    for (const [lot, text] of [
      ['Powder lot', 'P-2026-0412-A'],
      ['Primer lot', 'Z-778341'],
      ['Case lot', 'H-19-2203'],
    ])
      await page.getByLabel(lot, { exact: true }).first().fill(text)
    await (await barButton(page, 'Save')).click()
    await expect(page.locator('.file-state')).toContainText('Saved')
    await (await barButton(page, 'Open')).click()
    await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
    const drawer = page.getByRole('dialog', { name: 'Saved loads' })
    await expect(drawer).toBeVisible()
    if (language.name === 'German') await showGerman(page)
    await page.getByRole('button', { name: language.button }).click()

    const label = page.locator('.box-labels .box-label')
    await expect(label).toHaveCount(1)
    await page.emulateMedia({ media: 'print' })
    // A4 portrait at 96 dpi
    await page.setViewportSize({ width: 794, height: 1123 })
    await expect(label).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`box-label-a4-${language.name}.png`) })
    await expect(label).toContainText('COAL')
    await expect(label).toContainText(language.lot)
    await expect(label).toContainText('H-19-2203')
    await expect(label.locator('.box-label-code')).toContainText(/^OR1:L:[0-9a-f-]{36}$/)
    const box = await label.boundingBox()
    // 90 x 60 mm, 96 px per inch
    expect(box?.width).toBeCloseTo((90 / 25.4) * 96, 0)
    expect(box?.height).toBeCloseTo((60 / 25.4) * 96, 0)
    expect(
      await label.evaluate(
        (el) => el.scrollWidth - el.clientWidth + el.scrollHeight - el.clientHeight,
      ),
    ).toBe(0)
  })
