import { expect, type Page, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** The width the result chart is drawn at, px: its SVG's, not its box's, which keeps the panel width. */
const drawn = (page: Page) =>
  page
    .locator('.plain-chart .echart [role="img"] svg')
    .evaluate((svg) => Number(svg.getAttribute('width')))

test('the result chart returns to the panel width after printing', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await runExample(page)
  await expect(page.locator('.plain-chart .echart svg')).toBeVisible()
  const before = await drawn(page)
  // wider than the print width, so the print draws it narrower
  expect(before).toBeGreaterThan(680)

  // the print dialog: `beforeprint` draws at the print width, and `afterprint` comes while the print
  // layout still hides the panel, with no frame between in which the box could be seen to change
  await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.plain-chart')
    if (!panel) throw new Error('no result chart')
    dispatchEvent(new Event('beforeprint'))
    panel.style.display = 'none'
    dispatchEvent(new Event('afterprint'))
    panel.style.display = ''
  })
  await expect.poll(() => drawn(page)).toBe(before)

  // the print preview: print media, then screen media again
  await page.emulateMedia({ media: 'print' })
  await page.emulateMedia({ media: 'screen' })
  await expect.poll(() => drawn(page)).toBe(before)
})
