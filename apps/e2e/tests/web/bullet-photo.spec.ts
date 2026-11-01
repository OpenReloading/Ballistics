import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'

// The sample photograph of the From a photo tool is rendered in the browser: the tool cuts the made-up
// bullet out in its worker, measures it with uncertainties and seeds the designer with the values
// Metric (SI): mm
test.beforeEach(({ page }) => storeUnits(page))

test('the sample photograph is measured and opened in the designer', async ({ page }) => {
  await gotoHydrated(page, '/bullets/designer')
  await page.getByRole('button', { name: 'From a photo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bullet from a photograph' })
  await dialog.getByRole('button', { name: 'Try a sample' }).click()

  const table = dialog.getByRole('table', { name: 'Values measured from the photograph' })
  const length = table.getByRole('row', { name: /^Length/ })
  await expect(length).toContainText(/31\.\d+ ± 0\.0\d+ mm/, { timeout: 30_000 })
  await expect(table.getByRole('row', { name: /^Diameter/ })).toContainText(
    /7\.[78]\d* ± 0\.0\d+ mm/,
  )
  await expect(dialog.getByText(/^Scale \d+\.\d+ px\/mm, uncertainty/)).toBeVisible()

  await dialog.getByRole('button', { name: 'Open in designer' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('textbox', { name: /^L Length \(mm\)$/ })).toHaveValue(/^31\.[45]/)
})

test('the keys of the canvas place a scale point and the brush paints', async ({ page }) => {
  await gotoHydrated(page, '/bullets/designer')
  await page.getByRole('button', { name: 'From a photo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bullet from a photograph' })
  await dialog.getByRole('button', { name: 'Try a sample' }).click()
  const length = dialog.getByRole('row', { name: /^Length/ })
  await expect(length).toContainText(/31\.\d+ ± /, { timeout: 30_000 })

  const canvas = dialog.locator('canvas')
  await canvas.focus()
  await canvas.press('ArrowRight')
  await canvas.press('Enter')
  await expect(dialog.getByRole('status').filter({ hasText: 'Point C placed.' })).toBeAttached()

  // a brush stroke on the background beside the bullet leaves its length as it was
  const before = await length.textContent()
  await dialog.getByText('Brush: add').click()
  await canvas.press('Enter')
  await expect(
    dialog.getByRole('status').filter({ hasText: 'Added to the bullet.' }),
  ).toBeAttached()
  await expect(length).toHaveText(before ?? '')
})

test('the photograph canvas is an application with a short name and its keys as the description', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/designer')
  await page.getByRole('button', { name: 'From a photo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bullet from a photograph' })
  await dialog.getByRole('button', { name: 'Try a sample' }).click()
  const canvas = dialog.getByRole('application', { name: 'Photograph of the bullet' })
  await expect(canvas).toHaveAccessibleDescription(/^Arrow keys move the cursor/)
  await canvas.focus()
  await expect(canvas).toBeFocused()
})

test('the diameter and the overall length from a caliper give the scale without a ruler', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/designer')
  await page.getByRole('button', { name: 'From a photo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bullet from a photograph' })
  await dialog.getByRole('button', { name: 'Try a sample' }).click()
  const length = dialog.getByRole('row', { name: /^Length/ })
  await expect(length).toContainText(/31\.\d+ ± /, { timeout: 30_000 })

  await dialog.getByRole('button', { name: 'Clear the scale' }).click()
  await expect(dialog.getByText('No scale yet.')).toBeVisible()
  await expect(length).toHaveCount(0)

  await dialog.getByRole('spinbutton', { name: /^Diameter, caliper/ }).fill('7.8')
  await dialog.getByRole('spinbutton', { name: /^Overall length, caliper/ }).fill('31.4')
  await expect(dialog.getByText(/^Scale \d+\.\d+ px\/mm, uncertainty/)).toBeVisible()
  await expect(length).toContainText(/31\.\d+ ± /)
  // what a scale from the sizes entered without a ruler rests on, shown with the values
  await expect(
    dialog.getByText(/The scale comes from the diameter and the overall length entered/),
  ).toBeVisible()
})
