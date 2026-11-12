import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
  importSpecifiers,
  plan,
  recordClosure,
  selected,
  testGroups,
  testJobs,
} from '../scripts/ci-plan.mts'

const closure = recordClosure()
const root = new URL('../../../', import.meta.url).pathname
const script = new URL('../scripts/ci-plan.mts', import.meta.url).pathname

it('walks the imports of the record pages', () => {
  expect(closure.files).toContain('apps/web/src/app/cartridges/[id]/page.tsx')
  expect(closure.files).toContain('apps/web/src/app/targets/[id]/page.tsx')
  expect(closure.files).toContain('apps/web/src/app/disciplines/[id]/page.tsx')
  expect(closure.files).toContain('apps/web/src/app/federations/[id]/page.tsx')
  expect(closure.files).toContain('apps/web/src/components/record-page.tsx')
  expect(closure.files).toContain('apps/web/src/lib/api.ts')
  expect(closure.files).not.toContain('apps/web/src/components/workbench.tsx')
  expect(closure.packages).toContain('drawing')
})

it('reads the specifiers of static, side-effect and dynamic imports', () => {
  const source = [
    "import { a } from './a.ts'",
    'import b from "./b.ts"',
    "import './c.css'",
    "const d = await import('./d.ts')",
    "const e = await import(   './e.ts')",
    "export * from '@/f.ts'",
    "const note = 'from nowhere'",
  ].join('\n')
  expect(importSpecifiers(source)).toEqual([
    './a.ts',
    './b.ts',
    './c.css',
    './d.ts',
    './e.ts',
    '@/f.ts',
  ])
  expect(importSpecifiers(`import${' '.repeat(5000)}x`)).toEqual([])
})

it('builds nothing when no changed file feeds the web build', () => {
  const p = plan(
    [
      'apps/e2e/tests/web/groups.spec.ts',
      'README.md',
      'apps/web/CHANGELOG.md',
      'apps/web/test/api.test.ts',
    ],
    closure,
  )
  expect(p).toMatchObject({ check: true, e2e: true, prerender: 'sample' })
})

it('runs no e2e for unit tests, tools and other workflows, and nothing for prose alone', () => {
  for (const f of [
    'packages/ballistics/test/recoil.test.ts',
    'apps/web/test/api.test.ts',
    'tools/src/load-fit.ts',
    'tools/src/audit.ts',
    'packages/cli/src/rows.ts',
    'packages/cli/package.json',
    '.github/workflows/release.yml',
    'README.md',
    'apps/docs/docs/models/bullet-fit.md',
    // the units build compares its API report
    'packages/units/units.api.md',
  ])
    expect(plan([f], closure), f).toMatchObject({ check: true, e2e: false })
  for (const f of [
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    '.github/ISSUE_TEMPLATE/bug.yml',
    '.github/pull_request_template.md',
  ])
    expect(plan([f], closure), f).toMatchObject({ check: false, e2e: false })
  for (const f of ['.github/ISSUE_TEMPLATE/user-report.yml', 'NOTICE'])
    expect(plan([f], closure), f).toMatchObject({ check: true, e2e: false })
  for (const f of ['compose.yaml', '.dockerignore'])
    expect(plan([f], closure), f).toMatchObject({ check: true, e2e: true })
})

it('runs the e2e job for the scripts that build and serve the export', () => {
  for (const f of [
    'tools/src/pages.ts',
    'tools/src/pages-serve.ts',
    'tools/src/pages-payload.ts',
    'tools/src/executable.ts',
  ])
    expect(plan([f], closure), f).toMatchObject({ check: true, e2e: true })
})

it('runs the e2e job for a change of the design tokens, whose palette the web app loads', () => {
  expect(plan(['packages/design-tokens/tokens/base.tokens.json'], closure).e2e).toBe(true)
})

it('builds with the sample when the web app changed outside the record pages', () => {
  expect(plan(['apps/web/src/components/workbench.tsx'], closure)).toMatchObject({
    prerender: 'sample',
  })
  expect(plan(['apps/web/src/app/layout.tsx'], closure)).toMatchObject({
    prerender: 'sample',
  })
  expect(plan(['apps/web/news/2026-10-28-whats-new.md'], closure)).toMatchObject({
    check: true,
    e2e: true,
    prerender: 'sample',
  })
})

