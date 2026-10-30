import { readFileSync } from 'node:fs'
import path from 'node:path'

const read = (file: string) => readFileSync(file, 'utf8').trim()

/**
 * The short commit of the checkout at `root`, read from its git files so a build needs no `git`
 * program on the path. Follows a worktree's `.git` file and a ref in `packed-refs`; `''` when
 * there is no checkout or it cannot be read.
 */
export function shortCommit(root: string): string {
  try {
    let dir = path.join(root, '.git')
    try {
      // a worktree: `.git` is a file naming the directory that holds its HEAD
      dir = path.resolve(root, read(dir).replace(/^gitdir:\s*/, ''))
    } catch {}
    let head = read(path.join(dir, 'HEAD'))
    if (head.startsWith('ref: ')) {
      const ref = head.slice(5)
      let common = dir
      try {
        common = path.resolve(dir, read(path.join(dir, 'commondir')))
      } catch {}
      try {
        head = read(path.join(common, ref))
      } catch {
        const line = read(path.join(common, 'packed-refs'))
          .split('\n')
          .find((l) => l.endsWith(` ${ref}`))
        head = line?.split(' ')[0] ?? ''
      }
    }
    return /^[0-9a-f]{40}$/.test(head) ? head.slice(0, 7) : ''
  } catch {
    return ''
  }
}
