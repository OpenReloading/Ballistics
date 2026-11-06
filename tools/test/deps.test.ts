import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'

/** Source of each file of a mirror of the repository layout and the boundary rules Oxlint names for it. */
const fixture: Record<string, { source: string; rules: string[] }> = JSON.parse(
  readFileSync(new URL('fixtures/deps-rules.json', import.meta.url), 'utf8'),
)
const root = fileURLToPath(new URL('../..', import.meta.url))
const oxlint = join(root, 'node_modules/.bin/oxlint')
/** The configurations the mirror lints with: the root one, the base of the logic packages and the own ones that extend it. */
const configs = [
  '.oxlintrc.json',
  'packages/oxlint.logic.json',
  'packages/units/.oxlintrc.json',
  'packages/locale-format/.oxlintrc.json',
  'packages/schema/.oxlintrc.json',
  'packages/statistics/.oxlintrc.json',
  'packages/ballistics/.oxlintrc.json',
  'packages/shot-groups/.oxlintrc.json',
  'packages/importers/.oxlintrc.json',
]

let mirror = ''

beforeAll(() => {
  mirror = mkdtempSync(join(tmpdir(), 'deps-rules-'))
  for (const [file, { source }] of Object.entries(fixture)) {
    mkdirSync(join(mirror, dirname(file)), { recursive: true })
    writeFileSync(join(mirror, file), `${source}\n`)
  }
  for (const config of configs) copyFileSync(join(root, config), join(mirror, config))
})

afterAll(() => rmSync(mirror, { recursive: true, force: true }))

const lint = (...args: string[]) =>
  spawnSync(oxlint, args, { cwd: mirror, encoding: 'utf8', maxBuffer: 64 << 20 })

/** The boundary rule a diagnostic names: the `name:` its message starts with, the cycle rule or the type-import rule. */
const ruleOf = (d: { code: string; message: string; help?: string }) =>
  ({
    'import(no-cycle)': 'no-cycle',
    'vitest(no-identical-title)': 'no-identical-title',
    'typescript(no-import-type-side-effects)': 'no-import-type-side-effects',
  })[d.code] ?? /\b([a-z]+(?:-[a-z]+)+): /.exec(`${d.help ?? ''} ${d.message}`)?.[1]

it('names the rule each forbidden import or global breaks and passes the allowed ones', () => {
  const report = JSON.parse(lint('--format', 'json').stdout) as {
    diagnostics: { filename: string; code: string; message: string; help?: string }[]
  }
  const found: Record<string, Set<string>> = Object.fromEntries(
    Object.keys(fixture).map((f) => [f, new Set<string>()]),
  )
  for (const d of report.diagnostics) {
    const rule = ruleOf(d)
    if (rule) found[d.filename]?.add(rule)
  }
  const expected = Object.fromEntries(Object.entries(fixture).map(([f, { rules }]) => [f, rules]))
  expect(Object.fromEntries(Object.entries(found).map(([f, r]) => [f, [...r].sort()]))).toEqual(
    expected,
  )
})

it('lets the config of a logic package add only its import rule to the base', () => {
  const shapes = globSync('packages/*/.oxlintrc.json', { cwd: root }).map((file) => {
    const config: { extends: string[]; overrides: { rules: object }[] } = JSON.parse(
      readFileSync(join(root, file), 'utf8'),
    )
    const overrides = config.overrides.map((o) => [Object.keys(o).sort(), Object.keys(o.rules)])
    return { file, keys: Object.keys(config).sort(), extends: config.extends, overrides }
  })
  expect(shapes.length).toBeGreaterThan(0)
  // Oxlint takes the nearest config of any of its names, so a package holds only the one checked here
  const anyConfig = globSync('packages/**/{.oxlintrc.json,.oxlintrc.jsonc,oxlint.config.*}', {
    cwd: root,
    exclude: (p) => basename(p) === 'node_modules',
  })
  expect(anyConfig.sort()).toEqual(shapes.map(({ file }) => file).sort())
  expect(shapes).toEqual(
    shapes.map(({ file, overrides }) => ({
      file,
      keys: ['$schema', 'extends', 'overrides'],
      extends: ['../oxlint.logic.json'],
      overrides: overrides.map(() => [['files', 'rules'], ['no-restricted-imports']]),
    })),
  )
})

it('exits non-zero and prints the rule name', () => {
  // the default format, also on GitHub, where Oxlint would otherwise write annotations without the help text
  const run = lint('--format', 'default')
  expect(run.status).toBeGreaterThan(0)
  expect(run.stdout).toContain('web-reads-api-only')
})
