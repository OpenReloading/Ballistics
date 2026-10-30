import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'
import { loadForm } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

const saved = '2026-10-26T10:00:00.000Z'
const capacityId = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'
const caseId = '5d6e7f80-1a2b-4c3d-8e4f-5a6b7c8d9e0f'
const plainId = '2c4e6a80-3b5d-4f71-9a2c-6e8f0a1b3c5d'
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
  {
    kind: 'case',
    id: plainId,
    name: 'Plain brass',
    saved,
    data: {
      origin: 'user',
      name: 'Plain brass',
      cartridge: 'catalogue:308-win',
      material: 'brass',
    },
  },
]

test('an own case group is a Mine row of the Cases list, opened in its editor, picked in the workbench as the measured capacity', async ({
  page,
}) => {
  await gotoHydrated(page, '/cases')
  await putRecords(page, records)
  await page.reload()
  const link = (name: string) => page.getByRole('link', { name, exact: true })
  await expect(link('Match brass, lot 3')).toBeVisible()
  await expect(link('Plain brass')).toBeVisible()
  // the catalogue's products stay in the list; the source filter has both sources
  await expect(page.locator('a[href^="/cases/demo-"]').first()).toBeVisible()
  const count = page.locator('.page-bar-status .bar-count')
  const all = await count.textContent()
  await page.getByRole('button', { name: /^Source: / }).click()
  await page
    .getByRole('dialog', { name: /^Source: / })
    .getByRole('checkbox', { name: /^OpenReloading/ })
    .uncheck()
  await expect(page).toHaveURL(/[?&]src=user/)
  await expect(count).toHaveText(`2 of ${all}`)
  await page.keyboard.press('Escape')
  // a row's link opens the group in the editor with its measured values
  await link('Match brass, lot 3').click()
  await expect(page).toHaveURL(new RegExp(`/cases/editor/\\?record=${caseId}$`))
  await expect(page.getByRole('textbox', { name: /^Cases measured/ })).toHaveValue('10')
  await expect(page.getByRole('textbox', { name: /^Water capacity/ })).toHaveValue(/^3\.6/)
  // the catalogue's case products of the cartridge are offered as a start
  await expect(page.getByLabel('Start from a case product')).toBeVisible()

  await gotoHydrated(page, '/workbench?cartridge=308-win')
  const capacity = loadForm(page).getByRole('textbox', { name: /^Case capacity/ })
  await expect(capacity).toHaveValue('')
  const brass = page.getByRole('combobox', { name: 'Brass record' })
  await brass.click()
  await page.getByRole('option', { name: 'Match brass, lot 3 (your brass)' }).click()
  // the group's measured capacity is in the measured field, where the run marks it as measured
  await expect(capacity).toHaveValue(/^3\.6/)
  // a group without a measured capacity leaves none of the previous group's in the field
  await brass.click()
  await page.getByRole('option', { name: 'Plain brass (your brass)' }).click()
  await expect(capacity).toHaveValue('')
})

test('the old My cases route opens the Cases list filtered to Mine, or the group a link names', async ({
  page,
}) => {
  await gotoHydrated(page, '/cases')
  await putRecords(page, records)
  await page.goto('/my-cases')
  await expect(page).toHaveURL(/\/cases\/\?src=user$/)
  await expect(page.getByRole('button', { name: 'Source: Mine' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Plain brass', exact: true })).toBeVisible()
  await page.goto(`/my-cases?record=${caseId}`)
  await expect(page).toHaveURL(new RegExp(`/cases/editor/\\?record=${caseId}$`))
  await expect(page.getByRole('textbox', { name: /^Cases measured/ })).toHaveValue('10')
})

test('Settings, General: Your data counts the records per kind and opens the list filtered to Mine', async ({
  page,
}) => {
  await gotoHydrated(page, '/cases')
  await putRecords(page, records)
  await page.reload()
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'Settings' })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await dialog.getByRole('tab', { name: 'General' }).click()
  const table = dialog.getByRole('table')
  const count = (kind: string) =>
    table.getByRole('row').filter({ has: page.getByRole('link', { name: kind, exact: true }) })
  await expect(count('Brass').getByRole('cell')).toHaveText('2')
  // a kind with no records shows 0
  await expect(count('Bullets').getByRole('cell')).toHaveText('0')
  await expect(count('Firearms').getByRole('cell')).toHaveText('0')
  await table.getByRole('link', { name: 'Brass', exact: true }).click()
  await expect(page).toHaveURL(/\/cases\/\?src=user$/)
  await expect(dialog).toBeHidden()
})
