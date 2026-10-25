/**
 * Writes the contract document of the current routes (`buildOpenApi`) to the file named by the
 * first argument, for oasdiff (`api-check`, `api-baseline`) and Schemathesis (`api-conformance`).
 * The file lies in the repository or in the temporary directory (`TMPDIR`, `RUNNER_TEMP`).
 * Needs `npm run build` at the root.
 */
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { buildOpenApi } from '@openreloading/api/openapi'
import { confined } from './confined.ts'

const arg = process.argv[2]
if (!arg) throw new Error('usage: node src/openapi.ts <file>')
const roots = [fileURLToPath(new URL('../../', import.meta.url)), tmpdir()]
if (process.env.RUNNER_TEMP) roots.push(process.env.RUNNER_TEMP)
writeFileSync(confined(arg, roots), `${JSON.stringify(await buildOpenApi(), null, 2)}\n`)
