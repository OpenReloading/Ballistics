import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'
import { loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

const saved = '2026-10-26T10:00:00.000Z'
const capacityId = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'
const caseId = '5d6e7f80-1a2b-4c3d-8e4f-5a6b7c8d9e0f'
const records = [
  {
    kind: 'caseCapacity',
    id: capacityId,
    name: 'Measured case capacity 3.62 g water',
    saved,
    data: { origin: 'user', cartridge: 'catalogue:308-win', waterCapacity: { value: 3.62 } },
  },
  {
    kind: 'case',
    id: caseId,
    name: 'Match brass, lot 3',
    saved,
    data: {
      origin: 'user',
      name: 'Match brass, lot 3',
      cartridge: 'catalogue:308-win',
      material: 'brass',
      capacity: `user:${capacityId}`,
      numberOfFirings: 3,
      casesMeasured: 10,
    },
  },
]

test('an own case group is listed, picked in the workbench as the measured capacity', async ({
  page,
}) => {
  await gotoHydrated(page, '/my-cases')
  await putRecords(page, records)
  await page.reload()
  await expect(page.locator('.page-bar-status .bar-count')).toHaveText('1 case group')
  await expect(page.getByRole('link', { name: 'Match brass, lot 3', exact: true })).toBeVisible()
  // a row's link opens the group in the editor with its measured values
  await page.getByRole('link', { name: 'Match brass, lot 3', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /^Cases measured/ })).toHaveValue('10')
  await expect(page.getByRole('textbox', { name: /^Water capacity/ })).toHaveValue(/^3\.6/)

  await gotoHydrated(page, '/workbench?cartridge=308-win')
  const capacity = loadForm(page).getByRole('textbox', { name: /^Case capacity/ })
  await expect(capacity).toHaveValue('')
  await page.getByRole('button', { name: 'More of Cartridge' }).click()
  await page.getByRole('combobox', { name: 'Case record' }).selectOption(`user:${caseId}`)
  // the group's measured capacity is in the measured field, where the run marks it as measured
  await expect(capacity).toHaveValue(/^3\.6/)
})
