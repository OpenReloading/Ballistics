// Installs `hooks/pre-commit` into the hooks folder of this repository (root `postinstall`).
// The hook is a stub that runs the script of the checkout it is called in, so one install serves
// every git worktree. It never sets `core.hooksPath` and never overwrites a hook it did not write:
// a contributor's own hooks path or pre-commit hook (an edited stub too) wins, with a one-line
// message. Never fails the install.
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { delimiter, isAbsolute, join, resolve } from 'node:path'

const marker = '# managed by hooks/install.mjs'
const stub = `#!/bin/sh
${marker}
root=$(git rev-parse --show-toplevel) && [ -x "$root/hooks/pre-commit" ] && exec "$root/hooks/pre-commit" "$@"
exit 0
`

/** The absolute path of the first `git` on `PATH`; a relative entry (the working directory) is skipped. */
const findGit = () =>
  (process.env.PATH ?? '')
    .split(delimiter)
    .filter(isAbsolute)
    .map((dir) => join(dir, 'git'))
    .find((file) => existsSync(file))

/** The reason nothing was installed; nothing returned once the hook is in place. */
function install() {
  if (process.env.CI) return 'CI'
  const bin = findGit()
  if (!bin) return 'git not found'
  const git = (...args) =>
    execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  let hooksPath
  let folder
  try {
    hooksPath = git('config', '--get', 'core.hooksPath')
  } catch {
    // exit 1: not set
  }
  if (hooksPath) return `core.hooksPath is set to ${hooksPath}`
  try {
    folder = resolve(git('rev-parse', '--git-path', 'hooks'))
  } catch {
    return 'not a git checkout'
  }
  const file = join(folder, 'pre-commit')
  const temporary = `${file}.${process.pid}.tmp`
  try {
    if (existsSync(file)) {
      if (readFileSync(file, 'utf8') !== stub) return `${file} is another hook`
      return
    }
    mkdirSync(folder, { recursive: true })
    // renamed into place, so an interrupted write never leaves a partial hook
    writeFileSync(temporary, stub)
    chmodSync(temporary, 0o755)
    renameSync(temporary, file)
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary)
    return `${file} cannot be written (${error.code})`
  }
}

const skipped = install()
if (skipped && skipped !== 'CI') {
  console.log(`pre-commit hook not installed: ${skipped}. CI runs the same Biome check.`)
}
