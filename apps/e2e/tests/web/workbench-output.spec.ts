import { readFile } from 'node:fs/promises'
import { expect, type Page, test } from '@playwright/test'
import { showGerman } from './german.ts'
import { storeUnits } from './units.ts'
import { loadForm } from './workbench.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page, 'us', {}))

/** The report as the print shows it. */
const report = (page: Page) => page.locator('.print-report')

/** Opens the Print menu of the page bar. */
async function printMenu(page: Page) {
  await page.getByRole('button', { name: 'Print', exact: true }).click()
  return page.getByRole('menu')
}

test('the report prints the range with its unit, the inputs with their digits and the main charge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  await runExample(page)
  await page.emulateMedia({ media: 'print' })
  await expect(
    report(page).getByText(/^Corner-case range, input tolerances: \d+ to \d+ psi$/),
  ).toBeVisible()
  await expect(
    report(page).getByRole('heading', { name: /^Result, main charge: 37\.0 gr$/ }),
  ).toBeVisible()
  const row = (name: string) => report(page).getByRole('row', { name: new RegExp(`^${name} `) })
  await expect(row('Bore diameter')).toContainText('.3000 in')
  await expect(row('COAL')).toContainText('2.8000 in')
  await expect(row('Seating depth')).toContainText('.4157 in')
  await expect(report(page)).not.toContainText(/step 0/i)
  await expect(report(page)).toContainText('Barrel length study, main step (simulation)')
})

test('the Print menu leaves out the sections unticked, also on the next visit', async ({
  page,
}) => {
  await runExample(page)
  const menu = await printMenu(page)
  for (const name of ['Chart', 'Notes', 'Ladder', 'Barrel length study'])
    await menu.getByRole('menuitemcheckbox', { name }).click()
  await expect(menu.getByRole('menuitemcheckbox', { name: 'Chart' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await expect(menu.getByRole('menuitemcheckbox', { name: 'Inputs' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.keyboard.press('Escape')
  await page.emulateMedia({ media: 'print' })
  await expect(report(page).locator('.report-chart')).toBeHidden()
  await expect(report(page).getByRole('heading', { name: 'Barrel length' })).toHaveCount(0)
  await expect(report(page).getByRole('heading', { name: 'Charge ladder' })).toHaveCount(0)
  await expect(report(page).locator('.report-inputs')).toBeVisible()
  await expect(report(page).getByText(/^Pressure limits of the cartridge/)).toBeVisible()

  await page.emulateMedia({ media: 'screen' })
  await runExample(page)
  const again = await printMenu(page)
  await expect(again.getByRole('menuitemcheckbox', { name: 'Chart' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  // ticked again, the chart prints as before
  await again.getByRole('menuitemcheckbox', { name: 'Chart' }).click()
  await page.keyboard.press('Escape')
  await page.emulateMedia({ media: 'print' })
  await expect(report(page).locator('.report-chart')).toBeVisible()
})

test('the chart data dialog downloads the curves and the results as CSV', async ({ page }) => {
  await runExample(page)
  await page.getByRole('button', { name: 'Chart data' }).click()
  const dialog = page.getByRole('dialog', { name: 'Chart data' })
  const [curves] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Curves (CSV)' }).click(),
  ])
  const lines = (await readFile(await curves.path(), 'utf8')).split('\n')
  expect(lines[0]).toBe(
    'Time (ms),Travel (in),Breech pressure (psi),Velocity (ft/s),Energy (ft·lbf),Burnt (%)',
  )
  expect(lines.length).toBeGreaterThan(20)
  // the last time step is the muzzle: the velocity of the readouts
  const muzzle = await page
    .locator('.results-head .readout-keys')
    .getByText(/^\d+$/)
    .nth(1)
    .textContent()
  expect(lines.at(-1)?.split(',')[3]).toBe(muzzle)
  const [results] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Results (CSV)' }).click(),
  ])
  const text = await readFile(await results.path(), 'utf8')
  expect(text).toMatch(/^Quantity,Value,Unit\n/)
  expect(text).toContain(`Muzzle velocity,${muzzle},ft/s`)
  expect(text).not.toMatch(/Simulation|safe/i)
})

test('the free recoil shows the momentum of bullet and gas', async ({ page }) => {
  await runExample(page)
  await expect(page.locator('.results-head .readout-list')).toContainText(
    /Momentum \d+\.\d\d lbf·s \(bullet \d+\.\d\d, gas \d+\.\d\d\)/,
  )
})

test('every interior field says what it is', async ({ page }) => {
  await runExample(page)
  const form = loadForm(page)
  await expect(form.getByLabel(/^Bore diameter/)).toHaveAccessibleDescription(/across the lands/)
  await expect(form.getByLabel(/^Bullet mass/)).toHaveAccessibleDescription(/Mass of one bullet/)
  await expect(form.getByLabel(/^Charge mass/)).toHaveAccessibleDescription(
    /Powder mass of one round/,
  )
})

test('in German the pressure range keeps its gap and the Powder card head its menu', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  await runExample(page)
  await showGerman(page)
  const tile = page.locator('.results-head .readout-keys .readout-wide')
  const unit = await tile.locator('.readout-big .readout-unit').boundingBox()
  const range = await tile.locator('.readout-note').boundingBox()
  if (!unit || !range) throw new Error('no peak pressure tile')
  // the range's text ends at its box's end: its box starts at least 0.5 rem after the unit
  expect(range.x - (unit.x + unit.width)).toBeGreaterThanOrEqual(8)
  const head = page.locator('.panel[data-panel="powder"] .panel-head')
  const box = await head.boundingBox()
  const menu = await head.getByRole('button', { name: /^Mehr zu/ }).boundingBox()
  if (!box || !menu) throw new Error('no powder card head')
  expect(menu.x + menu.width).toBeLessThanOrEqual(box.x + box.width)
  await expect(page.getByPlaceholder('Zündhütchen', { exact: true })).toBeVisible()
})
