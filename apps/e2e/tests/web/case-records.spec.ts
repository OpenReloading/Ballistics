import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { openKeeping } from './workbench.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('without a chosen case the Cartridge card uses the generic brass case and the default capacity of its cartridge', async ({
  page,
}) => {
  await gotoHydrated(page, '/workbench?cartridge=308-win')
  await openKeeping(page)
  await expect(page.getByRole('combobox', { name: 'Brass record' })).toHaveAttribute(
    'placeholder',
    'Brass case 308 Win.',
  )
  await expect(
    page.getByRole('combobox', { name: 'Case capacity record', exact: true }),
  ).toHaveValue('308-win-wikipedia')
})
