import { editionName } from './offline.ts'

/** The path the app's pages and files are served under (`PAGES_BASE_PATH`, `next.config.ts`): `''` at a domain root. */
export const basePath = process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? ''

/**
 * `'next'` in the next edition of the site, built from `main` (`PAGES_EDITION`), else `''`: the stable
 * edition at the site root. Both editions share one origin and so one browser store.
 */
export const edition = process.env.NEXT_PUBLIC_PAGES_EDITION ?? ''

/** The name of a database, local storage key or cache in this edition (`next:` ahead of it in `next`). */
export const storageName = (name: string) => editionName(edition, name)
