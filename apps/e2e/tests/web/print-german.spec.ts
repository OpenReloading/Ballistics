import { expect, type Page, test } from '@playwright/test'
import { showGerman } from './german.ts'
import { storeUnits } from './units.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** English words of the pages' own text that the German print must not keep. */
const english = /\b(Printed|Step|Rounds|Loaded|Result|Barrel length|At the range|Notes)\b/

/** The width of the content beyond its box, px: 0 when nothing overflows. */
const overflow = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    Math.max(
      0,
      ...els.map((el) => {
        const e = el as HTMLElement
        return e.scrollWidth - e.clientWidth
      }),
    ),
  )

test('the report and the load sheets print in German and stay inside the page', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await runExample(page)
  await showGerman(page)
  await expect(page.getByRole('tab', { name: 'Ladeleiter-Tabelle', exact: true })).toBeVisible()
  await page.emulateMedia({ media: 'print' })

  // the report on A4 portrait (96 dpi)
  await page.setViewportSize({ width: 794, height: 1123 })
  const report = page.locator('.print-report')
  await expect(report).toBeVisible()
  await expect(report.getByRole('heading', { name: 'Ergebnis' }).first()).toBeVisible()
  await expect(report).toContainText('Gedruckt am')
  await expect(report).toContainText('Lauflänge')
  await expect(report).toContainText('Treibladungspulver und Ladung')
  expect(await report.innerText()).not.toMatch(english)
  expect(await overflow(page, '.print-report, .print-report table')).toBe(0)

  // the load sheets: the overview on A4 landscape, a page per charge on portrait
  await page.evaluate(() => {
    document.documentElement.dataset.print = 'sheets-steps'
  })
  await page.setViewportSize({ width: 1123, height: 794 })
  const overview = page.locator('.load-sheet:not(.step)')
  await expect(overview).toBeVisible()
  await expect(overview).toContainText('Gedruckt am')
  await expect(overview).toContainText('Streukreis')
  expect(await overview.innerText()).not.toMatch(english)
  expect(await overflow(page, '.load-sheet:not(.step), .load-sheet:not(.step) table')).toBe(0)

  await page.setViewportSize({ width: 794, height: 1123 })
  const step = page.locator('.load-sheet.step').first()
  await expect(step).toContainText('Auf dem Schießstand')
  await expect(step).toContainText('Druckanzeichen')
  expect(await step.innerText()).not.toMatch(english)
  expect(await overflow(page, '.load-sheet.step, .load-sheet.step table')).toBe(0)
})
