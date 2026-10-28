import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { result } from './result.ts'

/** The JSON schema of every result, as `schema/result.schema.json` of the package. */
export const resultJsonSchema = () =>
  `${JSON.stringify(z.toJSONSchema(result, { io: 'output' }), null, 2)}\n`

if (import.meta.main) {
  const out = join(import.meta.dirname, '..', 'schema')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'result.schema.json'), resultJsonSchema())
}
