import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'

// A face entered in the designer is drawn at the entered diameters, kept in the browser and
// offered by the shot groups
test.beforeEach(async ({ page }) => {
  await storeUnits(page)
})

const rings = [
  [1, 150],
  [2, 120],
  [3, 90],
  [4, 60],
]

async function design(page: Page) {
  await gotoHydrated(page, '/targets/designer')
  await page.getByLabel('Name', { exact: true }).fill('Club face')
  for (let i = 2; i < rings.length; i++)
    await page.getByRole('button', { name: 'Add ring' }).click()
  for (const [i, [value, diameter]] of rings.entries()) {
    await page.getByLabel(`Ring ${i + 1} value`).fill(String(value))
    await page.getByLabel(`Ring ${i + 1} diameter`).fill(String(diameter))
  }
  await page.getByLabel('Ring 3 fill').selectOption('black')
  await page.getByLabel('Ring 4 fill').selectOption('black')
  await page.getByLabel('Black area diameter').fill('90')
  await page.getByLabel('Event 1 name').fill('25 m')
  await page.getByLabel('Event 1 distance').fill('25')
}

test('draws the rings at the entered diameters and reports the face usable', async ({ page }) => {
  await design(page)
  await expect(page.getByText('Usable in the shot groups')).toBeVisible()
  const radii = await page
    .locator('.target-face-drawing g ellipse')
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute('rx')) * 2))
  expect(radii).toEqual(rings.map(([, d]) => d))
  await page.getByLabel('Ring 2 diameter').fill('95')
  await page.getByLabel('Ring 3 diameter').fill('96')
  await expect(page.getByLabel('Ring 3 diameter')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Usable in the shot groups')).toBeHidden()
})

test('keeps the draft in the browser, reopens it and offers the face in the shot groups', async ({
  page,
}) => {
  await design(page)
  await expect(page.getByText('Saved in this browser')).toBeVisible()
  await gotoHydrated(page, '/targets/designer')
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Open' }).click()
  await page.getByRole('menuitem', { name: /Saved target face designs/ }).click()
  await page.getByRole('button', { name: 'Club face', exact: true }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Club face')
  await expect(page.getByLabel('Ring 4 diameter')).toHaveValue('60')
  await gotoHydrated(page, '/groups')
  await page.getByLabel('Face', { exact: true }).selectOption({ label: 'User design Club face' })
  await expect(page.getByLabel('Event', { exact: true })).toHaveValue('25 m')
})

for (const scheme of ['light', 'dark'] as const) {
  test(`has no accessibility violations in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await design(page)
    await expect(page.getByText('Usable in the shot groups')).toBeVisible()
    const { violations } = await new AxeBuilder({ page }).analyze()
    expect(violations).toEqual([])
  })
}
