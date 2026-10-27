import { execFileSync } from 'node:child_process'
import { expect, it } from 'vitest'
import { importSpecifiers, plan, recordClosure } from '../scripts/ci-plan.mts'

const closure = recordClosure()
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
      'apps/web/AGENTS.md',
      'apps/web/test/api.test.ts',
    ],
    closure,
  )
  expect(p).toMatchObject({ check: true, e2e: true, prerender: 'sample' })
})

it('runs no e2e for unit tests, tools and other workflows, and nothing for prose alone', () => {
  for (const f of [
    'packages/core/test/recoil.test.ts',
    'apps/web/test/api.test.ts',
    'tools/src/load-fit.ts',
    'tools/src/audit.ts',
    '.github/workflows/release.yml',
    'README.md',
    'apps/docs/docs/models/bullet-fit.md',
  ])
    expect(plan([f], closure), f).toMatchObject({ check: true, e2e: false })
  for (const f of [
    'CONTRIBUTING.md',
    'apps/e2e/AGENTS.md',
    '.github/ISSUE_TEMPLATE/bug.yml',
    '.github/pull_request_template.md',
  ])
    expect(plan([f], closure), f).toMatchObject({ check: false, e2e: false })
  expect(plan(['compose.yaml'], closure)).toMatchObject({ check: true, e2e: true })
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

it('builds with the sample when the web app changed outside the record pages', () => {
  expect(plan(['apps/web/src/components/workbench.tsx'], closure)).toMatchObject({
    prerender: 'sample',
  })
  expect(plan(['apps/web/src/app/layout.tsx'], closure)).toMatchObject({
    prerender: 'sample',
  })
})

it('prerenders every record when record data, page code or shared parts changed', () => {
  for (const f of [
    'packages/data/records/powders/delta-2460.json',
    'packages/schema/src/units.ts',
    'packages/api/src/server.ts',
    'packages/drawing/src/index.ts',
    'apps/web/src/app/bullets/[id]/page.tsx',
    'apps/web/src/components/record-page.tsx',
    'apps/web/src/lib/api.ts',
    'apps/web/next.config.ts',
    'package-lock.json',
    'patches/apply.mjs',
    '.github/workflows/ci.yml',
  ])
    expect(plan(['README.md', f], closure), f).toMatchObject({
      check: true,
      e2e: true,
      prerender: 'full',
    })
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
  const full = 'check=true\ne2e=true\nprerender=full\n'
  expect(run({ EVENT_NAME: 'push', BASE_SHA: 'HEAD' })).toBe(full)
  expect(run({ EVENT_NAME: 'release', BASE_SHA: 'HEAD' })).toBe(full)
  expect(run({})).toBe(full)
  expect(run({ EVENT_NAME: 'pull_request' })).toBe(full)
  expect(run({ EVENT_NAME: 'pull_request', BASE_SHA: '0'.repeat(40) })).toBe(full)
  expect(run({ EVENT_NAME: 'pull_request', BASE_SHA: 'not a revision' })).toBe(full)
})
