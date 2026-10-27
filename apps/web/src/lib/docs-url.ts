import { basePath } from './edition.ts'

/**
 * The docs site the Docs link opens: `NEXT_PUBLIC_DOCS_URL` as set, else the `docs/` folder of the
 * same site. `without` (`NEXT_PUBLIC_NO_DOCS`, set by the builds that have no docs site) leaves
 * the folder out: no link.
 */
export function docsUrl(
  value: string | undefined,
  base = basePath,
  without?: string | undefined,
): string | undefined {
  return value?.trim() || (without ? undefined : `${base}/docs/`)
}
