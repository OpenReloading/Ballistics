import { pagesBasePath } from './edition.ts'

/**
 * The docs site the Docs link opens: `NEXT_PUBLIC_DOCS_URL` as set, in the Pages edition the `docs/`
 * folder of the same site, else `undefined` (no link). `without` (`NEXT_PUBLIC_NO_DOCS`, set by the
 * builds that have no docs site) leaves out the Pages edition's folder.
 */
export function docsUrl(
  value: string | undefined,
  base = pagesBasePath,
  without?: string | undefined,
): string | undefined {
  return value?.trim() || (base === undefined || without ? undefined : `${base}/docs/`)
}
