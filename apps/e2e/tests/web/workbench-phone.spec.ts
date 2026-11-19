import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { loadForm, openSavedLoad } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('on a phone Run is one shown button and the form keeps no hidden focus stop for it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await gotoHydrated(page, '/workbench')
  await openSavedLoad(page)
  await expect(page.getByRole('button', { name: 'Run simulation' })).toHaveCount(1)
  await expect(loadForm(page).locator('.run-bar')).toBeHidden()

  // the Tab key reaches the one Run button, and what it focuses is on the screen
  const run = page.getByRole('button', { name: 'Run simulation' })
  await run.focus()
  const box = await run.boundingBox()
  expect(box?.x).toBeGreaterThanOrEqual(0)
  expect(box?.width).toBeGreaterThanOrEqual(44)
  expect(box?.height).toBeGreaterThanOrEqual(44)
  await expect(run).toBeInViewport({ ratio: 1 })
})

// the row's choices open above it, so with the row at the top of the Load panel they open out of view
test('on a phone Primer, brass, lots opens in view from the top of the Load panel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, '/workbench')
  await openSavedLoad(page)
  await page.getByRole('tab', { name: 'Load' }).click()
  const keeping = loadForm(page).locator('details.keeping')
  await keeping.locator('summary').evaluate((e) => e.scrollIntoView({ block: 'start' }))
  await keeping.locator('summary').click()
  // a tap at the first field's center reaches the field
  const first = keeping.locator('.keeping-fields input').first()
  await expect
    .poll(() =>
      first.evaluate((e) => {
        const r = e.getBoundingClientRect()
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === e
      }),
    )
    .toBe(true)
})
