import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'

// The bullet designer's soft checks: a refusal writes its lengths in the page unit, a value far outside a bullet's asks to check the unit without blocking, and the photograph dialog is narrow.

test('a refusal writes its lengths in inches on an inch page', async ({ page }) => {
  await storeUnits(page, 'us')
  await gotoHydrated(page, '/bullets/designer')
  const length = page.getByRole('textbox', { name: /^L Length \(in\)$/ })
  const nose = page.getByRole('textbox', { name: /Nose length \(in\)$/ })
  await nose.fill('0.63')
  await length.fill('0.2')
  await expect(page.getByText(/nose length \.6300 in is above the length/).first()).toBeVisible()
})

test('a diameter far outside a bullet asks to check the unit on blur and still draws', async ({
  page,
}) => {
  await storeUnits(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, '/bullets/designer?from=demo-bullet-168')
  await expect(page.getByText(/^Started from .*30 Cal 168 gr HPBT Demo\.$/)).toBeVisible()
  const diameter = page.getByRole('textbox', { name: /Diameter \(mm\)$/ })
  const field = page.locator('.designer-field', { has: diameter })
  const flag = field.locator('.field-flag-exceeded')
  const restore = field.getByRole('button', { name: /^Back to the record value\./ })
  await diameter.fill('180')
  // while typing only the change shows
  await expect(diameter).toHaveAccessibleDescription(/^Changed; catalog [\d.]+ mm/)
  await expect(flag).toHaveCount(0)
  await diameter.blur()
  await expect(diameter).toHaveAccessibleDescription(/^Check the unit\. Changed; catalog [\d.]+ mm/)
  await expect(diameter).not.toHaveAttribute('aria-invalid', 'true')
  // the flag shows beside the restore button, both 24 px targets inside the input
  await expect(flag).toBeVisible()
  await expect(restore).toBeVisible()
  const unit = field.getByRole('button', { name: /^(mm, switch|Unit of Diameter)/ })
  const [input, flagBox, restoreBox, unitBox] = await Promise.all(
    [diameter, flag, restore, unit].map((l) => l.boundingBox()),
  )
  if (!input || !flagBox || !restoreBox || !unitBox) throw new Error('no box')
  expect(flagBox.width).toBeGreaterThanOrEqual(24)
  expect(flagBox.height).toBeGreaterThanOrEqual(24)
  expect(restoreBox.width).toBeGreaterThanOrEqual(24)
  expect(restoreBox.height).toBeGreaterThanOrEqual(24)
  expect(flagBox.x + flagBox.width).toBeLessThanOrEqual(restoreBox.x)
  expect(
    Math.abs(flagBox.y + flagBox.height / 2 - (restoreBox.y + restoreBox.height / 2)),
  ).toBeLessThan(1)
  expect(flagBox.x).toBeGreaterThanOrEqual(input.x)
  expect(restoreBox.x + restoreBox.width).toBeLessThanOrEqual(unitBox.x)
  expect(unitBox.x + unitBox.width).toBeLessThanOrEqual(input.x + input.width)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await diameter.fill('8')
  await diameter.blur()
  await expect(diameter).toHaveAccessibleDescription(/^Changed; catalog [\d.]+ mm/)
  await expect(flag).toHaveCount(0)
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
