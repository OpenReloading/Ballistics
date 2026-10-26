// Installs `hooks/pre-commit` into the hooks folder of this repository (root `postinstall`).
// The hook is a stub that runs the script of the checkout it is called in, so one install serves
// every git worktree. It never sets `core.hooksPath` and never overwrites a hook it did not write:
// a contributor's own hooks path or pre-commit hook wins, with a one-line message. Never fails
// the install.
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { executable } from '../tools/src/executable.ts'

const marker = '# managed by hooks/install.mjs'
const stub = `#!/bin/sh
${marker}
root=$(git rev-parse --show-toplevel) && [ -x "$root/hooks/pre-commit" ] && exec "$root/hooks/pre-commit" "$@"
exit 0
`

/** The reason nothing was installed; nothing returned once the hook is in place. */
function install() {
  if (process.env.CI) return 'CI'
  let bin
  try {
    bin = executable('git')
  } catch {
    return 'git not found'
  }
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
  if (existsSync(file) && !readFileSync(file, 'utf8').includes(marker)) {
    return `${file} is another hook`
  }
  mkdirSync(folder, { recursive: true })
  writeFileSync(file, stub)
  chmodSync(file, 0o755)
}

const skipped = install()
if (skipped && skipped !== 'CI') {
  console.log(`pre-commit hook not installed: ${skipped}. CI runs the same Biome check.`)
}
