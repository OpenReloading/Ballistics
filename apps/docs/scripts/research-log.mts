// Checks of the research log entries, `docs/research/*.md`, run by research-log.test.mts: every entry has
// the sections of the template, the fields with a fixed answer start with one of the answers, and the
// files named under "Where in the app" exist.
import { existsSync, readdirSync } from 'node:fs'
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

/** The body of each `## ` section of a page, by heading. */
function bodies(text: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const part of text.split(/^## /m).slice(1)) {
    const end = part.indexOf('\n')
    found.set(
      part.slice(0, end).trim(),
      part
        .slice(end + 1)
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim(),
    )
  }
  return found
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
  // shortcut: only a path with a slash inside backticks counts, a bare name is not looked up
  for (const [, f] of where.matchAll(/`([\w.-]+\/[\w./[\]-]+)`/g))
    if (!existsSync(join(root, f ?? ''))) errors.push(`no file ${f}`)
  return errors
}

/** The entry files under `dir` (the index page is no entry). */
export function entryFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'index.md')
}
