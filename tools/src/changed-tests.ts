/**
 * The tests of `pnpm run check:changed`: the test jobs CI's plan (apps/web/scripts/ci-plan.mts) gives a pull request
 * whose base is the merge base with `origin/main`, with uncommitted and untracked files counted as changed. The plan
 * tests the workspaces a change reaches, every group for a change outside them (the lockfile, a root config), and none
 * for prose only.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = path.join(import.meta.dirname, '../..')

const base = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim()
const planned = execFileSync(
  process.execPath,
  ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'apps/web/scripts/ci-plan.mts'],
  {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, EVENT_NAME: 'pull_request', BASE_SHA: base },
    stdio: ['ignore', 'pipe', 'inherit'],
  },
)
const tests = /^tests=(.*)$/m.exec(planned)?.[1]
if (tests === undefined) throw new Error('ci-plan.mts printed no tests= line')
const jobs = JSON.parse(tests) as { filter: string; e2eUnit: boolean }[]
const pnpm = (...args: string[]) => execFileSync('pnpm', args, { cwd: root, stdio: 'inherit' })
for (const { filter, e2eUnit } of jobs) {
  if (filter !== '') pnpm('--workspace-concurrency=1', ...filter.split(' '), 'run', 'test')
  if (e2eUnit) pnpm('--filter', '@open-reloading/e2e', 'run', 'test:unit')
}
