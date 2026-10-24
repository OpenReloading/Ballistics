import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { storeUnits } from './units.ts'
import { runExample } from './workbench-run.ts'

test.beforeEach(({ page }) => storeUnits(page))

/** The heights above the line of sight (cm) of the Trajectory tab's table, by range (m). */
const trajectoryHeights = (page: Page) =>
  page
    .getByRole('table', { name: /^Trajectory: / })
    .locator('tbody tr')
    .evaluateAll((rows) =>
      Object.fromEntries(
        rows.map((r) => [r.cells[0].textContent ?? '', Number(r.cells[1].textContent)]),
      ),
    )

test('a truing session: plan, entry and result, axe clean in light and dark', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 650 })
  await runExample(page)
  await page.getByRole('tab', { name: 'Trajectory', exact: true }).click()
  await expect(page.getByRole('table', { name: /^Trajectory: / })).toBeVisible()
  const heights = await trajectoryHeights(page)
  await page.getByText('Truing from range strings', { exact: true }).click()
  const session = page.locator('.truing-session')
  const nominal = await session.getByText(/^Nominal shot from the inputs above/).textContent()
  const velocity = Number(/, (\d+) m\/s, zero/.exec(nominal ?? '')?.[1])
  expect(velocity).toBeGreaterThan(0)

  // plan: distances and shots before any shot
  await session.getByLabel(/^Click value/).fill('0.1')
  await session.getByLabel(/^Dispersion of one shot/).fill('0.2')
  const distances = ['300', '600', '900']
  for (const [i, range] of distances.entries()) {
    await session.getByLabel(`Distance, row ${i + 1} (m)`).fill(range)
    await session.getByLabel(`Shots, row ${i + 1}`).fill('5')
  }
  await session.getByLabel(/^Chronograph readings/).fill('10')
  await session.getByLabel(/^Chronograph deviation/).fill('4')
  await session.getByRole('button', { name: 'Plan', exact: true }).click()
  const plan = session.getByRole('table', { name: 'Parameters the planned string identifies' })
  const planned = (name: string) => plan.getByRole('row', { name: new RegExp(`^${name}`) })
  await expect(planned('Muzzle velocity')).toContainText('Identified')
  // impacts alone say nothing about the click value
  await expect(planned('Click value')).toContainText('Unresolved')

  // entry: the nominal heights with their deviation, the chronograph at the nominal speed
  for (const [i, range] of distances.entries()) {
    await session.getByLabel(`Mean, row ${i + 1} (cm)`).fill(String(heights[range]))
    await session
      .getByLabel(`Deviation of one shot, row ${i + 1} (cm)`)
      .fill(String(Number(range) * 0.02))
  }
  await session.getByLabel(/^Chronograph mean/).fill(String(velocity))

  // result, started from the keyboard
  const fit = session.getByRole('button', { name: 'Fit', exact: true })
  await fit.focus()
  await page.keyboard.press('Enter')
  const result = session.getByRole('region', { name: 'Fit result' })
  const fitted = result.getByRole('table', { name: 'Fitted parameters' })
  const row = (name: string) => fitted.getByRole('row', { name: new RegExp(`^${name}`) })
  await expect(row('Muzzle velocity')).toContainText('Identified')
  await expect(row('Muzzle velocity')).toContainText(/\d+ m\/s to \d+ m\/s \(95 %\)/)
  // a parameter the data cannot separate has a name and a reason, and no value
  await expect(row('Click value')).toContainText('Unresolved')
  await expect(row('Click value')).toContainText('No value')
  await expect(result.getByText(/^(Chi-square|No residual check)/)).toBeVisible()

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page }).include('.truing-session').analyze()
    expect(violations.map((v) => v.id)).toEqual([])
  }
})
