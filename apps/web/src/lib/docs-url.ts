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
const docs = docsUrl(process.env.NEXT_PUBLIC_DOCS_URL, undefined, process.env.NEXT_PUBLIC_NO_DOCS)

/** The photo guide, how to take a target photo that hole detection can read. */
export const photoGuide = docsPage(docs, 'photo-guide/')

/** The guide to measuring case capacity with water. */
export const capacityGuide = docsPage(docs, 'guides/case-capacity/')

/** The guide to measuring bullet length, base to ogive and bearing length. */
export const bulletGuide = docsPage(docs, 'guides/bullet-dimensions/')

/** The guide to placing a chronograph and its distance to the muzzle. */
export const chronographGuide = docsPage(docs, 'guides/chronograph-setup/')

/** The guide to firing a charge ladder for the powder fit. */
export const ladderGuide = docsPage(docs, 'guides/chronograph-ladder/')

/** The guide to measuring powder temperature. */
export const temperatureGuide = docsPage(docs, 'guides/powder-temperature/')

/** How close a result is: the known sources of variation of a load and the held-out error of the model. */
export const howCloseGuide = docsPage(docs, 'how-close/')
