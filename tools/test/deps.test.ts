import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'

/** Source of each file of a mirror of the repository layout and the rules the check names for it. */
const fixture: Record<string, { source: string; rules: string[] }> = JSON.parse(
  readFileSync(new URL('fixtures/deps-rules.json', import.meta.url), 'utf8'),
)
const root = fileURLToPath(new URL('../..', import.meta.url))
const cruiser = join(root, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs')

let mirror = ''

beforeAll(() => {
  mirror = mkdtempSync(join(tmpdir(), 'deps-rules-'))
  for (const [file, { source }] of Object.entries(fixture)) {
    mkdirSync(join(mirror, dirname(file)), { recursive: true })
    writeFileSync(join(mirror, file), `${source}\n`)
  }
})

afterAll(() => rmSync(mirror, { recursive: true, force: true }))

/** The check as the `deps:check` script runs it, over the mirror, with one reporter. */
const cruise = (outputType: string) =>
  spawnSync(
    process.execPath,
    [
      cruiser,
      'packages',
      'apps',
      '--config',
      join(root, '.dependency-cruiser.cjs'),
      '--output-type',
      outputType,
    ],
    { cwd: mirror, encoding: 'utf8', maxBuffer: 64 << 20 },
  )

it('names the rule each forbidden import breaks and passes the allowed ones', () => {
  const run = cruise('json')
  const report = JSON.parse(run.stdout) as {
    summary: { violations: { from: string; rule: { name: string } }[] }
  }
  const found: Record<string, Set<string>> = Object.fromEntries(
    Object.keys(fixture).map((f) => [f, new Set<string>()]),
  )
  for (const { from, rule } of report.summary.violations) found[from]?.add(rule.name)
  const expected = Object.fromEntries(Object.entries(fixture).map(([f, { rules }]) => [f, rules]))
  expect(Object.fromEntries(Object.entries(found).map(([f, r]) => [f, [...r].sort()]))).toEqual(
    expected,
  )
})

it('exits non-zero and prints the rule name', () => {
  const run = cruise('err')
  expect(run.status).toBeGreaterThan(0)
  expect(run.stdout).toContain('web-reads-api-only')
})
