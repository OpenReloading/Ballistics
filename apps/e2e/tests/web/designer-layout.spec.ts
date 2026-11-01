import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'

// The designers' rows and bar: the Units button on every designer, a field's own unit switch, the
// fields filling their row, 44 px fields on a phone, and Open and Save in the bar down to 48em.

const designers = ['bullets', 'cartridges', 'powders', 'targets']

for (const d of designers)
  test(`the ${d} designer has the Units button in its bar`, async ({ page }) => {
    await storeUnits(page)
    await page.setViewportSize({ width: 1280, height: 650 })
    await gotoHydrated(page, `/${d}/designer`)
    await expect(page.locator('.page-bar').getByRole('button', { name: /^Units: / })).toBeVisible()
  })

test("a bullet's diameter switches to inches by its unit and keeps its value", async ({ page }) => {
  await storeUnits(page)
  await gotoHydrated(page, '/bullets/designer')
  const diameter = page.getByRole('textbox', { name: /Diameter \(mm\)$/ })
  await diameter.fill('7.82')
  await page.getByRole('button', { name: 'mm, switch Diameter to in' }).click()
  await expect(page.getByRole('textbox', { name: /Diameter \(in\)$/ })).toHaveValue(/^0?\.308$/)
})

test("a metric target's black area is typed in mm with its own switch", async ({ page }) => {
  await storeUnits(page, 'us')
  await gotoHydrated(page, '/targets/designer')
  await page.getByRole('button', { name: 'in, switch Black area diameter to mm' }).click()
  // a number input without negatives: a spinbutton
  const black = page.getByRole('spinbutton', { name: /Black area diameter \(mm\)$/ })
  await black.fill('59.5')
  await expect(black).toHaveValue('59.5')
})

test('Manufacturer and Name fill the value cell, a number stays narrower', async ({ page }) => {
  await storeUnits(page)
  await page.setViewportSize({ width: 1280, height: 650 })
  await gotoHydrated(page, '/bullets/designer')
  const grid = page.locator('.designer-grid').first()
  const name = await page.getByRole('textbox', { name: 'Name', exact: true }).boundingBox()
  const cell = await grid.boundingBox()
  const diameter = await page.getByRole('textbox', { name: /Diameter \(mm\)$/ }).boundingBox()
  if (!(name && cell && diameter)) throw new Error('no boxes')
  expect(name.x + name.width).toBeCloseTo(cell.x + cell.width, 0)
  expect(name.width).toBeGreaterThan(160)
  expect(diameter.width).toBeLessThanOrEqual(160)
  // the label track is the same 9rem on every row
  expect(diameter.x).toBeCloseTo(name.x, 0)
})

test('fields are 44 px high on a phone', async ({ page }) => {
  await storeUnits(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, '/cartridges/designer')
  const box = await page.locator('.designer .side-grid input').first().boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(44)
})

test('from 48em to 75em Open, Save and Units stay in the bar, Undo, Redo and New fold', async ({
  page,
}) => {
  await storeUnits(page)
  await page.setViewportSize({ width: 1024, height: 700 })
  await gotoHydrated(page, '/bullets/designer')
  const bar = page.locator('.page-bar')
  await expect(bar.getByRole('button', { name: 'Open' })).toBeVisible()
  await expect(bar.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
  await expect(bar.getByRole('button', { name: /^Units: / })).toBeVisible()
  const undo = bar.getByRole('button', { name: 'Undo' })
  await expect(undo).toBeHidden()
  const toggle = bar.getByRole('button', { name: 'Page actions' })
  // the toggle names the folded box only: Open and Save, outside it, stay on screen (#906)
  await expect(toggle).toHaveAttribute('aria-controls', /-fold$/)
  const controlled = page.locator(`[id="${await toggle.getAttribute('aria-controls')}"]`)
  await expect(controlled).toHaveClass(/page-bar-fold/)
  await toggle.click()
  await expect(undo).toBeVisible()
  await expect(controlled.getByRole('button', { name: 'Undo' })).toBeVisible()
  await expect(controlled.getByRole('button', { name: 'Open' })).toHaveCount(0)
  await expect(bar.getByRole('button', { name: 'New bullet' })).toBeVisible()
})

test('on a phone the Page actions toggle names the whole actions box', async ({ page }) => {
  await storeUnits(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, '/bullets/designer')
  const toggle = page.locator('.page-bar').getByRole('button', { name: 'Page actions' })
  const controlled = page.locator(`[id="${await toggle.getAttribute('aria-controls')}"]`)
  await expect(controlled).toHaveClass(/page-bar-actions/)
  await toggle.click()
  await expect(controlled.getByRole('button', { name: 'Open' })).toBeVisible()
})
