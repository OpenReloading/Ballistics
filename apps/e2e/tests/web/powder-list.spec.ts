import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { putRecords } from './user-store.ts'

// The powder list: the training rows a powder model rests on as a sortable count, and the browser's
// own powders as Mine rows that the burn-rate overlay takes

/** A powder design with a burn law, as the designer saves it, in stored units. */
const design = {
  kind: 'powder',
  id: '6e5d4c3b-2a1f-4e0d-9c8b-7a6f5e4d3c2b',
  name: 'Mine Fitted',
  saved: '2026-10-26T00:00:00.000Z',
  data: {
    origin: 'user',
    provenanceKind: 'fitted',
    draft: {
      interior: {
        model: 'm3',
        fitted: ['vivacity'],
        vivacity: { value: 0.612 },
        energy: { value: 3950000 },
        gamma: 1.215,
        covolume: { value: 0.00097 },
        density: { value: 1.6 },
        pressureExponent: 1,
        referencePressure: { value: 0.980665 },
        ignitionPressure: { value: 50 },
        propellantTemperature: { value: 21 },
        burnForm: { kind: 'twoStage', a: { value: 0.05 }, m: 0.5, q: 0.5, z1: 0.8 },
      },
    },
  },
}

test('sorts the powders by their training rows, the count of the record page', async ({ page }) => {
  await gotoHydrated(page, '/powders?sort=-rows')
  const counts = page.locator('.fit-rows > span:first-child')
  await expect(counts.first()).toBeVisible()
  const shown = (await counts.allTextContents()).slice(0, 10).map(Number)
  expect(shown.length).toBeGreaterThan(1)
  expect(shown).toEqual([...shown].sort((a, b) => b - a))
  // the first row's count is the sum of its record page's load tables
  const first = page
    .locator('tbody tr')
    .filter({ has: page.locator('.fit-rows') })
    .first()
  await first.getByRole('link').first().click()
  const fit = page.getByRole('table', { name: 'Model fit' })
  await expect(fit).toBeVisible()
  const rows = (await fit.locator('tbody tr td:nth-child(2)').allTextContents()).map(Number)
  expect(rows.reduce((s, n) => s + n, 0)).toBe(shown[0])
})

test("adds the browser's own powder to the burn-rate overlay, marked as a user design", async ({
  page,
}) => {
  await gotoHydrated(page, '/powders')
  await putRecords(page, [design])
  await gotoHydrated(page, '/powders')
  const row = page.locator('tbody tr').filter({ hasText: 'Mine Fitted' })
  await row.getByRole('checkbox').check()
  await page.getByRole('link', { name: 'Compare 1' }).click()
  await expect(page).toHaveURL(/add=user:6e5d4c3b/)
  await expect(page.getByText('Mine Fitted (user design)')).toBeVisible()
  await expect(
    page.getByRole('img', { name: /Dynamic vivacity of the chosen powders/ }),
  ).toBeVisible()
})
