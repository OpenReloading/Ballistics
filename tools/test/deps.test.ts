import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
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
/** The configurations the mirror lints with: the root one, the bases of the logic and the UI packages and the own ones that extend them. */
const configs = [
  '.oxlintrc.json',
  'packages/oxlint.logic.json',
  'packages/oxlint.ui.json',
  'packages/units/.oxlintrc.json',
  'packages/locale-format/.oxlintrc.json',
  'packages/design-tokens/.oxlintrc.json',
  'packages/schema/.oxlintrc.json',
  'packages/statistics/.oxlintrc.json',
  'packages/ballistics/.oxlintrc.json',
  'packages/shot-groups/.oxlintrc.json',
  'packages/importers/.oxlintrc.json',
  'packages/catalog/.oxlintrc.json',
  'packages/use-cases/.oxlintrc.json',
  'packages/target-recognition/.oxlintrc.json',
  'packages/ui/.oxlintrc.json',
]

let mirror = ''

beforeAll(() => {
  mirror = mkdtempSync(join(tmpdir(), 'deps-rules-'))
  for (const [file, { source }] of Object.entries(fixture)) {
    mkdirSync(join(mirror, dirname(file)), { recursive: true })
    writeFileSync(join(mirror, file), `${source}\n`)
  }
  for (const config of configs) copyFileSync(join(root, config), join(mirror, config))
  // the configs load the regexp rules as a JS plugin, resolved from node_modules
  const plugin = 'node_modules/eslint-plugin-regexp'
  mkdirSync(join(mirror, 'node_modules'))
  symlinkSync(join(root, plugin), join(mirror, plugin), 'dir')
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
    'jsx-a11y(alt-text)': 'alt-text',
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

/** A package that renders React at run time, which the UI base lints with the React and jsx-a11y rules. */
const usesReact = (dir: string) => {
  const manifest: Record<string, Record<string, string> | undefined> = JSON.parse(
    readFileSync(join(root, dir, 'package.json'), 'utf8'),
  )
  return Boolean(manifest['dependencies']?.['react'] ?? manifest['peerDependencies']?.['react'])
}

it('lets the config of a package add only its import rule to its base', () => {
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
      extends: [usesReact(dirname(file)) ? '../oxlint.ui.json' : '../oxlint.logic.json'],
      overrides: overrides.map(() => [['files', 'rules'], ['no-restricted-imports']]),
    })),
  )
})

// A package with its own config would also get the untyped root run, which reports its typed disable lines as unused
it('leaves every package with its own config out of the root Oxlint, in the lint script and in the pre-commit hook', () => {
  const own = globSync('packages/*/.oxlintrc.json', { cwd: root })
    .map((file) => dirname(file))
    .toSorted()
  const lint: string = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts.lint
  const ignored = [...lint.matchAll(/--ignore-pattern "(packages\/[^/"]+)\/\*\*"/g)].map(
    (m) => m[1],
  )
  const hook = readFileSync(join(root, 'hooks/pre-commit'), 'utf8')
  const skipped = [...hook.matchAll(/':!(packages\/[^/']+)\/'/g)].map((m) => m[1])
  expect(ignored.toSorted()).toEqual(own)
  expect(skipped.toSorted()).toEqual(own)
})

it('exits non-zero and prints the rule name', () => {
  // the default format, also on GitHub, where Oxlint would otherwise write annotations without the help text
  const run = lint('--format', 'default')
  expect(run.status).toBeGreaterThan(0)
  expect(run.stdout).toContain('web-reads-api-only')
})
