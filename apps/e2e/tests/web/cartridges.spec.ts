import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'

// the cartridge directory: count in the page bar, windowed rows, search and sort in the URL
const status = (page: Page) => page.locator('.page-bar-status [role="status"]')
// the rendered table's rows: a streamed server segment not yet revealed stays hidden beside it
const rows = (page: Page) => page.locator('tbody tr[data-row]').locator('visible=true')
/** The list's count without a filter, read from the page bar. */
async function total(page: Page) {
  await expect(status(page)).toHaveText(/^\d+ cartridges$/)
  return Number((await status(page).textContent())?.split(' ')[0])
}

test('the list searches names and aliases and keeps the search in the URL', async ({ page }) => {
  await gotoHydrated(page, '/cartridges')
  const n = await total(page)
  // windowed: the DOM holds the rows in view; no standards and no table column, CIP on every row
  expect(await rows(page).count()).toBeLessThan(100)
  await expect(page.getByRole('columnheader', { name: /Standards/ })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: /^Table/ })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'CIP table' })).toHaveCount(0)
  await expect(page.locator('.directory .standard-badge')).toHaveCount(0)
  // the table's own controls are the sort, with no filter in the table or its row
  await expect(page.getByRole('combobox', { name: 'Caliber' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^More filters/ })).toHaveCount(0)
  const search = page.getByRole('searchbox', { name: 'Search' })
  await search.fill('lapua')
  await expect(status(page)).toHaveText(/^\d+ of \d+ cartridges$/)
  await expect(page.getByRole('table', { name: 'Cartridges, matching "lapua"' })).toBeVisible()
  // the rows follow the caption once the deferred search applies
  await expect
    .poll(async () => (await rows(page).getByRole('link').allTextContents()).length)
    .toBeGreaterThan(0)
  for (const name of await rows(page).getByRole('link').allTextContents())
    expect(name).toMatch(/lapua/i)
  await expect(page).toHaveURL(/[?&]q=lapua/)
  // aliases are part of the name cell, muted
  await page.goto('/cartridges?q=308+winchester')
  const win = page.getByRole('link', { name: /^308 Win\./ })
  await expect(win.locator('.aliases')).toContainText('308 Winchester')
  await gotoHydrated(page, '/cartridges?q=lapua')
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(status(page)).toHaveText(`${n} cartridges`)
  await expect(page).toHaveURL(/\/cartridges\/$/)
})

test('the source filter names the sources shown, keeps them in the URL and one stays on', async ({
  page,
}) => {
  await gotoHydrated(page, '/cartridges')
  const n = await total(page)
  const filter = page.getByRole('button', { name: /^Source: / })
  await expect(filter).toHaveText('All sources')
  const box = await filter.boundingBox()
  await filter.click()
  const sources = page.getByRole('dialog', { name: /^Source: / })
  const catalogue = sources.getByRole('checkbox', { name: /^OpenReloading/ })
  await expect(catalogue).toBeChecked()
  await expect(sources.getByText(String(n), { exact: true })).toBeVisible()
  await sources.getByRole('checkbox', { name: /^Mine/ }).uncheck()
  await expect(filter).toHaveText('OpenReloading')
  await expect(page).toHaveURL(/[?&]src=openreloading/)
  // the last source on cannot be turned off; the button keeps its size
  await expect(catalogue).toBeDisabled()
  expect(await filter.boundingBox()).toEqual(box)
  await expect(status(page)).toHaveText(`${n} cartridges`)
})

test('a search without a match offers to clear the filters', async ({ page }) => {
  await gotoHydrated(page, '/cartridges?q=zzzz')
  await expect(page.getByText('No cartridges match these filters.')).toBeVisible()
  // the header stays: the note is a row of the table
  await expect(page.getByRole('columnheader', { name: /^Name/ })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).last().click()
  await total(page)
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
})

test('the rows ticked for Compare stay in the URL and come back on reload', async ({ page }) => {
  await gotoHydrated(page, '/powders?q=dp40')
  const tick = page.getByRole('checkbox', { name: 'Select Demo Powder Co. DP40' })
  await tick.check()
  await expect(page).toHaveURL(/[?&]pick=demo-powder-dp40/)
  await page.reload()
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  await expect(tick).toBeChecked()
  // a click on the row opens the record while rows are ticked
  await page.getByRole('link', { name: 'DP40' }).click()
  await expect(page).toHaveURL(/\/powders\/demo-powder-dp40\/$/)
  await page.goBack()
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  await tick.uncheck()
  await expect(page).not.toHaveURL(/pick=/)
})

