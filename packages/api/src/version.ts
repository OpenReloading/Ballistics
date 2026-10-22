import { createRequire } from 'node:module'

/**
 * Contract version of the API: the version of `@openreloading/api` (`packages/api/package.json`,
 * set by release-please). The API document carries it as `info.version`.
 */
export const API_VERSION: string = createRequire(import.meta.url)('../package.json').version

/** Prefix of every public route. The liveness probe `GET /` stays outside it. */
export const API_PREFIX = '/v1'
