import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'

const hooks = resolve(import.meta.dirname, '../../hooks')
// no global config: a developer's own hooks path or signing setup must not reach the fixture
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', CI: '' }

let repo: string

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()

const install = (cwd = repo, extra: Record<string, string> = {}) =>
  spawnSync('node', [join(hooks, 'install.mjs')], {
    cwd,
    env: { ...env, ...extra },
    encoding: 'utf8',
  })

/** A fake Biome that answers `--version`, records its other calls and exits with `code`. */
function fakeBiome(code: number) {
  const bin = join(repo, 'node_modules/.bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(
    join(bin, 'biome'),
    `#!/bin/sh\n[ "$1" = --version ] && exit 0\necho "biome $*" >> biome.log\nexit ${code}\n`,
  )
  chmodSync(join(bin, 'biome'), 0o755)
}

function commit(extra: Record<string, string> = {}) {
  writeFileSync(join(repo, 'a.ts'), 'x\n')
  git(repo, 'add', 'a.ts')
  return spawnSync('git', ['commit', '-m', 'test'], {
    cwd: repo,
    env: { ...env, ...extra },
    encoding: 'utf8',
  })
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'hooks-'))
  git(repo, 'init', '-q')
  git(repo, 'config', 'user.name', 'test')
  git(repo, 'config', 'user.email', 'test@example.com')
  git(repo, 'config', 'commit.gpgsign', 'false')
  mkdirSync(join(repo, 'hooks'))
  copyFileSync(join(hooks, 'pre-commit'), join(repo, 'hooks/pre-commit'))
  chmodSync(join(repo, 'hooks/pre-commit'), 0o755)
})

afterEach(() => rmSync(repo, { recursive: true, force: true }))

it('installs a stub into the hooks folder and repeats without change', () => {
  expect(install().status).toBe(0)
  const file = join(repo, '.git/hooks/pre-commit')
  const first = readFileSync(file, 'utf8')
  expect(first).toContain('managed by hooks/install.mjs')
  expect(install().stdout).toBe('')
  expect(readFileSync(file, 'utf8')).toBe(first)
  expect(spawnSync('git', ['config', 'core.hooksPath'], { cwd: repo, env }).status).toBe(1)
})

it('serves every worktree from the one install', () => {
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'init')
  const tree = `${repo}-tree`
  git(repo, 'worktree', 'add', '-q', tree)
  try {
    expect(install(tree).status).toBe(0)
    expect(existsSync(join(repo, '.git/hooks/pre-commit'))).toBe(true)
  } finally {
    rmSync(tree, { recursive: true, force: true })
  }
})

it('leaves a hooks path of the contributor alone', () => {
  git(repo, 'config', 'core.hooksPath', '/somewhere/else')
  const run = install()
  expect(run.stdout).toContain('core.hooksPath is set')
  expect(existsSync(join(repo, '.git/hooks/pre-commit'))).toBe(false)
})

it('does not overwrite another pre-commit hook', () => {
  mkdirSync(join(repo, '.git/hooks'), { recursive: true })
  writeFileSync(join(repo, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 0\n')
  expect(install().stdout).toContain('is another hook')
  expect(readFileSync(join(repo, '.git/hooks/pre-commit'), 'utf8')).toBe('#!/bin/sh\nexit 0\n')
})

it('installs nothing in CI', () => {
  expect(install(repo, { CI: 'true' }).stdout).toBe('')
  expect(existsSync(join(repo, '.git/hooks/pre-commit'))).toBe(false)
})

it('checks the staged files and refuses a commit Biome fails', () => {
  install()
  fakeBiome(1)
  const run = commit()
  expect(run.status).not.toBe(0)
  expect(run.stderr).toContain('fix the findings above')
  expect(readFileSync(join(repo, 'biome.log'), 'utf8')).toContain('check --staged')
})

it('lets a commit through when Biome passes', () => {
  install()
  fakeBiome(0)
  expect(commit().status).toBe(0)
})

it('says so and goes on where Biome does not run', () => {
  install()
  const run = commit()
  expect(run.status).toBe(0)
  expect(run.stderr).toContain('Biome does not run in this checkout')
})

it('does nothing in CI', () => {
  install()
  fakeBiome(1)
  expect(commit({ CI: 'true' }).status).toBe(0)
})
