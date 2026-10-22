import { pagesBasePath } from './edition.ts'

/**
 * The docs site the Docs link opens: `NEXT_PUBLIC_DOCS_URL` as set, in the Pages edition the `docs/`
 * folder of the same site, else `undefined` (no link).
 */
export function docsUrl(value: string | undefined, base = pagesBasePath): string | undefined {
  return value?.trim() || (base === undefined ? undefined : `${base}/docs/`)
}
