import { expect, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { applyExampleLoad, loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('a value changed over its record is marked and one click gives the record value back', async ({
  page,
}) => {
  await page.goto('/workbench')
  await applyExampleLoad(page)
  const form = loadForm(page)
  const reset = (label: string) =>
    form.getByRole('button', { name: new RegExp(`^Reset ${label} to the record value`) })

  // a Bullet card value
  const diameter = form.getByRole('textbox', { name: /^Diameter/ })
  const record = await diameter.inputValue()
  await expect(reset('Diameter')).toHaveCount(0)
  await diameter.fill('7.84')
  await expect(reset('Diameter')).toHaveCount(1)
  await reset('Diameter').click()
  await expect(diameter).toHaveValue(record)
  await expect(diameter).toHaveClass(/field-default/)
  await expect(reset('Diameter')).toHaveCount(0)

  // a Cartridge card value that follows the cartridge record until typed
  const bore = form.getByRole('textbox', { name: /^Bore diameter/ })
  const followed = await bore.inputValue()
  await bore.fill('7.80')
  await expect(reset('Bore diameter')).toHaveCount(1)
  await reset('Bore diameter').click()
  await expect(bore).toHaveValue(followed)
  await expect(bore).toHaveClass(/field-default/)

  // a Powder card model parameter
  await form.getByRole('button', { name: 'Show' }).click()
  const vivacity = form.getByRole('textbox', { name: /^Vivacity/ })
  const filled = await vivacity.inputValue()
  await vivacity.fill('1.234')
  await expect(reset('Vivacity')).toHaveCount(1)
  await reset('Vivacity').click()
  await expect(vivacity).toHaveValue(filled)
})

test('Reset card gives a card all its record values back', async ({ page }) => {
  await page.goto('/workbench')
  await applyExampleLoad(page)
  const form = loadForm(page)
  const [diameter, length] = [
    form.getByRole('textbox', { name: /^Diameter/ }),
    form.getByRole('textbox', { name: /^Length/ }),
  ]
  const before = [await diameter.inputValue(), await length.inputValue()]
  const open = () => page.getByRole('button', { name: 'More of Bullet' }).click()
  await open()
  await expect(page.getByRole('button', { name: 'Reset card' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await diameter.fill('7.84')
  await length.fill('31.00')
  await open()
  await page.getByRole('button', { name: 'Reset card' }).click()
  await expect(diameter).toHaveValue(before[0] ?? '')
  await expect(length).toHaveValue(before[1] ?? '')
  await expect(page.getByRole('button', { name: 'Reset card' })).toBeDisabled()
})
