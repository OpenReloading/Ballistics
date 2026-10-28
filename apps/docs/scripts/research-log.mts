// Checks of the research log entries, `docs/research/*.md`, run by research-log.test.mts: every entry has
// the sections of the template, the fields with a fixed answer start with one of the answers, and the
// files named under "Where in the app" exist.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** The sections of an entry, in order. */
export const sections = [
  'Question',
  'Method',
  'Formulas',
  'Numbers',
  'Result',
  'Data basis',
  'Where in the app',
  'Confidence',
]

/** The sections whose first word (or words) is one of a fixed list. */
const answers: Record<string, string[]> = {
  Result: ['improved', 'no change', 'worse'],
  'Data basis': ['public', 'analytic', 'measured'],
  Confidence: ['high', 'medium', 'low'],
}

/** `text` without HTML comments; repeated, so a comment split by another one does not reappear. */
function withoutComments(text: string): string {
  let out = text
  for (let prev = ''; prev !== out; ) {
    prev = out
    out = out.replace(/<!--[\s\S]*?-->/g, '')
  }
  return out
}

/** The body of each `## ` section of a page, by heading; a `## ` line inside a fenced code block is text. */
function bodies(text: string): Map<string, string> {
  const lines = new Map<string, string[]>()
  let current: string[] | undefined
  let fenced = false
  for (const line of withoutComments(text).split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const heading = fenced ? null : /^## (.*)/.exec(line)
    if (heading) {
      current = []
      lines.set((heading[1] ?? '').trim(), current)
    } else current?.push(line)
  }
  return new Map([...lines].map(([name, body]) => [name, body.join('\n').trim()]))
}

/** Findings on one entry: a missing or empty section, a fixed answer not given, a named file that does not exist. */
export function entryErrors(text: string, root: string): string[] {
  const body = bodies(text)
  const errors = sections.flatMap((s) =>
    body.get(s) ? [] : [`section "${s}" is missing or empty`],
  )
  for (const [s, list] of Object.entries(answers)) {
    const start = (body.get(s) ?? '').toLowerCase()
    if (start && !list.some((a) => start.startsWith(a) && !/\w/.test(start[a.length] ?? '')))
      errors.push(`"${s}" must start with ${list.join(', ')}`)
  }
  const where = body.get('Where in the app') ?? ''
  // shortcut: only a path with a slash (`./LICENSE` for a root-level file without extension) or a file name with a known extension inside backticks counts, a bare name is not looked up
  for (const [, f] of where.matchAll(
    /`([\w.-]+\/[\w./[\]-]+|[\w.-]+\.(?:md|mdx|mts|ts|tsx|js|mjs|cjs|json|jsonc|ya?ml))`/g,
  ))
    if (!statSync(join(root, f ?? ''), { throwIfNoEntry: false })?.isFile())
      errors.push(`no file ${f}`)
  return errors
}

/** The entry files under `dir` (the index page is no entry). */
export function entryFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'index.md')
}