test('a shift click ticks the rows between two boxes and Clear selection unticks them', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets?q=demo')
  const boxes = page.getByRole('checkbox', { name: /^Select Demo Bullets / })
  await expect(boxes).toHaveCount(2)
  await boxes.first().click()
  await boxes.last().click({ modifiers: ['Shift'] })
  await expect(boxes.first()).toBeChecked()
  await expect(boxes.last()).toBeChecked()
  await expect(page).toHaveURL(/[?&]pick=demo-bullet-/)
  // a click on a cell of a ticked row opens the bullet
  await page.locator('tr[data-picked]').first().click()
  await expect(page).toHaveURL(/\/bullets\/demo-bullet-/)
  await page.goBack()
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await expect(boxes.first()).not.toBeChecked()
  await expect(boxes.last()).not.toBeChecked()
  await expect(page).not.toHaveURL(/pick=/)
  // from the keyboard: Shift+Space on the last box ticks the range from the box clicked before
  await boxes.first().click()
  await boxes.first().click()
  await boxes.last().focus()
  await page.keyboard.press('Shift+Space')
  await expect(boxes.first()).toBeChecked()
  await expect(boxes.last()).toBeChecked()
})

test('the tick boxes and value notes of a row are at least 24 px, as the row keeps its height', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets')
  const row = page.locator('.directory-table tbody tr[data-row]').first()
  const sizes = await row.locator('input[type="checkbox"], button.field-note').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return Math.min(r.width, r.height)
    }),
  )
  expect(sizes.length).toBeGreaterThan(1)
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(24)
  expect((await row.boundingBox())?.height).toBe(32)
})

test('the list sorts by L3 through its header button', async ({ page }) => {
  await gotoHydrated(page, '/cartridges')
  const header = page.getByRole('columnheader', { name: /^Case length L3 \(in\)/ })
  await header.getByRole('button').click()
  await expect(header).toHaveAttribute('aria-sort', 'ascending')
  await expect(page).toHaveURL(/sort=caseLength/)
})

for (const [width, height] of [
  [1280, 800],
  [1920, 1080],
])
  test(`at ${width} x ${height} the cartridge table is the only scroll box`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/cartridges')
    const n = await total(page)
    const pane = await page.evaluate(() => {
      const el = document.scrollingElement as HTMLElement
      return el.scrollHeight - el.clientHeight
    })
    expect(pane).toBeLessThanOrEqual(0)
    const box = page.locator('.directory-scroll')
    await box.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await expect(rows(page).last()).toHaveAttribute('aria-rowindex', String(n + 1))
    await expect(page.getByRole('columnheader', { name: /^Name/ })).toBeInViewport()
  })

test('at 390 px a cartridge row is the name over a facts line', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cartridges?q=308+win')
  const row = rows(page).filter({ has: page.getByRole('link', { name: /^308 Win\./ }) })
  await expect(row.locator('.facts')).toBeVisible()
  await expect(row.locator('td:nth-child(3)')).toBeHidden()
})

test('the cartridge list prints the selection, capped and said so', async ({ page }) => {
  await page.goto('/cartridges')
  const n = await total(page)
  await page.emulateMedia({ media: 'print' })
  await expect(rows(page)).toHaveCount(200)
  await expect(
    page.getByText(`Printed: the first 200 of ${n} cartridges in this selection.`),
  ).toBeVisible()
  await expect(page.locator('.directory-filters')).toBeHidden()
})

test('printed on A4, a name with its aliases takes at most two lines', async ({ page }) => {
  // A4 less 10 mm margins at 96 px per inch
  await page.setViewportSize({ width: 718, height: 1000 })
  await page.goto('/cartridges')
  await total(page)
  await page.emulateMedia({ media: 'print' })
  const name = await page.getByRole('columnheader', { name: /^Name/ }).boundingBox()
  expect(name?.width).toBeGreaterThanOrEqual(128)
  // one line is the lowest row; "17 WSM 17 Winchester Super Magnum, 17 Win. Super Mag." fits two
  const heights = await rows(page).evaluateAll((trs) =>
    trs.map((tr) => tr.getBoundingClientRect().height),
  )
  expect(Math.max(...heights)).toBeLessThanOrEqual(2 * Math.min(...heights))
})

