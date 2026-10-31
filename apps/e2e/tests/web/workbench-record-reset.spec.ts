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

test('the base form and its dimensions are typed over the record, change the volume behind the bullet and reset', async ({
  page,
}) => {
  await page.goto('/workbench')
  await applyExampleLoad(page)
  const volume = loadForm(page).getByRole('textbox', { name: /^Usable case volume/ })
  // the base form is in the card's More popover, which closes with Escape
  const more = () => page.getByRole('button', { name: 'More of Bullet' })
  const [base, tail, cavity] = [
    page.getByRole('combobox', { name: 'Base type' }),
    page.getByRole('textbox', { name: /^Boat-tail length/ }),
    page.getByRole('textbox', { name: /^Cavity diameter/ }),
  ]
  const reset = (label: string) =>
    page.getByRole('button', { name: new RegExp(`^Reset ${label} to the record value`) })
  // the volume follows the seated bullet: read it once it holds still
  const settled = async () => {
    let value = ''
    await expect
      .poll(async () => {
        const first = await volume.inputValue()
        await page.waitForTimeout(500)
        value = await volume.inputValue()
        return first !== '' && first === value
      })
      .toBe(true)
    return value
  }
  const seated = await settled()
  await more().click()
  await expect(base).toHaveValue('boat-tail')
  await expect(tail).toHaveClass(/field-default/)
  const recorded = await tail.inputValue()

  // a typed boat-tail length moves the volume, a reset brings it back
  await tail.fill('2.50')
  await expect(reset('Boat-tail length')).toHaveCount(1)
  await expect(volume).not.toHaveValue(seated)
  await reset('Boat-tail length').click()
  await expect(tail).toHaveValue(recorded)
  expect(await settled()).toBe(seated)

  // a flat base has no dimension row; the reset of the form gives the record's form and dimensions back
  await base.selectOption('flat')
  await expect(tail).toHaveCount(0)
  await expect(volume).not.toHaveValue(seated)
  // the rows moved up under the pointer: the tooltip of the Construction row would cover the button
  await page.mouse.move(0, 0)
  await reset('Base type').click()
  await expect(base).toHaveValue('boat-tail')
  await expect(tail).toHaveValue(recorded)
  expect(await settled()).toBe(seated)

  // a hollow base takes its cavity diameter
  await base.selectOption('conical-hollow-base')
  await expect(cavity).toBeVisible()
  await cavity.fill('3.00')
  await expect(volume).not.toHaveValue(seated)
  await page.keyboard.press('Escape')
  await more().click()
  await page.getByRole('button', { name: 'Reset card' }).click()
  await expect(base).toHaveValue('boat-tail')
  expect(await settled()).toBe(seated)
})

test('a link with a base form opens with it, marked as changed', async ({ page }) => {
  await page.goto(
    '/workbench?cartridge=308-win&bullet=demo-bullet-168&powder=demo-powder-dp40&units=metric-grams&bulletBase=flat',
  )
  await page.getByRole('button', { name: 'More of Bullet' }).click()
  await expect(page.getByRole('combobox', { name: 'Base type' })).toHaveValue('flat')
  await expect(
    page.getByRole('button', { name: /^Reset Base type to the record value/ }),
  ).toHaveCount(1)
})
