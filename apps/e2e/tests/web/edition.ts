import { test } from '@playwright/test'
import { editionName } from '../../../web/src/lib/offline.ts'
import { defined } from '../../../web/test/defined.ts'

/** The `baseURL` of the project the running test belongs to, with its base path and a trailing slash. */
export const projectBase = () => defined(test.info().project.use.baseURL)

/** Whether `baseURL` is the Start site's next edition. */
export const isNextEdition = (baseURL: string | undefined) => !!baseURL?.endsWith('/next/')

/** `name` as the edition at `baseURL` stores it: `next:` ahead of it below `/next/` (`storageName` of `apps/web/src/lib/edition.ts`). */
export const storageName = (name: string, baseURL = projectBase()) =>
  editionName(isNextEdition(baseURL) ? 'next' : '', name)

/** The reason the next edition skips a test of the offline layer. */
export const noOfflineWorker = 'the Start app registers no offline layer worker yet'

/** The reason the next edition skips a test that calls the API. */
export const noApi = 'the run of the next edition starts no API'