// the cartridge record: RecordPage with the fact cards and the
// two sides, a panel each for the cartridge and the chamber with its drawing beside its table, both
// always shown, the rows and the drawn dimensions linked by symbol

type Side = 'Cartridge' | 'Chamber'
/** The side's panel: its drawing and its table. */
const panel = (page: Page, side: Side) => page.getByRole('region', { name: side, exact: true })
/** The figure of a side. */
const figureOf = (page: Page, side: Side) => panel(page, side).locator('svg.drawing.screen-only')
const dimensions = (page: Page, side: Side) =>
  page.getByRole('table', { name: `${side} dimensions` })
const symbolRow = (page: Page, side: Side, symbol: string) =>
  dimensions(page, side)
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: symbol, exact: true }) })
/** The cards of the facts, without the record's controls. */
const facts = (page: Page) => page.locator('.fact-cards .fact-card')
/** The facts as shown, without the hidden note descriptions. */
const stripText = async (page: Page) =>
  (await facts(page).allInnerTexts()).join(' ').replace(/\s+/g, ' ').trim()

test('the record bar holds the badges and actions, the fact cards the pressures in the preset units', async ({
  page,
}) => {
  await storeUnits(page, 'metric-grams', {})
  await page.goto('/cartridges/308-win')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('308 Win.')
  await expect(page).toHaveTitle(/308 Win\./)
  const bar = page.locator('.page-bar')
  await expect(bar.locator('.standard-badge')).toHaveText('CIP')
  // no verification badge
  await expect(page.getByText(/^(Verified|Unverified)$/)).toHaveCount(0)
  await expect(bar.locator('.record-aliases')).toHaveText('308 Winchester, 7,62 x 51')
  // the record actions of every record page: Use in workbench filled, then Open in designer
  await expect(bar.getByRole('link', { name: 'Use in workbench' })).toHaveAttribute(
    'href',
    '/workbench/?cartridge=308-win',
  )
  await expect(bar.getByRole('link', { name: 'Use in workbench' })).toHaveAttribute(
    'data-variant',
    'filled',
  )
  await expect(bar.getByRole('link', { name: 'Open in designer' })).toHaveAttribute(
    'href',
    '/cartridges/designer/?from=308-win',
  )
  for (const name of ['Copy link', 'Print'])
    await expect(bar.getByRole('button', { name })).toBeVisible()
  await expect(bar.getByRole('button', { name: /^Units: / })).toBeVisible()
  // the aliases in full
  await bar.locator('.record-aliases').focus()
  await expect(
    page.getByRole('tooltip').filter({ hasText: 'Also printed as: 308 Winchester, 7,62 x 51' }),
  ).toBeVisible()
  // the standard's country, table, date and method are over the sources, not in the fact cards
  await expect(facts(page).getByText(/^(Table|Revised|Country|Method)$/)).toHaveCount(0)
  await expect(page.locator('.record-sources .standard-facts dd').first()).toHaveText('I')
  await page.goto('/cartridges/10-3-capra')
  const country = page.locator('.record-sources .standard-facts .country')
  await expect(country).toHaveText('Germany')
  const flag = country.locator('svg.flag')
  await expect(flag).toHaveAttribute('aria-hidden', 'true')
  // no units switch of its own: the preset of Settings
  await expect(page.getByRole('radiogroup', { name: 'Units' })).toHaveCount(0)
})

test('the strip and table follow the US preset: psi and inches', async ({ page }) => {
  await storeUnits(page, 'us', {})
  await page.goto('/cartridges/308-win')
  await expect.poll(() => stripText(page)).toMatch(/^Pmax psi 60191 /)
  // the drawings too; their labels in each unit: apps/web/test/cartridge-drawing.test.tsx
  await expect(figureOf(page, 'Cartridge').getByText('Dimensions in inches')).toHaveCount(1)
  // the case length is a fit: its clearance is the note after the chamber value
  await expect(symbolRow(page, 'Cartridge', 'L3').getByRole('cell')).toHaveText(['2.0150', ''])
  await expect(symbolRow(page, 'Chamber', 'L3').getByRole('cell')).toHaveText(['2.0252', '+.0102'])
  await expect(
    symbolRow(page, 'Chamber', 'R1').getByRole('note', { name: 'Clearance +.0008' }),
  ).toHaveText('+.0008')
  // the tolerance in its slot, minus as U+2212
  await expect(symbolRow(page, 'Cartridge', 'L1').getByRole('cell')).toHaveText([
    '1.5598',
    '−.0079',
  ])
})

