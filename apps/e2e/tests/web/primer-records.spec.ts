import { expect, test } from '@playwright/test'
import { gotoHydrated } from './nav.ts'
import { openKeeping } from './workbench.ts'

test('without a chosen primer the Cartridge card names the generic primer of the cartridge by its size', async ({
  page,
}) => {
  await gotoHydrated(page, '/workbench?cartridge=308-win')
  await openKeeping(page)
  await expect(page.getByRole('combobox', { name: 'Primer' })).toHaveAttribute(
    'placeholder',
    'Large rifle',
  )
})
