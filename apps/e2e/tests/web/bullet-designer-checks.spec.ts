import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'

// The bullet designer's soft checks: a refusal writes its lengths in the page unit, a value far
// outside a bullet's asks to check the unit without blocking, and the photograph dialog is narrow.

test('a refusal writes its lengths in inches on an inch page', async ({ page }) => {
  await storeUnits(page, 'us')
  await gotoHydrated(page, '/bullets/designer')
  const length = page.getByRole('textbox', { name: /^L Length \(in\)$/ })
  const nose = page.getByRole('textbox', { name: /Nose length \(in\)$/ })
  await nose.fill('0.63')
  await length.fill('0.2')
  await expect(page.getByText(/nose length \.6300 in is above the length/).first()).toBeVisible()
})

test('a diameter far outside a bullet asks to check the unit and still draws', async ({ page }) => {
  await storeUnits(page)
  await gotoHydrated(page, '/bullets/designer')
  const diameter = page.getByRole('textbox', { name: /Diameter \(mm\)$/ })
  await diameter.fill('180')
  await expect(diameter).toHaveAccessibleDescription(/^Check the unit\./)
  await expect(diameter).not.toHaveAttribute('aria-invalid', 'true')
  await diameter.fill('7.82')
  await expect(diameter).not.toHaveAccessibleDescription(/Check the unit/)
})

test('a hollow base offers the cavity depth, its radius assumed while empty', async ({ page }) => {
  await storeUnits(page)
  await gotoHydrated(page, '/bullets/designer')
  await page.getByRole('textbox', { name: /Diameter \(mm\)$/ }).fill('9')
  await page.getByRole('combobox', { name: 'Base type' }).selectOption('conical-hollow-base')
  await page.getByRole('textbox', { name: /Cavity diameter \(mm\)$/ }).fill('5')
  const depth = page.getByRole('textbox', { name: /Cavity depth \(mm\)$/ })
  await expect(depth).toHaveAccessibleDescription(/Assumed: 2\.50? mm \(0\.5 dc\)/)
  await depth.fill('4')
  await expect(depth).not.toHaveAccessibleDescription(/Assumed/)
})

test('the photograph dialog is about 34 rem wide until a photograph is loaded', async ({
  page,
}) => {
  await storeUnits(page)
  await page.setViewportSize({ width: 1280, height: 650 })
  await gotoHydrated(page, '/bullets/designer')
  await page.getByRole('button', { name: 'From a photo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bullet from a photograph' })
  await expect(dialog.getByRole('button', { name: 'Try a sample' })).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box?.width).toBeLessThanOrEqual(34 * 16 + 1)
  // with a photograph the canvas and its controls get the room
  await dialog.getByRole('button', { name: 'Try a sample' }).click()
  await expect(dialog.getByText(/^Scale \d+\.\d+ px\/mm/)).toBeVisible({ timeout: 30_000 })
  expect((await dialog.boundingBox())?.width).toBeGreaterThan(60 * 16)
})
