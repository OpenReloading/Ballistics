import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('on a phone Run is one shown button and the form keeps no hidden focus stop for it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await gotoHydrated(page, '/workbench')
  await applyExampleLoad(page)
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
