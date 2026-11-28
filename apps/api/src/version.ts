import { createRequire } from 'node:module'

/** Contract version of the API, `info.version` of its document: the version in `apps/api/package.json` that release-please sets. */
export const API_VERSION: string = createRequire(import.meta.url)('../package.json').version

/** The source of this version (AGPL section 13): the release tag of `API_VERSION`, from which the image is built. */
export const API_SOURCE_URL = `https://github.com/OpenReloading/Ballistics/tree/api-v${API_VERSION}`

/** Prefix of every public route. The liveness probe `GET /` stays outside it. */
export const API_PREFIX = '/v1'
