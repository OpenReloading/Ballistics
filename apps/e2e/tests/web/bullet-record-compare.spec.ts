import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'

test.beforeEach(({ page }) => storeUnits(page))

const card = (page: Page, label: RegExp) =>
  page.locator('.fact-cards .fact-card').filter({ has: page.locator('dt', { hasText: label }) })

test('the bullet record shows both BCs in one card, the type, and the tags at 12 px', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/demo-bullet-168')
  // G1 and G7 share a card
  const bc = card(page, /^BC G1/)
  await expect(bc.locator('dt')).toHaveText([/^BC G1/, /^BC G7/])
  await expect(bc.locator('dd')).toHaveText(['0.455', '0.221'])
  await expect(card(page, /^Type/).locator('dd')).toHaveText('hollow-point, boat-tail')
  const tag = page.locator('.fact-tags .mantine-Badge-root').first()
  expect(await tag.evaluate((e) => getComputedStyle(e).fontSize)).toBe('12px')
})

test('the bullet drawing labels a length in fixed decimals per unit; its notes name no symbols', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/demo-bullet-168')
  const drawing = page.locator('main figure.drawing-figure svg.drawing.screen-only')
  // metric: 2 decimals, the trailing zero kept
  await expect(drawing.getByText('L 30.50', { exact: true })).toHaveCount(1)
  await expect(drawing.getByText('∅d 7.82', { exact: true })).toHaveCount(1)
  await page
    .getByRole('radiogroup', { name: 'Length unit' })
    .getByText('in', { exact: true })
    .click()
  await expect(drawing.getByText('L 1.2008', { exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Drawing notes' }).click()
  const notes = page.locator('.drawing-notes')
  await expect(notes).toContainText('only values with a source are dimensioned')
  await expect(notes).not.toContainText('Symbols:')
})

test('the bullet data search looks through every group and names the table when nothing matches', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/demo-bullet-168')
  const groups = page.getByRole('radiogroup', { name: 'Bullet data: group' })
  const data = page.getByRole('table', { name: 'Bullet data' })
  const shown = data.locator('tbody tr:not([data-off]):not(.field-group)')
  await groups.getByText('Size', { exact: true }).click()
  const search = page.getByRole('searchbox', { name: 'Search bullet data' })
  // a twist row is in Twist, not in Size: found while Size was chosen, the filter shows All
  await search.fill('twist')
  await expect(groups.getByRole('radio', { name: 'All' })).toBeChecked()
  await expect(shown.filter({ hasText: 'Recommended twist' })).toHaveCount(1)
  await search.fill('BC')
  await expect(page.getByText('No row of Bullet data matches BC.')).toBeVisible()
  // a group chosen while searching clears the search
  await groups.getByText('Shape', { exact: true }).click()
  await expect(search).toHaveValue('')
  await expect(shown.filter({ hasText: 'Nose length' })).toHaveCount(1)
  await expect(shown.filter({ hasText: 'Mass' })).toHaveCount(0)
})

test('on a phone the bullet record keeps Use in workbench in view and the full name as its title', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, '/bullets/demo-bullet-168')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Demo Bullets 30 Cal 168 gr HPBT Demo',
  )
  const workbench = page.locator('main .phone-action')
  await expect(workbench).toBeVisible()
  await expect(workbench).toHaveAttribute('href', '/workbench/?bullet=demo-bullet-168')
  // the drawing and the data follow it
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(workbench).toBeHidden()
})

test('the comparison puts the key values first, each with its difference to the first bullet', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/compare?ids=demo-bullet-168,demo-bullet-150')
  const table = page.getByRole('table', { name: 'Bullet data' })
  const key = table.locator('tbody').first()
  await expect(key.locator('tr.field-group')).toHaveText('Key values')
  await expect(key.locator('tr:not(.field-group) th[scope="row"]')).toHaveText([
    'Mass',
    'Diameter',
    'Length',
    'BC G1',
    'BC G7',
    'Sectional density',
  ])
  const mass = key.getByRole('row').filter({ hasText: 'Mass' })
  await expect(mass).toHaveAttribute('data-differs', 'true')
  await expect(mass.getByRole('cell').nth(2)).toContainText('(−1.17)')
  await expect(
    key.getByRole('row').filter({ hasText: 'Diameter' }).getByRole('cell').nth(2),
  ).toContainText('(±0.00)')
  // the drawings follow the table
  const [data, drawings] = await Promise.all(
    ['Bullet data', 'Drawings'].map((name) =>
      page.getByRole('heading', { name, exact: true }).boundingBox(),
    ),
  )
  expect(data?.y).toBeLessThan(drawings?.y ?? 0)
})

test('a compared bullet has Use in workbench; Add bullet opens the bullet search; the length unit is in the page bar', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/compare?ids=demo-bullet-168,demo-bullet-150')
  await expect(
    page.getByRole('link', { name: 'Use in workbench: Demo Bullets 30 Cal 168 gr HPBT Demo' }),
  ).toHaveAttribute('href', '/workbench/?bullet=demo-bullet-168')
  const unit = page.locator('.page-bar').getByRole('radiogroup', {
    name: 'Length unit of the page: drawings and table',
  })
  await unit.getByText('in', { exact: true }).click()
  await expect(
    page
      .getByRole('table', { name: 'Bullet data' })
      .getByRole('row')
      .filter({ hasText: 'Length' })
      .first(),
  ).toContainText('1.2008')
  await page.getByRole('button', { name: 'Add bullet' }).click()
  await expect(page.getByRole('dialog', { name: 'Choose a bullet' })).toBeVisible()
})

test('the comparison without bullets says so without a warning and offers the list', async ({
  page,
}) => {
  await gotoHydrated(page, '/bullets/compare')
  await expect(page.getByText('No bullets chosen.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Choose bullets' })).toHaveAttribute(
    'href',
    '/bullets/',
  )
})
