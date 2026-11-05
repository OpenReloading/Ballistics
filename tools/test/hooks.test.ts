import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
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
const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim()

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()

const install = (cwd = repo, extra: Record<string, string> = {}) =>
  spawnSync(process.execPath, [join(hooks, 'install.mjs')], {
    cwd,
    env: { ...env, ...extra },
    encoding: 'utf8',
  })

/** A fake `tool` (biome or oxlint) that answers `--version`, records its other calls and exits with `code`. */
function fake(tool: string, code: number) {
  const bin = join(repo, 'node_modules/.bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(
    join(bin, tool),
    `#!/bin/sh\n[ "$1" = --version ] && exit 0\necho "${tool} $*" >> ${tool}.log\nexit ${code}\n`,
  )
  chmodSync(join(bin, tool), 0o755)
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

it('keeps a stub the contributor edited', () => {
  install()
  const file = join(repo, '.git/hooks/pre-commit')
  writeFileSync(file, `${readFileSync(file, 'utf8')}echo mine\n`)
  expect(install().stdout).toContain('is another hook')
  expect(readFileSync(file, 'utf8')).toContain('echo mine')
})

it('reports a hooks folder it cannot write instead of failing', () => {
  rmSync(join(repo, '.git/hooks'), { recursive: true })
  writeFileSync(join(repo, '.git/hooks'), 'a file where the folder should be')
  const run = install()
  expect(run.status).toBe(0)
  expect(run.stdout).toContain('cannot be written')
})

it('finds git on PATH wherever it is installed', () => {
  const bin = join(repo, 'bin')
  mkdirSync(bin)
  writeFileSync(
    join(bin, 'git'),
    `#!/bin/sh\necho used >> "${repo}/git.log"\nexec "${realGit}" "$@"\n`,
  )
  chmodSync(join(bin, 'git'), 0o755)
  expect(install(repo, { PATH: bin }).status).toBe(0)
  expect(existsSync(join(repo, 'git.log'))).toBe(true)
  expect(existsSync(join(repo, '.git/hooks/pre-commit'))).toBe(true)
})

it('does not write an identical stub again and leaves no temporary file', () => {
  install()
  const file = join(repo, '.git/hooks/pre-commit')
  chmodSync(file, 0o444)
  expect(install().stdout).toBe('')
  expect(readdirSync(join(repo, '.git/hooks')).filter((name) => !name.endsWith('.sample'))).toEqual(
    ['pre-commit'],
  )
})

it('installs nothing in CI', () => {
  expect(install(repo, { CI: 'true' }).stdout).toBe('')
  expect(existsSync(join(repo, '.git/hooks/pre-commit'))).toBe(false)
})

it('checks the staged files and refuses a commit Biome fails', () => {
  install()
  fake('oxlint', 0)
  fake('biome', 1)
  const run = commit()
  expect(run.status).not.toBe(0)
  expect(run.stderr).toContain('fix the findings above')
  expect(readFileSync(join(repo, 'biome.log'), 'utf8')).toContain('check --staged')
})

it('lints the staged code files with Oxlint and refuses a commit it fails', () => {
  install()
  fake('oxlint', 1)
  fake('biome', 0)
  const run = commit()
  expect(run.status).not.toBe(0)
  expect(readFileSync(join(repo, 'oxlint.log'), 'utf8')).toContain('a.ts')
  expect(existsSync(join(repo, 'biome.log'))).toBe(false)
})

it('lets a commit through when both pass', () => {
  install()
  fake('oxlint', 0)
  fake('biome', 0)
  expect(commit().status).toBe(0)
})

it('says so and goes on where the linters do not run', () => {
  install()
  fake('biome', 1)
  const run = commit()
  expect(run.status).toBe(0)
  expect(run.stderr).toContain('Oxlint or Biome does not run in this checkout')
})

it('does nothing in CI', () => {
  install()
  fake('oxlint', 1)
  fake('biome', 1)
  expect(commit({ CI: 'true' }).status).toBe(0)
})
