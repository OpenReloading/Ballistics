/** The base path of the Pages edition (`PAGES_BASE_PATH`, `next.config.ts`), undefined in the server edition. */
export const pagesBasePath = process.env.NEXT_PUBLIC_PAGES_BASE_PATH

/** The path the app's pages and files are served under: `''` in the server edition. */
export const basePath = pagesBasePath ?? ''

/** The development preview of `develop` (`PAGES_PREVIEW`), served next to the released site on its origin. */
export const pagesPreview = process.env.NEXT_PUBLIC_PAGES_PREVIEW === '1'
