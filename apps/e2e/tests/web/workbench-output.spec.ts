import { readFile } from 'node:fs/promises'
import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { showGerman } from './german.ts'
import { choosePreset, storeUnits } from './units.ts'
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
  // the gap between the unit's text and the range's text, px: their boxes may overlap where the
  // range is set flush right in a wider cell
  const gap = await page.locator('.results-head .readout-keys .readout-wide').evaluate((tile) => {
    const textBox = (el: Element | null) => {
      if (!el) throw new Error('no peak pressure tile')
      const range = document.createRange()
      range.selectNodeContents(el)
      return range.getBoundingClientRect()
    }
    const unit = textBox(tile.querySelector('.readout-big .readout-unit'))
    const note = textBox(tile.querySelector('.readout-note'))
    // on one line only: a range under the value has no gap to keep
    return Math.abs(note.top - unit.top) > unit.height
      ? Number.POSITIVE_INFINITY
      : note.left - unit.right
  })
  // the 0.5 rem column gap, less a pixel or two of the glyphs' side bearing and rounding
  expect(gap).toBeGreaterThanOrEqual(6)
  const head = page.locator('.panel[data-panel="powder"] .panel-head')
  const box = await head.boundingBox()
  const menu = await head.getByRole('button', { name: /^Mehr zu/ }).boundingBox()
  if (!box || !menu) throw new Error('no powder card head')
  expect(menu.x + menu.width).toBeLessThanOrEqual(box.x + box.width)
  await expect(page.getByPlaceholder('Zündhütchen', { exact: true })).toBeVisible()
})

/** A tab of the results: on the phone behind the Results tab, maybe in the More menu. */
async function openTab(page: Page, name: string) {
  const direct = page.getByRole('tab', { name, exact: true })
  const more = page.getByRole('button', { name: 'More', exact: true })
  await expect(direct.or(more).first()).toBeVisible()
  // the row measures its tabs again while the page settles: a tab can move into the More menu
  const clicked =
    (await direct.isVisible()) &&
    (await direct.click({ timeout: 3000 }).then(
      () => true,
      () => false,
    ))
  if (!clicked) {
    await more.click()
    await page.getByRole('menuitem', { name }).click()
  }
  await expect(page.getByRole('tabpanel', { name })).toBeVisible()
  return page.getByRole('tabpanel', { name })
}

/** Save writes its file to the origin's private storage instead of asking where. */
const stubSavePicker = (page: Page) =>
  page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () =>
      (await navigator.storage.getDirectory()).getFileHandle('export.json', { create: true })
  })

/** The saved load as the browser stores it. */
const storedLoad = (page: Page) =>
  page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((ok, no) => {
      const r = indexedDB.open('openreloading-user-data')
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    const all: {
      kind: string
      name: string
      data: { analysis?: { powders?: { targetPressure?: number } } }
    }[] = await new Promise((ok, no) => {
      const r = db.transaction('records').objectStore('records').getAll()
      r.onsuccess = () => ok(r.result)
      r.onerror = () => no(r.error)
    })
    db.close()
    return all.find((r) => r.kind === 'load')
  })

test('the Powders tab keeps a typed target the same pressure when the units change', async ({
  page,
}) => {
  await stubSavePicker(page)
  await runExample(page)
  const tab = await openTab(page, 'Powders')
  await tab
    .locator('label')
    .filter({ hasText: /^Target$/ })
    .click()
  const target = tab.getByRole('textbox', { name: 'Target peak pressure' })
  await target.fill('50000')
  await choosePreset(page, 'Metric (SI)')
  await expect(target).toHaveValue('3447 bar')
  // the load keeps the pressure typed in psi, not 3447 bar read back
  await (await barButton(page, 'Save')).click()
  await expect
    .poll(async () => (await storedLoad(page))?.data.analysis?.powders?.targetPressure)
    .toBeCloseTo(3447.38, 2)
  await choosePreset(page, 'US customary')
  await expect(target).toHaveValue('50000 psi')
})

test('the Powders tab copies its table as CSV and keeps its mode and filters with the saved load', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await stubSavePicker(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await runExample(page)
  let tab = await openTab(page, 'Powders')
  await tab
    .locator('label')
    .filter({ hasText: /^Case fill$/ })
    .click()
  await tab.getByRole('textbox', { name: 'Case fill' }).fill('90')
  await tab.getByRole('button', { name: 'Compute' }).click()
  // every powder of the catalogue runs, three at a time
  await expect(tab.getByRole('status')).toHaveText(/^\d+ powders, \d+ not computed\.$/, {
    timeout: 150_000,
  })
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    tab.getByRole('button', { name: 'Download CSV' }).click(),
  ])
  const csv = await readFile(await file.path(), 'utf8')
  expect(csv.split('\n')[0]).toBe(
    'Powder,Charge (gr),Flags,Peak pressure (psi),Percent of maximum (%),Muzzle velocity (ft/s),Case fill (%),Burnt at the muzzle (%),Burnout (in)',
  )
  const maker = tab.getByRole('combobox', { name: 'Manufacturer' })
  await maker.click()
  await maker.press('ArrowDown')
  await maker.press('Enter')
  const name = await maker.inputValue()
  expect(name).not.toBe('')

  await (await barButton(page, 'Save')).click()
  const stored = () => storedLoad(page)
  await expect
    .poll(async () => (await stored())?.data.analysis?.powders)
    .toEqual({ mode: 'fill', fill: 90, manufacturer: expect.stringMatching(/^catalogue:/) })
  const saved = (await stored())?.name ?? ''

  await page.goto('/workbench')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: /^Saved loads/ }).click()
  await page.getByRole('button', { name: saved, exact: true }).click()
  await loadForm(page)
    .getByLabel(/^Charge mass/)
    .press('Control+Enter')
  tab = await openTab(page, 'Powders')
  await expect(tab.getByRole('radio', { name: 'Case fill' })).toBeChecked()
  await expect(tab.getByRole('textbox', { name: 'Case fill' })).toHaveValue('90 %')
  await expect(tab.getByRole('combobox', { name: 'Manufacturer' })).toHaveValue(name)
})
