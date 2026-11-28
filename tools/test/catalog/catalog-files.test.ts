import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readRecords } from '@rangefoundry/catalog-files'
import { expect, it } from 'vitest'

it('names a malformed record file among the errors of its root', () => {
  const root = mkdtempSync(join(tmpdir(), 'catalog-files-'))
  try {
    mkdirSync(join(root, 'powders'))
    writeFileSync(join(root, 'powders', 'broken.json'), '{ "id": ')
    expect(readRecords(root).errors).toContainEqual(
      expect.stringMatching(/^powders\/broken\.json: invalid JSON: /),
    )
  } finally {
    rmSync(root, { recursive: true })
  }
})
