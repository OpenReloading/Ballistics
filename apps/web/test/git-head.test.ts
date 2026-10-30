import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { shortCommit } from '../src/lib/git-head.ts'

const sha = 'abcdef0123456789abcdef0123456789abcdef01'
const tmp = () => mkdtempSync(path.join(tmpdir(), 'git-head-'))

it('reads a detached HEAD, a loose ref and a packed ref', () => {
  const detached = tmp()
  mkdirSync(path.join(detached, '.git'))
  writeFileSync(path.join(detached, '.git', 'HEAD'), `${sha}\n`)
  expect(shortCommit(detached)).toBe('abcdef0')

  const loose = tmp()
  mkdirSync(path.join(loose, '.git', 'refs', 'heads'), { recursive: true })
  writeFileSync(path.join(loose, '.git', 'HEAD'), 'ref: refs/heads/main\n')
  writeFileSync(path.join(loose, '.git', 'refs', 'heads', 'main'), `${sha}\n`)
  expect(shortCommit(loose)).toBe('abcdef0')

  const packed = tmp()
  mkdirSync(path.join(packed, '.git'))
  writeFileSync(path.join(packed, '.git', 'HEAD'), 'ref: refs/heads/main\n')
  writeFileSync(path.join(packed, '.git', 'packed-refs'), `# pack\n${sha} refs/heads/main\n`)
  expect(shortCommit(packed)).toBe('abcdef0')
})

it('follows the .git file of a worktree to its own HEAD and the common refs', () => {
  const main = tmp()
  mkdirSync(path.join(main, '.git', 'refs', 'heads'), { recursive: true })
  writeFileSync(path.join(main, '.git', 'refs', 'heads', 'topic'), `${sha}\n`)
  const gitdir = path.join(main, '.git', 'worktrees', 'w')
  mkdirSync(gitdir, { recursive: true })
  writeFileSync(path.join(gitdir, 'HEAD'), 'ref: refs/heads/topic\n')
  writeFileSync(path.join(gitdir, 'commondir'), '../..\n')
  const wt = tmp()
  writeFileSync(path.join(wt, '.git'), `gitdir: ${gitdir}\n`)
  expect(shortCommit(wt)).toBe('abcdef0')
})

it('gives an empty string without a checkout or with an unreadable one', () => {
  expect(shortCommit(tmp())).toBe('')
  const bad = tmp()
  mkdirSync(path.join(bad, '.git'))
  writeFileSync(path.join(bad, '.git', 'HEAD'), 'not a commit\n')
  expect(shortCommit(bad)).toBe('')
})