test('the clearance note keeps its slot when the length unit switches', async ({ page }) => {
  await storeUnits(page, 'metric-grams', {})
  await gotoHydrated(page, '/cartridges/308-win')
  const cell = symbolRow(page, 'Chamber', 'R1').getByRole('cell')
  const slot = async () => (await cell.locator('.dim-slot').boundingBox())?.width
  const metric = await slot()
  expect(metric).toBeGreaterThan(0)
  await page
    .getByRole('radiogroup', { name: 'Cartridge length unit' })
    .getByText('in', { exact: true })
    .click()
  await expect(cell).toHaveText(['.4736', '+.0008'])
  expect(await slot()).toBe(metric)
})

test('two tables: symbol and value, the chamber with its clearance as a note where both give one, no description column', async ({
  page,
}) => {
  await storeUnits(page, 'metric-grams', {})
  await page.goto('/cartridges/308-win')
  await expect(dimensions(page, 'Cartridge').locator('thead').getByRole('columnheader')).toHaveText(
    ['Symbol', 'Max (mm)', 'Tolerance'],
  )
  await expect(dimensions(page, 'Chamber').locator('thead').getByRole('columnheader')).toHaveText([
    'Symbol',
    'Min (mm)',
    'Tolerance, clearance',
  ])
  await expect(dimensions(page, 'Cartridge').locator('tbody tr[data-symbol]')).toHaveCount(24)
  await expect(dimensions(page, 'Chamber').locator('tbody tr[data-symbol]')).toHaveCount(25)
  // the drawing's order from the mouth to the head, the lengths first: the case length is the first row
  const groups = (side: Side) =>
    dimensions(page, side)
      .locator('tbody')
      .evaluateAll((bodies) => bodies.map((b) => b.getAttribute('aria-label')))
  expect(await groups('Cartridge')).toEqual([
    'Neck and length',
    'Shoulder',
    'Body',
    'Head, rim and groove',
    'Other',
  ])
  expect(await groups('Chamber')).toEqual([
    'Neck and length',
    'Shoulder',
    'Body',
    'Head, rim and groove',
    'Throat and leade',
  ])
  for (const side of ['Cartridge', 'Chamber'] as const)
    await expect(dimensions(page, side).locator('tbody tr[data-symbol]').first()).toHaveAttribute(
      'data-symbol',
      'L3',
    )
  await expect(symbolRow(page, 'Cartridge', 'L1').getByRole('cell')).toHaveText(['39.62', '−0.2'])
  await expect(symbolRow(page, 'Chamber', 'L1').getByRole('cell')).toHaveText(['39.48', ''])
  await expect(symbolRow(page, 'Chamber', 'R1').getByRole('cell')).toHaveText(['12.03', '+0.02'])
  await expect(symbolRow(page, 'Cartridge', 'L6').getByRole('cell')).toHaveText(['71.12', ''])
  await expect(symbolRow(page, 'Chamber', 'L6')).toHaveCount(0)
  await expect(symbolRow(page, 'Cartridge', 'r1').getByRole('cell')).toHaveText(['0.76', 'min'])
  await expect(symbolRow(page, 'Chamber', 'r1').getByRole('cell')).toHaveText(['0.76', 'max'])
  // Greek letters as in the figure; r1 and R1 stay two rows; angles to 2 decimals
  await expect(symbolRow(page, 'Cartridge', 'α').getByRole('cell')).toHaveText(['40°', ''])
  await expect(symbolRow(page, 'Chamber', 'α1').getByRole('cell')).toHaveText(['71.43°', ''])
  await expect(symbolRow(page, 'Cartridge', 'δ L')).toHaveCount(1)
  // the clearance note: its meaning on hover, "Clearance" for a screen reader, in the chamber table only
  await symbolRow(page, 'Chamber', 'R1').getByRole('note').hover()
  await expect(
    page
      .getByRole('tooltip')
      .filter({ hasText: 'Clearance: chamber minimum minus cartridge maximum' }),
  ).toBeVisible()
  await expect(dimensions(page, 'Cartridge').getByRole('note')).toHaveCount(0)
  // what a symbol stands for is its hover, not a column
  await expect(
    page.getByRole('columnheader', { name: /^(Description|Limit|Notes|Imperial)$/ }),
  ).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /search/i })).toHaveCount(0)
  await expect(page.getByRole('radiogroup', { name: 'Group' })).toHaveCount(0)
})

