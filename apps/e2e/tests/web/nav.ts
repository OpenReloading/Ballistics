import type { Page } from '@playwright/test'
import { projectBase } from './edition.ts'

/** The `safety-ack` value of an accepted Safety dialog (`apps/web/src/components/safety-dialog.tsx`). */
export const safetyAck = '4'

/** Waits for `html[data-hydrated]` and the page bar's `h1[data-hydrated]`: a click or a key before React hydrates the page does nothing, and the page hydrates after the layout. */
export async function gotoHydrated(page: Page, path: string) {
  // a leading slash would leave the project's base path
  const response = await page.goto(path.replace(/^\//, './'))
  await page
    .locator('html[data-hydrated]:not(:has(main h1:not([data-hydrated])))')
    .waitFor({ state: 'attached' })
  return response
}

/** `path` below the base path of the project's `baseURL`, as the site's own links name it. */
export const based = (path: string) => new URL(projectBase()).pathname.replace(/\/$/, '') + path

/** `path` as the static export serves it: below the base path, with a trailing slash before any query or fragment. */
export const exported = (path: string) => based(path.replace(/\/?(?=[?#]|$)/, '/'))

/** Follows a page link of the sidebar from 75em. */
export const followNav = (page: Page, label: string) =>
  page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: label, exact: true })
    .click()
