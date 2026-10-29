import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The JSON Schemas the build writes (`src/write-json-schema.ts`), against the committed baseline.
// `npm run baselines` at the root rewrites it.
const built = new URL('../dist/json-schema/', import.meta.url)
const baseline = new URL('golden/json-schema/', import.meta.url)
const names = readdirSync(built).sort()

describe('JSON Schema baseline', () => {
  it('has a file for each built schema and no other', () => {
    expect(readdirSync(baseline).sort()).toEqual(names)
  })

  it.each(names)('%s equals the baseline', async (name) => {
    await expect(readFileSync(new URL(name, built), 'utf8')).toMatchFileSnapshot(
      `golden/json-schema/${name}`,
    )
  })

  it('reaches a file through the export of the package name', () => {
    const path = createRequire(import.meta.url).resolve(
      '@open-reloading/schema/json-schema/bullet.schema.json',
    )
    expect(path).toBe(fileURLToPath(new URL('bullet.schema.json', built)))
  })
})