it('prerenders every record when record data, page code or shared parts changed', () => {
  for (const f of [
    'packages/catalog/records/powders/delta-2460.json',
    'packages/units/src/units.ts',
    'packages/locale-format/src/display-units.ts',
    'packages/schema/src/units.ts',
    'packages/api/src/server.ts',
    'packages/drawing/src/index.ts',
    'apps/web/src/app/bullets/[id]/page.tsx',
    'apps/web/src/components/record-page.tsx',
    'apps/web/src/lib/api.ts',
    'apps/web/next.config.ts',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.github/pnpm/package-lock.json',
    '.github/actions/pnpm/action.yml',
    '.github/workflows/ci.yml',
  ])
    expect(plan(['README.md', f], closure), f).toMatchObject({
      check: true,
      e2e: true,
      prerender: 'full',
    })
})

const packages =
  '--filter @open-reloading/units --filter @open-reloading/locale-format --filter @open-reloading/design-tokens --filter @open-reloading/statistics --filter @open-reloading/ballistics --filter @open-reloading/shot-groups --filter @open-reloading/schema --filter @open-reloading/importers --filter @open-reloading/catalog --filter @open-reloading/target-recognition --filter @open-reloading/use-cases --filter @open-reloading/api --filter @open-reloading/docs --filter @open-reloading/tools --filter @open-reloading/test-kit'
/** The workspaces of the packages group that a change of units reaches. */
const reachedByUnits =
  '--filter @open-reloading/units --filter @open-reloading/locale-format --filter @open-reloading/ballistics --filter @open-reloading/shot-groups --filter @open-reloading/schema --filter @open-reloading/importers --filter @open-reloading/catalog --filter @open-reloading/target-recognition --filter @open-reloading/use-cases --filter @open-reloading/api --filter @open-reloading/docs --filter @open-reloading/tools'

it('tests every workspace of every group without a list of affected ones', () => {
  expect(testJobs()).toEqual([
    { name: 'drawing', filter: '--filter @open-reloading/drawing', e2eUnit: false },
    { name: 'web', filter: '--filter @open-reloading/web', e2eUnit: false },
    { name: 'packages', filter: packages, e2eUnit: true },
    { name: 'cli', filter: '--filter @open-reloading/cli', e2eUnit: false },
    { name: 'ui', filter: '--filter @open-reloading/ui', e2eUnit: false },
  ])
})

it('tests the workspaces a change reaches and leaves out the groups it does not', () => {
  // a change of units as pnpm selects it: units and every workspace that depends on it
  const units = [
    'units',
    'locale-format',
    'ballistics',
    'shot-groups',
    'web',
    'cli',
    'docs',
    'api',
    'tools',
    'schema',
    'catalog',
    'importers',
    'use-cases',
    'target-recognition',
  ]
  expect(plan(['packages/units/src/units.ts'], closure, units).tests).toEqual([
    { name: 'web', filter: '--filter @open-reloading/web', e2eUnit: false },
    { name: 'packages', filter: reachedByUnits, e2eUnit: false },
    { name: 'cli', filter: '--filter @open-reloading/cli', e2eUnit: false },
  ])
  expect(plan(['packages/drawing/src/index.ts'], closure, ['drawing', 'web', 'cli']).tests).toEqual(
    [
      { name: 'drawing', filter: '--filter @open-reloading/drawing', e2eUnit: false },
      { name: 'web', filter: '--filter @open-reloading/web', e2eUnit: false },
      { name: 'cli', filter: '--filter @open-reloading/cli', e2eUnit: false },
    ],
  )
  expect(plan(['apps/e2e/tests/web/groups.spec.ts'], closure, ['e2e']).tests).toEqual([
    { name: 'packages', filter: '', e2eUnit: true },
  ])
})

