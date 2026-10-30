// Writes the index of the research pages, `docs/research/**/*.md`, from their front matter to
// static/research-index.json and static/llms.txt, and checks the front matter of the literature
// notes (`docs/research/literature/`, research-index.test.mts). Run by `site:build` before
// `docusaurus build`: `node scripts/research-index.mts`.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'yaml'

const research = new URL('../docs/research/', import.meta.url)
const models = new URL('../docs/models/', import.meta.url)

/** The pages of the literature folder that are no note. */
const notNotes = new Set(['index.md', 'open-questions.md'])

/** The fields with a fixed list of answers. */
const answers: Record<string, string[]> = {
  status: ['verified', 'partly_verified', 'unverified'],
  evidence: ['review', 'experiment', 'simulation', 'opinion'],
  result: ['adopt', 'reject', 'open', 'no_change'],
}

/** The required fields of a literature note. */
export const required = [
  'id',
  'question',
  'model_pages',
  'retrieved',
  'sources',
  ...Object.keys(answers),
]

/** The front matter of a page, `{}` without one. */
export function frontMatter(text: string): Record<string, unknown> {
  const yaml = /^---\n([\s\S]*?)\n---/.exec(text)?.[1]
  return yaml ? (parse(yaml) ?? {}) : {}
}

/** Findings on one source of a note, `n` its place in the list. */
function sourceErrors(s: Record<string, unknown> | null, n: number): string[] {
  const doi = typeof s?.doi === 'string' && /^10\.\d{4,9}\/\S+$/.test(s.doi)
  return [
    s?.verified === true && !doi ? `source ${n} is verified without a doi` : '',
    typeof s?.verified === 'boolean' ? '' : `source ${n}: "verified" must be true or false`,
    Number.isInteger(s?.year) ? '' : `source ${n}: "year" is missing`,
    s?.claim ? '' : `source ${n}: "claim" is missing`,
  ].filter(Boolean)
}

/** The list `fm[key]`, `[]` when it is missing; a value that is no list is a finding. */
function listOf(fm: Record<string, unknown>, key: string, errors: string[]): unknown[] {
  const v = fm[key]
  if (v !== undefined && !Array.isArray(v)) errors.push(`"${key}" must be a list`)
  return Array.isArray(v) ? v : []
}

/** Findings on the front matter of a literature note; `pages` are the model page names. */
export function noteErrors(fm: Record<string, unknown>, pages: Set<string>): string[] {
  const errors = required.flatMap((k) =>
    fm[k] === undefined || fm[k] === null || fm[k] === '' ? [`"${k}" is missing`] : [],
  )
  for (const [k, list] of Object.entries(answers))
    if (fm[k] !== undefined && !list.includes(String(fm[k])))
      errors.push(`"${k}" must be one of ${list.join(', ')}`)
  if (fm.retrieved !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(fm.retrieved)))
    errors.push('"retrieved" must be a date YYYY-MM-DD')
  for (const p of listOf(fm, 'model_pages', errors))
    if (!pages.has(String(p))) errors.push(`no model page ${p}`)
  const sources = listOf(fm, 'sources', errors)
  for (const [i, s] of sources.entries())
    errors.push(...sourceErrors(s as Record<string, unknown> | null, i + 1))
  const checked = sources.filter((s) => (s as Record<string, unknown> | null)?.verified === true)
  const expected = !checked.length
    ? 'unverified'
    : checked.length < sources.length
      ? 'partly_verified'
      : 'verified'
  // a note without sources (a search that found nothing) has no status to check
  if (sources.length && answers.status.includes(String(fm.status)) && fm.status !== expected)
    errors.push(`"status" is ${fm.status} but its sources give ${expected}`)
  return errors
}

/** One page of the index. */
type Entry = {
  title: string
  description: string
  link: string
  id?: string
  status?: string
  result?: string
  model_pages?: string[]
}

/** The research pages under `dir` (the log page itself is none), with the path below it. */
function pages(dir: URL, below = ''): { path: string; text: string }[] {
  return readdirSync(new URL(below, dir), { withFileTypes: true }).flatMap((f) => {
    if (f.isDirectory()) return pages(dir, `${below}${f.name}/`)
    if (!f.name.endsWith('.md') || `${below}${f.name}` === 'index.md') return []
    return [
      { path: `${below}${f.name}`, text: readFileSync(new URL(`${below}${f.name}`, dir), 'utf8') },
    ]
  })
}

/** Whether the page at `path` below the research folder is a literature note. */
export const isNote = (path: string) =>
  path.startsWith('literature/') && !notNotes.has(path.slice('literature/'.length))

/** The model page names, `docs/models/<name>.md`. */
export const modelPages = () =>
  new Set(readdirSync(models).flatMap((f) => (f.endsWith('.md') ? [f.slice(0, -3)] : [])))

/** The literature notes of `dir` with their findings, by path. */
export function notesErrors(dir = research): string[] {
  const names = modelPages()
  return pages(dir)
    .filter((p) => isNote(p.path))
    .flatMap((p) => noteErrors(frontMatter(p.text), names).map((e) => `${p.path}: ${e}`))
}

/** The folder of a page path with its trailing slash, and the file name without `.md`. */
export function splitPath(path: string): { folder: string; name: string } {
  const cut = path.lastIndexOf('/') + 1
  return { folder: path.slice(0, cut), name: path.slice(cut).replace(/\.md$/, '') }
}

/** The index entries of the research pages under `dir`; `site` is the URL of the docs root. */
export function entries(site: string, dir = research): Entry[] {
  return pages(dir)
    .map(({ path, text }) => {
      const fm = frontMatter(text)
      // Docusaurus takes the doc id from the front matter, else from the file name
      const { folder, name: file } = splitPath(path)
      const name = typeof fm.id === 'string' ? fm.id : file
      const entry: Entry = {
        title: String(fm.title ?? name),
        description: String(fm.description ?? ''),
        link: `${site}research/${folder}${name === 'index' ? '' : name}`,
      }
      const { id, status, result, model_pages } = fm
      return isNote(path) ? Object.assign(entry, { id, status, result, model_pages }) : entry
    })
    .sort((a, b) => a.link.localeCompare(b.link))
}

/** The llms.txt of the index: one link line per page. */
export function llmsText(list: Entry[]): string {
  const line = (e: Entry) => {
    const tail = [e.status, e.result, ...(e.model_pages ?? [])].filter(Boolean).join(', ')
    return `- [${e.id ? `${e.id} ` : ''}${e.title}](${e.link}): ${e.description}${tail ? ` (${tail})` : ''}`
  }
  return [
    '# OpenReloading Ballistics research',
    '',
    '> Research log entries and literature notes of the model docs. Before a model changes, read the entries of its model page. The same list with the fields is research-index.json.',
    '',
    '## Research',
    '',
    ...list.map(line),
    '',
  ].join('\n')
}

if (import.meta.main) {
  const site = `${process.env.DOCS_URL ?? 'https://openreloading.github.io'}${process.env.DOCS_BASE_URL ?? '/'}`
  const findings = notesErrors()
  if (findings.length) {
    console.error(findings.join('\n'))
    process.exit(1)
  }
  const list = entries(site)
  const out = new URL('../static/', import.meta.url)
  mkdirSync(out, { recursive: true })
  writeFileSync(new URL('research-index.json', out), `${JSON.stringify(list, null, 2)}\n`)
  writeFileSync(new URL('llms.txt', out), llmsText(list))
}
