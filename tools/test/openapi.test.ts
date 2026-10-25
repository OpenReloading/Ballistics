import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const script = fileURLToPath(new URL('../src/openapi.ts', import.meta.url))

it.each([['../escape.json'], ['/etc/openapi.json'], ['baseline', 'extra']])(
  'takes no destination path: %s',
  (...args) => {
    const run = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
    expect(run.status).not.toBe(0)
    expect(run.stderr).toContain('usage: node src/openapi.ts [baseline]')
  },
)
