import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { result } from './result.ts'

/** Where the docs site serves `schema/result.schema.json`: the identifier of the schema. */
const id = 'https://openreloading.github.io/Ballistics/docs/result.schema.json'

/** The JSON schema of every result, as `schema/result.schema.json` of the package. */
export const resultJsonSchema = () => {
  const { $schema, ...schema } = z.toJSONSchema(result, { io: 'output' })
  return `${JSON.stringify({ $schema, $id: id, ...schema }, null, 2)}\n`
}

if (import.meta.main) {
  const out = join(import.meta.dirname, '..', 'schema')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'result.schema.json'), resultJsonSchema())
}