test('9 mm Luger: a zero clearance carries its sign, alpha1 stays as the sheet prints it', async ({
  page,
}) => {
  await storeUnits(page, 'us', {})
  await page.goto('/cartridges/9-mm-luger')
  await expect(symbolRow(page, 'Chamber', 'L3').getByRole('cell')).toHaveText(['.7539', '±.0000'])
  await expect(symbolRow(page, 'Chamber', 'α1').getByRole('cell')).toHaveText(['180°', ''])
  // 1°57'57": 2 decimals, the text as printed in the hover
  await expect(symbolRow(page, 'Chamber', 'i').getByRole('cell')).toHaveText(['1.97°', ''])
  await expect(symbolRow(page, 'Chamber', 'i').locator('[tabindex]')).toHaveAccessibleDescription(
    /Printed as 1°57'57"/,
  )
})

test('the symbol notes show on keyboard focus; a table is one tab stop, the arrow keys move between its symbols', async ({
  page,
}) => {
  await page.goto('/cartridges/308-win')
  const symbol = (side: Side, name: string) => symbolRow(page, side, name).locator('[tabindex]')
  // one tab stop per table: the first symbol, whatever else is focused programmatically
  for (const side of ['Cartridge', 'Chamber'] as const)
    await expect(dimensions(page, side).locator('tbody th [tabindex="0"]')).toHaveCount(1)
  const alpha = symbol('Chamber', 'α')
  await alpha.focus()
  // the meaning and the side's notes: the description of Body diameter at E and the like is here
  await expect(page.getByRole('tooltip')).toContainText('alpha: included shoulder angle')
  await expect(alpha).toHaveAccessibleDescription('alpha: included shoulder angle Basic')
  await expect(symbol('Cartridge', 'P1')).toHaveAccessibleDescription('P1: body diameter at E')
  // the focused symbol is the table's stop; the arrow keys move on, also to one without notes
  await expect(dimensions(page, 'Chamber').locator('tbody th [tabindex="0"]')).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await expect(symbol('Chamber', 'S')).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(alpha).toBeFocused()
  await page.keyboard.press('End')
  await expect(symbol('Chamber', 'Q')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(symbol('Chamber', 'L3')).toBeFocused()
  // Tab leaves the table, Shift+Tab comes back to the symbol last focused
  await page.keyboard.press('Tab')
  await expect(dimensions(page, 'Chamber').locator('[tabindex="0"]:focus')).toHaveCount(0)
  await page.keyboard.press('Shift+Tab')
  await expect(symbol('Chamber', 'L3')).toBeFocused()
  const delta = symbol('Cartridge', 'δ L')
  await expect(delta).not.toHaveAccessibleDescription(/not drawn/)
  await expect(delta).toHaveCount(1)
})

test('the cartridge and the chamber show side by side at all times: no view switch, no Combined view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/cartridges/308-win')
  await expect(figureOf(page, 'Cartridge')).toBeVisible()
  await expect(figureOf(page, 'Chamber')).toBeVisible()
  await expect(dimensions(page, 'Cartridge')).toBeVisible()
  await expect(dimensions(page, 'Chamber')).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'View' })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'Combined' })).toHaveCount(0)
  await expect(page.getByRole('img', { name: /combined/i })).toHaveCount(0)
  // the cartridge left of the chamber, on one row, their drawings at one scale
  const [c, h] = await Promise.all(
    (['Cartridge', 'Chamber'] as const).map(async (side) => panel(page, side).boundingBox()),
  )
  expect(c?.x).toBeLessThan(h?.x ?? 0)
  expect(c?.y).toBe(h?.y)
  // the CSS px per drawing unit of each figure (the viewBox shown with "meet")
  const scale = (side: Side) =>
    figureOf(page, side).evaluate((e) => {
      const [r, v] = [e.getBoundingClientRect(), (e as SVGSVGElement).viewBox.baseVal]
      return Math.min(r.width / v.width, r.height / v.height)
    })
  expect(await scale('Chamber')).toBeCloseTo(await scale('Cartridge'), 2)
  // print shows both sides upright, as the CIP sheets
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('img', { name: 'Outline, CIP 308 Win.' })).toHaveCount(2)
  for (const img of await page.getByRole('img', { name: 'Outline, CIP 308 Win.' }).all())
    await expect(img).toBeVisible()
})

