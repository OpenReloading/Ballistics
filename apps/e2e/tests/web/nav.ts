import type { Page } from '@playwright/test'

/** The `safety-ack` value of an accepted Safety dialog (`apps/web/src/components/safety-dialog.tsx`). */
export const safetyAck = '3'

/**
 * Opens `path` and waits for `html[data-hydrated]` and the page bar's `h1[data-hydrated]`: a click or
 * a key before React hydrates the page does nothing, and the page hydrates after the layout.
 */
export async function gotoHydrated(page: Page, path: string) {
  const response = await page.goto(path)
  await page
    .locator('html[data-hydrated]:not(:has(main h1:not([data-hydrated])))')
    .waitFor({ state: 'attached' })
  return response
}

/** `path` as the static export serves it: with a trailing slash before any query or fragment. */
export const exported = (path: string) => path.replace(/\/?(?=[?#]|$)/, '/')

/** Follows a page link of the sidebar from 75em. */
export const followNav = (page: Page, label: string) =>
  page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: label, exact: true })
    .click()
