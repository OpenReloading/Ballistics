import { expect, type Page, test } from '@playwright/test'
import { cutText } from './cut.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

// the text spacing of WCAG 1.4.12 on every element, as its test method applies it: nothing may be
// cut, the page and the inputs column may scroll
const spacing = `* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-bottom: 2em !important; }`

// record names and the load title keep their ellipsis, with the full text on hover; the page bar's
// status and the text of the two charts are open findings (A-14, A-15 of the accessibility page)
const names =
  '.load-switch, .load-identity, [role=combobox], .page-bar-status, .interior-chart .echart, .vivacity-chart .echart'

// below 75em the title has two lines in the app header, an open finding (A-11)
const phone = `${names}, main .page-bar h1`

/** Applies the spacing and expects nothing cut once the layout has settled. */
async function nothingCut(page: Page, exempt = names) {
  await page.addStyleTag({ content: spacing })
  await expect.poll(() => cutText(page, exempt)).toEqual([])
}

for (const width of [1280, 390])
  test(`at ${width} px the workbench after the example run cuts nothing with the spacing`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width, height: 800 })
    await runExample(page)
    await nothingCut(page)
    if (width === 390) {
      await page.getByRole('tab', { name: 'Results', exact: true }).click()
      await expect.poll(() => cutText(page, names)).toEqual([])
    }
  })

for (const width of [1280, 390])
  test(`at ${width} px the shot groups cut nothing with the spacing`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await gotoHydrated(page, '/groups')
    // below 48em the group's fields are behind a tab
    if (width === 1280)
      for (const axis of ['x', 'y']) await page.getByLabel(`Point of aim ${axis}`).fill('-12.5')
    await nothingCut(page)
  })

for (const path of ['/bullets/designer', '/powders/designer', '/targets/designer'])
  test(`at 320 px ${path} cuts nothing with the spacing`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await gotoHydrated(page, path)
    await nothingCut(page, phone)
  })

// a cartridge with a long name and one with many aliases
for (const id of ['6mm-me-flobert-court', '22-long-rifle'])
  for (const width of [1280, 320])
    test(`at ${width} px the record page of ${id} cuts nothing with the spacing`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await gotoHydrated(page, `/cartridges/${id}`)
      await nothingCut(page, width === 320 ? phone : names)
    })
