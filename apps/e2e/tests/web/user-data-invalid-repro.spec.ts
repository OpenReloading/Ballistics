import { expect, type Page, test } from '@playwright/test'
import { barButton } from './bar.ts'
import { gotoHydrated } from './nav.ts'
import { storeUnits } from './units.ts'
import { putRecords } from './user-store.ts'

// Scratch reproduction of the Cancel-then-Delete race in user-data-invalid.spec.ts, removed after its CI run.
const old = {
  kind: 'bulletDesign',
  id: 'old-1',
  name: 'Old design',
  saved: '2026-10-13T10:00:00.000Z',
  data: 'not an object',
}

test.beforeEach(async ({ page }) => {
  await storeUnits(page)
  await page.goto('/')
  await putRecords(page, [old])
})

/** Cancels the first question with Mantine's 200 ms exit timer held to 2000 ms, then deletes; `wait` adds the fix. */
async function cancelThenDelete(page: Page, wait: boolean) {
  await gotoHydrated(page, '/bullets/designer')
  await (await barButton(page, 'Open')).click()
  await page.getByRole('menuitem', { name: 'Invalid records (1)…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Invalid records in this browser' })
  await dialog.getByRole('button', { name: 'Delete' }).click()
  const ask = page.getByRole('dialog', { name: /^Delete the invalid record Old design/ })
  await expect(ask.getByRole('button', { name: 'Cancel' })).toBeVisible()
  // after the slow setup: the closing panel stays mounted, stable and clickable for 2 s instead of 0.2 s
  await page.evaluate(() => {
    const set = window.setTimeout
    window.setTimeout = ((handler: TimerHandler, ms?: number, ...rest: unknown[]) =>
      set(handler, ms === 200 ? 2000 : ms, ...rest)) as typeof window.setTimeout
  })
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog.getByText('Old design')).toBeVisible()
  if (wait) await expect(ask).toBeHidden()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await ask.getByRole('button', { name: 'Delete' }).click()
  await expect(dialog.getByText('Old design')).toBeHidden()
}

for (const n of [1, 2, 3, 4, 5]) {
  test(`without the wait, the Delete of the closing dialog is dropped (${n})`, async ({ page }) => {
    test.fail()
    await cancelThenDelete(page, false)
  })

  test(`with the wait, the record is deleted (${n})`, async ({ page }) => {
    await cancelThenDelete(page, true)
  })
}