it('tests every group for a change outside the workspaces, an unknown or empty selection, and none for prose', () => {
  for (const f of [
    'pnpm-lock.yaml',
    'package.json',
    '.github/workflows/ci.yml',
    'tsconfig.base.json',
  ])
    expect(plan(['packages/drawing/src/index.ts', f], closure, ['drawing']).tests, f).toEqual(
      testJobs(),
    )
  expect(plan(['packages/drawing/src/index.ts'], closure).tests).toEqual(testJobs())
  // a folder of packages/ that is no workspace: pnpm selects nothing for it
  expect(plan(['packages/stray/src/index.ts'], closure, []).tests).toEqual(testJobs())
  // and it selects the workspaces beside it alone
  expect(
    plan(['packages/stray/src/index.ts', 'packages/drawing/src/index.ts'], closure, ['drawing'])
      .tests,
  ).toEqual(testJobs())
  // a workspace that no group lists (a new one)
  expect(testJobs(['drawing', 'stray'])).toEqual(testJobs())
  // the catalog reader of tools, which writes the bundle other workspaces' tests read
  expect(plan(['tools/src/catalog/read-kind.ts'], closure, ['tools', 'cli', 'docs']).tests).toEqual(
    testJobs(),
  )
  expect(plan(['apps/docs/docs/research/index.md'], closure, ['docs']).tests).toEqual(
    testJobs(['docs']),
  )
  expect(plan(['CONTRIBUTING.md'], closure, []).tests).toEqual([])
})

// A test reads these workspaces' files without importing them; each reader declares the workspace it reads as a devDependency, so pnpm selects the reader when that workspace changes.
it.each([
  ['catalog', 'shot-groups'], // the event types and target faces (shot-groups/test)
  ['catalog', 'target-recognition'], // the target faces (target-recognition/test/face-render.ts)
  ['catalog', 'drawing'], // the bullet records (drawing/test/bullet-outline.test.ts)
  ['web', 'docs'], // files named in `Code:` lines, the photo checks (docs/scripts/photo-guide.test.mts)
  ['web', 'e2e'], // the German catalogue (e2e/scripts/visual-check.test.ts)
  ['web', 'tools'], // the browser sources (tools/test/browser-builtins.test.ts)
  ['importers', 'docs'], // the table fields (docs/scripts/table-import.test.mts)
  ['importers', 'tools'], // the browser sources and exports (tools/test)
  ['drawing', 'tools'], // the browser sources and exports (tools/test)
  ['cli', 'docs'], // files named in `Code:` lines and the research log
  ['tools', 'docs'], // files named in `Code:` lines and the research log
])('selects %s and its reader %s for a change of %s', (read, reader) => {
  expect(selected(`...@open-reloading/${read}`)).toContain(reader)
})

it('tests every workspace that has tests, in exactly one group', () => {
  const members = Object.values(testGroups).flat()
  const dirs = [
    ...['packages', 'apps', 'tooling'].flatMap((d) =>
      readdirSync(`${root}${d}`).map((n) => `${d}/${n}`),
    ),
    'tools',
  ]
  const withTests = dirs.flatMap((dir) => {
    const file = `${root}${dir}/package.json`
    if (!existsSync(file)) return []
    const { name, scripts } = JSON.parse(readFileSync(file, 'utf8')) as {
      name: string
      scripts?: Record<string, string>
    }
    return scripts?.test === undefined ? [] : [name.replace('@open-reloading/', '')]
  })
  expect(members.length).toBe(new Set(members).size)
  expect([...members].sort()).toEqual(withTests.sort())
})

it('leaves the root project out of the selection: plan reads its files itself', () => {
  expect(selected('openreloading')).toEqual([])
  expect(selected('@open-reloading/cli')).toEqual(['cli'])
})

it('falls back in ci.yml to the test jobs of every group', () => {
  expect(readFileSync(`${root}.github/workflows/ci.yml`, 'utf8')).toContain(
    JSON.stringify(testJobs()),
  )
})

it('falls back to a full build when the change list is empty', () => {
  expect(plan([], closure)).toMatchObject({ check: true, e2e: true, prerender: 'full' })
})

const run = (env: Record<string, string>, ...args: string[]) =>
  execFileSync('node', ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, ...args], {
    env: { ...process.env, EVENT_NAME: '', BASE_SHA: '', ...env },
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString()

it('is full unless the event is a pull request with a base commit that exists', () => {
  const full = `check=true\ne2e=true\nprerender=full\ntests=${JSON.stringify(testJobs())}\n`
  expect(run({ EVENT_NAME: 'push', BASE_SHA: 'HEAD' })).toBe(full)
  expect(run({ EVENT_NAME: 'release', BASE_SHA: 'HEAD' })).toBe(full)
  expect(run({})).toBe(full)
  expect(run({ EVENT_NAME: 'pull_request' })).toBe(full)
  expect(run({ EVENT_NAME: 'pull_request', BASE_SHA: '0'.repeat(40) })).toBe(full)
  expect(run({ EVENT_NAME: 'pull_request', BASE_SHA: 'not a revision' })).toBe(full)
})
