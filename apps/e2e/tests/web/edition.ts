import { test } from '@playwright/test'
import { editionName } from '../../../web/src/lib/offline.ts'
import { defined } from '../../../web/test/defined.ts'

/** The `baseURL` of the project the running test belongs to, with its base path and a trailing slash. */
export const projectBase = () => defined(test.info().project.use.baseURL)

/** `name` as the edition at `baseURL` stores it: `next:` ahead of it below `/next/` (`storageName` of `apps/web/src/lib/edition.ts`). */
export const storageName = (name: string, baseURL = projectBase()) =>
  editionName(baseURL.endsWith('/next/') ? 'next' : '', name)
