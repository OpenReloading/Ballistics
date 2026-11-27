// the one place the app names its build values, which vite.config.mts sets as literals
/** The path the app's pages and files are served under (`PAGES_BASE_PATH`): `''` at a domain root. */
export const basePath = process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? ''

/** The build's line on the Settings page, if the build sets one. */
export const buildLine = process.env.NEXT_PUBLIC_BUILD_LINE

/** The build a printed report names, if the build sets one. */
export const buildTag = process.env.NEXT_PUBLIC_BUILD_TAG

/** The docs site's address given at build, if any. */
export const docsAddress = process.env.NEXT_PUBLIC_DOCS_URL

/** Set at build when the site has no docs. */
export const noDocs = process.env.NEXT_PUBLIC_NO_DOCS

/** The repository's address given at build, if any. */
export const repositoryAddress = process.env.NEXT_PUBLIC_REPOSITORY_URL

/** The source of the running build, set at build by its config. */
export const sourceAddress = process.env.NEXT_PUBLIC_SOURCE_URL
