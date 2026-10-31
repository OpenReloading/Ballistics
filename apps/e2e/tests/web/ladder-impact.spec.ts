import { expect, test } from '@playwright/test'
import { openLadderGroups } from './ladder-groups.ts'
import { storeUnits } from './units.ts'

test.beforeEach(({ page }) => storeUnits(page))

test('linking a chronograph string to a ladder group completes the point of impact per charge', async ({
  page,
}) => {
  const ladder = await openLadderGroups(page)
  const picker = ladder.getByLabel(/^Chronograph, Group 7,/)
  await expect(ladder.getByText(/needs three charges/)).toBeVisible()
  await picker.selectOption({ label: 'day1.csv, String 7: S7, 5 shots' })
  await expect(ladder.getByRole('group', { name: 'Point of impact per charge' })).toBeVisible()
  await expect(ladder.getByText(/changes with the charge by more than/)).toBeVisible()
  await expect(ladder.getByText(/The drop slope is simulated/)).toBeVisible()
  await picker.selectOption({ label: 'None' })
  await expect(ladder.getByText(/needs three charges/)).toBeVisible()
})