// the page may scroll (only the workbench must not); the Bullets panel follows the sides
for (const [width, height] of [
  [1280, 800],
  [1920, 1080],
] as const)
  test(`at ${width} x ${height} 308 Win. shows facts on one row and both figures and tables in view`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/cartridges/308-win')
    await expect(dimensions(page, 'Chamber')).toBeVisible()
    for (const side of ['Cartridge', 'Chamber'] as const) {
      await expect(figureOf(page, side)).toBeInViewport({ ratio: 1 })
      await expect(panel(page, side)).toBeInViewport({ ratio: 1 })
    }
    // the cards on one row
    const tops = await Promise.all(
      (await facts(page).all()).map(async (l) => (await l.boundingBox())?.y),
    )
    expect(new Set(tops).size).toBe(1)
    expect((await facts(page).first().boundingBox())?.height).toBeLessThan(70)
  })

test('at 390 px the facts, the cartridge table and drawing, the chamber table and drawing and the sources follow in that order', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cartridges/308-win')
  await expect(page.locator('.record-facts')).toHaveText('CIP · 308 Winchester · 7,62 x 51')
  const tops = await Promise.all(
    [
      facts(page).first(),
      dimensions(page, 'Cartridge'),
      figureOf(page, 'Cartridge'),
      dimensions(page, 'Chamber'),
      figureOf(page, 'Chamber'),
      page.getByRole('heading', { name: /^Sources/ }),
    ].map(async (l) => (await l.boundingBox())?.y ?? Number.NaN),
  )
  expect(tops).toEqual([...tops].sort((a, b) => a - b))
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0)
  // the tables fit the width: no sideways scroll box
  for (const side of ['Cartridge', 'Chamber'] as const)
    expect(
      await dimensions(page, side).evaluate(
        (t) => t.parentElement?.scrollWidth === t.parentElement?.clientWidth,
      ),
    ).toBe(true)
})

test('a record without values is marked as a gap: badge, one line, no unit switch or designer; the list marks it too', async ({
  page,
}) => {
  await page.goto('/cartridges/40-x-46-deftec')
  const bar = page.locator('.page-bar')
  await expect(bar.locator('.gap-badge')).toHaveText('Gap')
  await expect(page.getByText('No dimensions or pressures in this record')).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: /length unit$/i })).toHaveCount(0)
  await expect(bar.getByRole('link', { name: 'Open in designer' })).toHaveCount(0)
  await expect(bar.getByRole('link', { name: 'Use in workbench' })).toBeVisible()
  await page.goto('/cartridges/308-win')
  await expect(page.locator('.gap-badge')).toHaveCount(0)
  await page.goto('/cartridges?q=deftec')
  await expect(page.getByRole('link', { name: /^40 x 46 DEFTEC/ })).toBeVisible()
  await expect(page.locator('.gap-badge')).toHaveCount(1)
})

test('the record shows the case type without a hover note: 220 Swift is semi-rimmed', async ({
  page,
}) => {
  await page.goto('/cartridges/220-swift')
  await expect(facts(page).getByText('semi-rimmed', { exact: true })).toBeVisible()
  await expect(facts(page).locator('.field-note', { hasText: 'semi-rimmed' })).toHaveCount(0)
})

