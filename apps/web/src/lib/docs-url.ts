import { docsAddress, noDocs } from '@/platform/edition.ts'
import { basePath } from './edition.ts'

/** `NEXT_PUBLIC_DOCS_URL`, else the site's `docs/` folder; `without` (builds with no docs site) gives no link. */
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

// no link without a docs site
const docs = docsUrl(docsAddress, undefined, noDocs)

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
