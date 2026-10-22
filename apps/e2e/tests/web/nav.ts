import type { Page } from '@playwright/test'

/** The `safety-ack` value of an accepted Safety dialog (`apps/web/src/components/safety-dialog.tsx`). */
export const safetyAck = '3'

/** Opens `path` and waits for `html[data-hydrated]`: a click or a key before React hydrates does nothing. */
export async function gotoHydrated(page: Page, path: string) {
  const response = await page.goto(path)
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' })
  return response
}

/** Follows a page link of the sidebar from 75em. */
export const followNav = (page: Page, label: string) =>
  page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: label, exact: true })
    .click()
