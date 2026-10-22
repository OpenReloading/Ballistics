import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import config from '../playwright.config.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

it('the snapshot path of the drawing baseline names no project and finds a committed file', () => {
  const template = config.snapshotPathTemplate ?? ''
  expect(template).not.toMatch(/projectName/)
  for (const p of config.projects ?? []) {
    expect(p.snapshotPathTemplate, p.name).toBeUndefined()
    expect(p.snapshotDir, p.name).toBeUndefined()
  }
  const full = config.projects?.find((p) => p.name === 'full')
  // the tokens of the template above, for one file of tests/web/drawing-baseline.spec.ts
  const file = template
    .replace('{testDir}', path.resolve(root, full?.testDir ?? ''))
    .replace('{testFileDir}', '')
    .replace('{testFileName}', 'drawing-baseline.spec.ts')
    .replace('{arg}', 'styles-light')
    .replace('{-snapshotSuffix}', '-linux')
    .replace('{ext}', '.txt')
  expect(existsSync(path.normalize(file)), file).toBe(true)
})
