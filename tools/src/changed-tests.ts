/**
 * The tests of `pnpm run check:changed`: the test jobs CI's plan (apps/web/scripts/ci-plan.mts) gives a pull request
 * whose base is the merge base with `origin/main`, with uncommitted and untracked files counted as changed. The plan
 * tests the workspaces a change reaches, every group for a change outside them (the lockfile, a root config), and none
 * for prose only.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { executable } from './executable.ts'

const root = path.join(import.meta.dirname, '../..')
const git = (...args: string[]) =>
  execFileSync(executable('git'), args, { cwd: root, encoding: 'utf8' }).trim()

const env: NodeJS.ProcessEnv = {
  ...process.env,
  EVENT_NAME: 'pull_request',
  BASE_SHA: git('merge-base', 'origin/main', 'HEAD'),
}
// pnpm's selection of the plan sees no untracked file, so one in a workspace takes the plan's fail-closed path
const untracked = git('ls-files', '--others', '--exclude-standard')
  .split('\n')
  .find((f) => /^((packages|apps|tooling)\/[^/]+|tools)\//.test(f))
if (untracked !== undefined) {
  console.error(`changed-tests: ${untracked} is untracked, so every test group runs`)
  delete env.BASE_SHA
}
const planned = execFileSync(
  process.execPath,
  ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'apps/web/scripts/ci-plan.mts'],
  { cwd: root, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'inherit'] },
)
const tests = /^tests=(.*)$/m.exec(planned)?.[1]
if (tests === undefined) throw new Error('ci-plan.mts printed no tests= line')
const jobs = JSON.parse(tests) as { filter: string; e2eUnit: boolean }[]
const pnpm = (...args: string[]) =>
  execFileSync(executable('pnpm'), args, { cwd: root, stdio: 'inherit' })
for (const { filter, e2eUnit } of jobs) {
  if (filter !== '') pnpm('--workspace-concurrency=1', ...filter.split(' '), 'run', 'test')
  if (e2eUnit) pnpm('--filter', '@open-reloading/e2e', 'run', 'test:unit')
}
