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

/** The page `page` of the docs site `docs` (a {@link docsUrl}); no docs site, no page. */
export const docsPage = (docs: string | undefined, page: string): string | undefined =>
  docs && `${docs.replace(/\/?$/, '/')}${page}`

// inlined at build; no link without a docs site
/** The photo guide, how to take a target photo that hole detection can read. */
export const photoGuide = docsPage(
  docsUrl(process.env.NEXT_PUBLIC_DOCS_URL, undefined, process.env.NEXT_PUBLIC_NO_DOCS),
  'photo-guide/',
)
