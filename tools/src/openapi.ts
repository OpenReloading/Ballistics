/**
 * Writes the contract document of the current routes (`buildOpenApi`) to the file named by the
 * first argument, for oasdiff (`api-check`, `api-baseline`) and Schemathesis (`api-conformance`).
 * Needs `npm run build` at the root.
 */
import { writeFileSync } from 'node:fs'
import { buildOpenApi } from '@open-reloading/api/openapi'

const out = process.argv[2]
if (!out) throw new Error('usage: node src/openapi.ts <file>')
writeFileSync(out, `${JSON.stringify(await buildOpenApi(), null, 2)}\n`)
