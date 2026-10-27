import { editionName } from './offline.ts'

/** The base path of the Pages edition (`PAGES_BASE_PATH`, `next.config.ts`), undefined in the server edition. */
export const pagesBasePath = process.env.NEXT_PUBLIC_PAGES_BASE_PATH

/** The path the app's pages and files are served under: `''` in the server edition. */
export const basePath = pagesBasePath ?? ''

/**
 * `'next'` in the Pages edition built from `main` (`PAGES_EDITION`), else `''`: the stable edition at the
 * site root and the server edition. Both Pages editions share one origin and so one browser store.
 */
const edition = process.env.NEXT_PUBLIC_PAGES_EDITION ?? ''

/** The name of a database, local storage key or cache in this edition (`next:` ahead of it in `next`). */
export const storageName = (name: string) => editionName(edition, name)
