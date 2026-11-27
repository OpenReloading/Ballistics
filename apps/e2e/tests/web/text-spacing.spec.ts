import { expect, type Page, test } from '@playwright/test'
import { cutText } from './cut.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { loadForm, openSavedLoad } from './workbench.ts'
import { runSavedLoad, runSettled } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

// the text spacing of WCAG 1.4.12 on every element, as its test method applies it: nothing may be cut, the page and the inputs column may scroll
const spacing = `* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-bottom: 2em !important; }`

// record names, the load title and the page bar's status line keep their ellipsis, with the full text on hover, focus and tap
const names = '.load-switch, .load-identity, [role=combobox], .page-bar-status'

/** Applies the spacing and expects nothing cut once the layout has settled. */
async function nothingCut(page: Page) {
  await page.addStyleTag({ content: spacing })
  await expect.poll(() => cutText(page, names)).toEqual([])
}

for (const width of [1280, 390])
  test(`at ${width} px the workbench after the fixture load run cuts nothing with the spacing`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width, height: 800 })
    await runSavedLoad(page)
    await nothingCut(page)
    // the status line's whole text is its tooltip on focus
    const line = page.locator('.page-bar-status')
    const whole = await line.evaluate((box) =>
      Array.from(box.querySelectorAll('*'))
        .filter((e) => e.childElementCount === 0)
        .map((e) => e.getAttribute('data-full') ?? e.textContent?.trim())
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

// the short desktop frame gives the input cards and the readouts the least room; the Powder card's title ends in an ellipsis by design and the page bar has the spacing test above
for (const language of ['en', 'de'] as const)
  test(`at 1280 x 650 the ${language} workbench cards and readouts cut and overlap nothing with the spacing`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    if (language === 'de')
      await page.addInitScript((store) => localStorage.setItem(store, 'de'), 'language')
    await page.setViewportSize({ width: 1280, height: 650 })
    await gotoHydrated(page, '/workbench')
    await openSavedLoad(page, language)
    await loadForm(page, language === 'de' ? 'Laborierung' : 'Load')
      .getByLabel(language === 'de' ? /^Ladungsmasse/ : /^Charge mass/)
      .press('Control+Enter')
    await expect(page.locator('.results-head .readout-list')).toBeVisible({ timeout: 15_000 })
    await runSettled(page)
    await page.addStyleTag({ content: spacing })
    await expect.poll(() => cutText(page, `${names}, .panel-title, .page-bar`)).toEqual([])
    // no readout's label, value or unit runs into another's
    const overlaps = () =>
      page.locator('.results-head .readout-list').evaluate((list) => {
        const boxes = [...list.querySelectorAll('dt, dd')]
          .filter((e) => e.checkVisibility() && e.getBoundingClientRect().width > 1)
          .map((e) => ({ text: e.textContent, r: e.getBoundingClientRect() }))
        return boxes.flatMap((a, i) =>
          boxes
            .slice(i + 1)
            .filter(
              ({ r }) =>
                Math.min(a.r.right, r.right) - Math.max(a.r.left, r.left) > 0.5 &&
                Math.min(a.r.bottom, r.bottom) - Math.max(a.r.top, r.top) > 0.5,
            )
            .map((b) => `${a.text} / ${b.text}`),
        )
      })
    await expect.poll(overlaps).toEqual([])
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
  await page.addInitScript((store) => localStorage.setItem(store, 'de'), 'language')
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
  await page.addInitScript((store) => localStorage.setItem(store, 'de'), 'language')
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