test('the Case type column has no help note', async ({ page }) => {
  await page.goto('/cartridges')
  await total(page)
  await page.getByRole('columnheader', { name: 'Case type' }).getByRole('button').focus()
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('printed, the standard shows once: the badge, not the facts line', async ({ page }) => {
  await page.setViewportSize({ width: 718, height: 1000 })
  await page.goto('/cartridges/308-win')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.page-bar .standard-badge')).toBeVisible()
  expect(await page.locator('.record-facts').innerText()).toBe('308 Winchester · 7,62 x 51')
})

test('printed, a one-figure record ends within one A4 page in a taller window', async ({
  page,
}) => {
  // A4 less 15 mm margins at 96 px per inch: 180 by 267 mm; the window is taller than the page
  await page.setViewportSize({ width: 680, height: 1400 })
  for (const id of ['308-win', '9-mm-luger']) {
    await page.goto(`/cartridges/${id}`)
    await page.emulateMedia({ media: 'print' })
    const bottom = await page
      .locator('.page-shell')
      .evaluate((e) => e.getBoundingClientRect().bottom)
    expect(bottom).toBeLessThan(1009)
    await expect(facts(page).first()).toBeVisible()
    await expect(dimensions(page, 'Cartridge')).toBeVisible()
    await expect(dimensions(page, 'Chamber')).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Cartridge length unit' })).toBeHidden()
  }
})

test('printed, the outline is to its stated scale with its stroke inside the case', async ({
  page,
}) => {
  // A4 less 10 mm margins, a dark system setting: print stays light
  await page.setViewportSize({ width: 718, height: 1000 })
  await page.goto('/cartridges/308-win')
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' })
  const printed = (name: 'Cartridge' | 'Chamber') =>
    page
      .getByRole('region', { name, exact: true })
      .getByRole('img', { name: 'Outline, CIP 308 Win.' })
  const drawing = printed('Cartridge')
  await expect(drawing).toHaveCount(1)
  await expect(drawing).toHaveClass(/print-only/)
  const outline = drawing.locator('.part-cartridge use.outline')
  // the geometry box: boundingBox() would add the stroke
  const box = await outline.evaluate((e) => e.getBoundingClientRect().toJSON())
  const mm = (px: number) => (px * 25.4) / 96
  // upright at 1:1.25, so the record fits one A4 page: head to mouth is L3, the widest diameter R1
  const k = 0.8
  expect(Math.abs(mm(box.height) - 51.18 * k)).toBeLessThan(0.1)
  expect(Math.abs(mm(box.width) - 12.01 * k)).toBeLessThan(0.1)
  expect(
    mm((await drawing.evaluate((e) => e.getBoundingClientRect().width)) as number),
  ).toBeLessThanOrEqual(190)
  await expect(outline).toHaveAttribute('clip-path', /^url\(#.+-print-cartridge\)$/)
  expect(await outline.evaluate((e) => getComputedStyle(e).stroke)).toBe('rgb(17, 17, 17)')
  // the chamber stroke outside the cavity: cut to the steel band, two polygons beside the bore
  const chamber = printed('Chamber').locator('.part-chamber path.outline')
  await expect(chamber).toHaveAttribute('clip-path', /^url\(#.+-print-steel\)$/)
  await expect(printed('Chamber').locator('.part-cartridge')).toHaveCount(0)
  await expect(printed('Cartridge').locator('.dims-cartridge')).toBeVisible()
  // with dark stored too
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))
  await page.reload()
  expect(await outline.evaluate((e) => getComputedStyle(e).stroke)).toBe('rgb(17, 17, 17)')
  await page.evaluate(() => localStorage.removeItem('theme'))
  const words = page
    .getByRole('region', { name: 'Cartridge', exact: true })
    .getByText(/the drawing is at 1:1\.25 \(80 % of life size\)/)
  await expect(words).toBeVisible()
  await page.emulateMedia({ media: 'screen' })
  await expect(drawing).toBeHidden()
  await expect(words).toBeHidden()
})

test('Cal. 12: one figure pair for the chosen variant, every pair printed', async ({ page }) => {
  await storeUnits(page, 'metric-grams', {})
  await gotoHydrated(page, '/cartridges/12')
  // one figure per side, the variant the select starts on: 12/70, the most common (a convenience default)
  const group = (variant: string) =>
    page
      .getByRole('region', { name: 'Cartridge', exact: true })
      .getByRole('group', { name: `Outline, CIP Cal. 12 (${variant})`, exact: true })
  await expect(figureOf(page, 'Cartridge').locator('visible=true')).toHaveCount(1)
  await expect(figureOf(page, 'Chamber').locator('visible=true')).toHaveCount(1)
  await expect(page.getByRole('combobox', { name: 'Variant' })).toHaveValue('12/70')
  await expect(group('12/70')).toBeVisible()
  const pick = async (variant: string) => {
    await page.getByRole('combobox', { name: 'Variant' }).click()
    await page.getByRole('option', { name: variant, exact: true }).click()
    await expect(group(variant)).toBeVisible()
  }
  await pick('12/35 T')
  await pick('12/89')
  await expect(figureOf(page, 'Cartridge').locator('visible=true')).toHaveCount(1)
  await expect(figureOf(page, 'Chamber').locator('visible=true')).toHaveCount(1)
  // print shows every variant's pair, whatever the select
  await page.emulateMedia({ media: 'print' })
  for (const side of ['Cartridge', 'Chamber'])
    for (const variant of ['12/35 T', '12/70', '12/89'])
      await expect(
        page
          .getByRole('region', { name: side, exact: true })
          .getByRole('img', { name: `Outline, CIP Cal. 12 (${variant})`, exact: true }),
      ).toBeVisible()
})

test('a table row and its drawn dimension mark each other on hover and focus, within their side; a click keeps the mark', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await gotoHydrated(page, '/cartridges/308-win')
  const drawn = (side: Side, symbol: string) =>
    figureOf(page, side).locator(`text[data-symbol="${symbol}"]`)
  const marked = /\bis-hi\b/
  await symbolRow(page, 'Cartridge', 'P2').hover()
  await expect(drawn('Cartridge', 'P2')).toHaveClass(marked)
  await expect(figureOf(page, 'Cartridge').locator('.hi.is-hi')).toHaveCount(1)
  // the chamber's P2 is not marked by the cartridge's
  await expect(drawn('Chamber', 'P2')).not.toHaveClass(marked)
  await expect(symbolRow(page, 'Chamber', 'P2')).not.toHaveClass(marked)
  // and back: the drawn L3 of the chamber marks its row, not the cartridge's
  await drawn('Chamber', 'L3').hover()
  await expect(symbolRow(page, 'Chamber', 'L3')).toHaveClass(marked)
  await expect(symbolRow(page, 'Cartridge', 'L3')).not.toHaveClass(marked)
  await expect(drawn('Cartridge', 'P2')).not.toHaveClass(marked)
  // by keyboard: focus marks, Enter keeps the mark after the focus leaves, Escape drops it
  await symbolRow(page, 'Cartridge', 'L1').locator('[tabindex]').focus()
  await expect(drawn('Cartridge', 'L1')).toHaveClass(marked)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.mouse.move(0, 0)
  await expect(drawn('Cartridge', 'L1')).toHaveClass(marked)
  await page.keyboard.press('Escape')
  await page.mouse.move(1, 1)
  await expect(drawn('Cartridge', 'L1')).not.toHaveClass(marked)
  // a row whose symbol the drawing does not show links nothing
  await symbolRow(page, 'Cartridge', 'Fe').hover()
  await expect(page.locator('.is-hi')).toHaveCount(0)
  // "δ L" is one symbol: it does not mark the drawn δ (the table named it "delta" and "L")
  await symbolRow(page, 'Cartridge', 'δ L').hover()
  await expect(page.locator('.is-hi')).toHaveCount(0)
  // no mark in print
  await symbolRow(page, 'Cartridge', 'P2').hover()
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.hi.is-hi:visible')).toHaveCount(0)
})

test("the record's unit switch changes the drawings, the facts and the tables, not Settings", async ({
  page,
}) => {
  await storeUnits(page, 'metric-grams', {})
  await gotoHydrated(page, '/cartridges/308-win')
  await expect(figureOf(page, 'Cartridge').getByText('Dimensions in mm')).toHaveCount(1)
  await page
    .getByRole('radiogroup', { name: 'Cartridge length unit' })
    .getByText('in', { exact: true })
    .click()
  await expect(figureOf(page, 'Cartridge').getByText('Dimensions in inches')).toHaveCount(1)
  await expect(dimensions(page, 'Cartridge').getByRole('columnheader').nth(1)).toHaveText(
    'Max (in)',
  )
  await expect.poll(() => stripText(page)).toMatch(/ M in \.9843 /)
  // pressures stay in the preset; the Settings preset is unchanged
  await expect.poll(() => stripText(page)).toMatch(/^Pmax bar 4150 /)
  await expect(
    page.locator('.page-bar').getByRole('button', { name: /^Units: / }),
  ).toHaveAccessibleName('Units: Metric (SI)')
})

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true })

  test('a tap on a symbol shows its notes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoHydrated(page, '/cartridges/308-win')
    await symbolRow(page, 'Cartridge', 'α').locator('[tabindex]').tap()
    await expect(page.getByRole('tooltip')).toContainText('alpha: included shoulder angle')
  })
})

test('a provenance note is shown', async ({ page }) => {
  await page.goto('/cartridges/6-5-grendel')
  await expect(page.getByText(/checked by hand against the CIP sheet/i)).toBeVisible()
})

test('an unknown cartridge and one without a CIP sheet show the not-found content and are not indexed', async ({
  page,
}) => {
  for (const id of ['does-not-exist', '22-creedmoor']) {
    await page.goto(`/cartridges/${id}`)
    await expect(page.getByText('This page could not be found.')).toBeVisible()
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)
  }
})
