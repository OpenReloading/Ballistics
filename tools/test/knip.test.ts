import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'

const knip = fileURLToPath(new URL('../../node_modules/knip/bin/knip.js', import.meta.url))

let project = ''

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'knip-'))
  mkdirSync(join(project, 'src'))
  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      type: 'module',
      main: 'src/index.ts',
      dependencies: { zod: '4.0.0' },
    }),
  )
  writeFileSync(
    join(project, 'src/index.ts'),
    "import { used } from './used.ts'\nconsole.log(used)\n",
  )
  writeFileSync(
    join(project, 'src/used.ts'),
    'export const used = 1\nexport const unusedExport = 2\n',
  )
  writeFileSync(join(project, 'src/orphan.ts'), 'export const orphan = 3\n')
})

afterAll(() => rmSync(project, { recursive: true, force: true }))

it('fails on an unused file, export and dependency', () => {
  const run = spawnSync(process.execPath, [knip, '--no-progress'], {
    cwd: project,
    encoding: 'utf8',
  })
  expect(run.status).toBeGreaterThan(0)
  expect(run.stdout).toContain('src/orphan.ts')
  expect(run.stdout).toContain('unusedExport')
  expect(run.stdout).toContain('zod')
})
