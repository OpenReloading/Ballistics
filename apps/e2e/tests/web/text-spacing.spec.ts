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

// record names, the load title and the page bar's status line keep their ellipsis, with the full
// text on hover, focus and tap
const names = '.load-switch, .load-identity, [role=combobox], .page-bar-status'

/** Applies the spacing and expects nothing cut once the layout has settled. */
async function nothingCut(page: Page) {
  await page.addStyleTag({ content: spacing })
  await expect.poll(() => cutText(page, names)).toEqual([])
}

for (const width of [1280, 390])
  test(`at ${width} px the workbench after the example run cuts nothing with the spacing`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width, height: 800 })
    await runExample(page)
    await nothingCut(page)
    // the status line's whole text is its tooltip on focus
    const line = page.locator('.page-bar-status')
    const whole = await line.evaluate((box) =>
      Array.from(box.querySelectorAll('*'))
        .filter((e) => e.childElementCount === 0)
        .map((e) => e.textContent?.trim())
        .filter(Boolean)
        .join(' '),
    )
    // reached by the keyboard: a tooltip opens on visible focus, not on a script's focus after a click
    await line.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(line).toBeFocused()
    await expect(page.getByRole('tooltip')).toHaveText(whole)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toBeHidden()
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

// the longer German labels and buttons in the group panel's column
test('at 1280 px the shot groups in German cut nothing with the spacing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('language', 'de'))
  await page.setViewportSize({ width: 1280, height: 800 })
  await gotoHydrated(page, '/groups')
  for (const input of await page.locator('.aim-fields input').all()) await input.fill('-12,5')
  await nothingCut(page)
  // the panel scrolls, so a field past its edge counts as scrolled: it holds its rows instead
  for (const side of await page.locator('.target-side').all())
    expect(await side.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
})

for (const path of ['/bullets/designer', '/powders/designer', '/targets/designer'])
  test(`at 320 px ${path} cuts nothing with the spacing`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await gotoHydrated(page, path)
    await nothingCut(page)
  })

// a long German compound in the page bar's title at the narrowest width
test('at 320 px the German designers cut nothing with the spacing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('language', 'de'))
  await page.setViewportSize({ width: 320, height: 800 })
  for (const path of ['/bullets/designer', '/powders/designer', '/targets/designer']) {
    await gotoHydrated(page, path)
    await nothingCut(page)
  }
})

// a cartridge with a long name and one with many aliases
for (const id of ['6mm-me-flobert-court', '22-long-rifle'])
  for (const width of [1280, 320])
    test(`at ${width} px the record page of ${id} cuts nothing with the spacing`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await gotoHydrated(page, `/cartridges/${id}`)
      await nothingCut(page)
    })
