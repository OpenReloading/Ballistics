import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))

// A copied configuration would miss what the base sets, such as a forgotten export failing the run.
it('lets the API Extractor config of a package only extend the shared base', () => {
  const files = globSync('packages/*/api-extractor.json', { cwd: root })
  expect(files.length).toBeGreaterThan(0)
  for (const file of files) {
    expect(JSON.parse(readFileSync(join(root, file), 'utf8')), file).toEqual({
      $schema:
        'https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json',
      extends: '../api-extractor.base.json',
    })
  }
})
