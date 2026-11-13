// the one place the app names its framework's build values, so another framework swaps them here; Next inlines only a literal `process.env.NEXT_PUBLIC_*` read
/** The path the app's pages and files are served under (`PAGES_BASE_PATH`, `next.config.ts`): `''` at a domain root. */
export const basePath = process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? ''

/** Both editions share one origin and so one browser store. */
export const edition = process.env.NEXT_PUBLIC_PAGES_EDITION ?? ''

/** The build's line on the Settings page (`buildLine` of `lib/build-line.ts`). */
export const buildLine = process.env.NEXT_PUBLIC_BUILD_LINE

/** The build a printed report names (`buildTag` of `lib/build-line.ts`). */
export const buildTag = process.env.NEXT_PUBLIC_BUILD_TAG

/** The docs site's address given at build, if any. */
export const docsAddress = process.env.NEXT_PUBLIC_DOCS_URL

/** Set at build when the site has no docs. */
export const noDocs = process.env.NEXT_PUBLIC_NO_DOCS

/** The repository's address given at build, if any. */
export const repositoryAddress = process.env.NEXT_PUBLIC_REPOSITORY_URL
