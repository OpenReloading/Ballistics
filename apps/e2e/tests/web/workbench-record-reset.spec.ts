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

test('a typed bore diameter leaves the record bore area, which describes the record diameter, and a reset brings it back', async ({
  page,
}) => {
  await page.goto('/workbench?cartridge=308-win&bullet=demo-bullet-168&powder=demo-powder-dp40')
  const form = loadForm(page)
  const [bore, area] = [
    form.getByRole('textbox', { name: /^Bore diameter/ }),
    form.getByRole('textbox', { name: /^Bore area/ }),
  ]
  // the cartridge record fills it once loaded
  await expect(area).not.toHaveValue('')
  const record = await area.inputValue()
  await bore.fill('7.80')
  // the area is empty: the circle of the bore diameter shows as its placeholder
  await expect(area).toHaveValue('')
  await expect(area).toHaveAttribute('placeholder', /\d/)
  await form.getByRole('button', { name: /^Reset Bore diameter to the record value/ }).click()
  await expect(area).toHaveValue(record)
})

test('picking another bullet replaces the changed values of the card and says how many', async ({
  page,
}) => {
  await page.goto('/workbench?cartridge=308-win&bullet=demo-bullet-168&powder=demo-powder-dp40')
  const form = loadForm(page)
  const diameter = form.getByRole('textbox', { name: /^Diameter/ })
  const length = form.getByRole('textbox', { name: /^Length/ })
  await expect(diameter).toHaveClass(/field-default/)
  await diameter.fill('7.84')
  await length.fill('31.00')
  await form.getByRole('combobox', { name: 'Search bullets by manufacturer and name' }).fill('150')
  await page
    .getByRole('option', { name: /Demo Bullets.*150 gr/ })
    .first()
    .click()
  await expect(form.getByText('The new record replaced 2 changed values.')).toBeVisible()
  await expect(diameter).toHaveClass(/field-default/)
  await expect(length).toHaveClass(/field-default/)
  // the note stays until the next pick or a reset
  await form.getByRole('combobox', { name: 'Search bullets by manufacturer and name' }).fill('168')
  await page
    .getByRole('option', { name: /Demo Bullets.*168 gr/ })
    .first()
    .click()
  await expect(form.getByText(/The new record replaced/)).toHaveCount(0)
})
