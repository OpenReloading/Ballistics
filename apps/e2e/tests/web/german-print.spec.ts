import { expect, type Page, test } from '@playwright/test'
import { showGerman } from './german.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

const px = (mm: number) => Math.floor((mm * 96) / 25.4)

/**
 * Prints `part` alone at the width of its paper's text area and gives what overflows: a cell whose
 * text is wider than the cell, or a part wider than the page.
 */
async function overflow(
  page: Page,
  part: string,
  mode: string | undefined,
  widthMm: number,
  paper?: string,
) {
  await page.setViewportSize({ width: px(widthMm), height: 900 })
  await page.evaluate(
    ([m, p]) => {
      if (m) document.documentElement.dataset.print = m
      if (p) document.querySelector('.range-card')?.setAttribute('data-paper', p)
    },
    [mode, paper],
  )
  await page.emulateMedia({ media: 'print' })
  const root = page.locator(part).first()
  await expect(root).toBeVisible()
  return root.evaluate((el) => {
    const cut = [...el.querySelectorAll('th, td')]
      .filter((c) => c.scrollWidth > c.clientWidth + 1)
      .map((c) => c.textContent?.slice(0, 40))
    return { cut, wide: el.scrollWidth - document.documentElement.clientWidth }
  })
}

test('the workbench prints in German without a cut cell or a part wider than its page', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await runExample(page)
  await showGerman(page)
  await page.getByRole('tab', { name: 'Flugbahn', exact: true }).click()
  // text area of each sheet: the paper less its margins
  const parts = [
    ['.load-sheets', 'sheets', 277, undefined],
    ['.load-sheets .load-sheet.step', 'sheets-steps', 190, undefined],
    ['.range-card', 'range-card', 138, 'a6'],
    ['.range-card', 'range-card', 196, 'a5'],
    ['.range-card', 'range-card', 186, 'a4'],
  ] as const
  for (const [part, mode, width, paper] of parts) {
    const found = await overflow(page, part, mode, width, paper)
    expect(found.cut, `${part} ${paper}`).toEqual([])
    expect(found.wide, `${part} ${paper}`).toBeLessThanOrEqual(1)
    await page.evaluate(() => delete document.documentElement.dataset.print)
  }
  // the report: Ctrl+P prints it while the workbench shows
  const report = await overflow(page, '.print-report', undefined, 190)
  expect(report.cut).toEqual([])
  expect(report.wide).toBeLessThanOrEqual(1)
  await expect(page.locator('.print-report')).toContainText('Gedruckt am')
  await expect(page.locator('.print-report')).not.toContainText('Printed')
})

test('the session summary prints in German without a cut cell', async ({ page }) => {
  await gotoHydrated(page, '/session')
  await page.getByLabel('Chronograph file').setInputFiles({
    name: 'session.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      ['string,velocity,velocityUnit', 'A,2795,fps', 'A,2810,fps', 'B,2831,fps'].join('\n'),
    ),
  })
  await showGerman(page)
  await page.setViewportSize({ width: px(190), height: 1000 })
  await page.emulateMedia({ media: 'print' })
  const table = page.getByRole('table', { name: /^Statistik je Schussreihe/ })
  await expect(table).toBeVisible()
  const region = page.locator('.scroll', { has: table })
  expect(await region.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    px(190),
  )
})
