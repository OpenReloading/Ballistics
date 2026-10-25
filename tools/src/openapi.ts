/**
 * Writes the contract document of the current routes (`buildOpenApi`) for oasdiff (`api-check`,
 * `api-baseline`) and Schemathesis (`api-conformance`). The destination is fixed in code, never
 * taken from an argument: `baseline` writes `packages/api/openapi.baseline.json`, no argument
 * writes `openapi.json` in the temporary directory (`TMPDIR`).
 * Needs `npm run build` at the root.
 */
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOpenApi } from '@open-reloading/api/openapi'

const [mode, ...rest] = process.argv.slice(2)
if (rest.length > 0 || (mode !== undefined && mode !== 'baseline'))
  throw new Error('usage: node src/openapi.ts [baseline]')
const target =
  mode === 'baseline'
    ? fileURLToPath(new URL('../../packages/api/openapi.baseline.json', import.meta.url))
    : join(tmpdir(), 'openapi.json')
writeFileSync(target, `${JSON.stringify(await buildOpenApi(), null, 2)}\n`)
