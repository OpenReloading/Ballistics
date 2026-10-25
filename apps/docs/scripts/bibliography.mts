// Checks of the bibliography and the model pages against the records and the code, run by
// bibliography.test.mts: the sources the records cite, the code line under each display equation,
// and the core files the model pages name.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** One source a record cites. */
type RecordSource = { file: string; title: string; url?: string }

/** Titles of record sources that are no publication: the invented values of the demo records. */
const notCited = new Set(['Synthetic test data'])

const urlPattern = /https?:\/\/[^\s<>)]+/g
const doiPattern = /10\.\d{4,9}\/[^\s,;<>)]+/g

/** A URL without scheme, `www.` and trailing slash or full stop, lower case. */
const normalUrl = (url: string) => {
  const bare = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '')
  let end = bare.length
  while (end > 0 && (bare[end - 1] === '/' || bare[end - 1] === '.')) end--
  return bare.slice(0, end)
}

/** DOIs in a text, lower case, without a trailing full stop. */
const dois = (text: string) =>
  (text.match(doiPattern) ?? []).map((d) => d.toLowerCase().replace(/\.$/, ''))

/** The ids of the bibliography entries (`<a id="...">`). */
function entryIds(bibliography: string): Set<string> {
  return new Set([...bibliography.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1]))
}

/**
 * The sources without a bibliography entry. A source matches by URL or DOI; a C.I.P. sheet matches
 * the entry `cip-tdcc`; a source with neither URL nor DOI matches by its title.
 */
export function missingSources(sources: RecordSource[], bibliography: string): RecordSource[] {
  const urls = new Set((bibliography.match(urlPattern) ?? []).map(normalUrl))
  const entryDois = new Set(dois(bibliography))
  const cip = entryIds(bibliography).has('cip-tdcc')
  return sources.filter((s) => {
    if (notCited.has(s.title)) return false
    if (s.title.startsWith('C.I.P.')) return !cip
    const own = dois(`${s.title} ${s.url ?? ''}`)
    if (s.url === undefined && own.length === 0) return !bibliography.includes(s.title)
    return !((s.url && urls.has(normalUrl(s.url))) || own.some((d) => entryDois.has(d)))
  })
}

/** Every source of the records under `dir`: provenance sources and source records. */
export function recordSources(dir: string): RecordSource[] {
  const found: RecordSource[] = []
  const walk = (value: unknown, file: string): void => {
    if (value === null || typeof value !== 'object') return
    for (const [key, v] of Object.entries(value)) {
      // A reference by id is checked with its source record.
      if (key === 'sources' && Array.isArray(v))
        found.push(...v.filter((s) => !('source' in s)).map((s) => ({ file, ...s })))
      else walk(v, file)
    }
  }
  for (const kind of readdirSync(dir, { withFileTypes: true })) {
    if (!kind.isDirectory()) continue
    for (const name of readdirSync(join(dir, kind.name))) {
      if (!name.endsWith('.json')) continue
      const file = `${kind.name}/${name}`
      const record = JSON.parse(readFileSync(join(dir, file), 'utf8'))
      if (kind.name === 'sources') found.push({ file, ...record })
      else walk(record, file)
    }
  }
  return found
}

/**
 * Findings on the display equations of a page: each `$$` block must be followed by a line that
 * starts with `Code:` and names at least one file; the files must exist under `root`, and each other
 * backticked name on the line must occur in one of them.
 */
export function equationErrors(page: string, root: string): string[] {
  const lines = page.split('\n')
  const errors: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('$$')) continue
    const start = i + 1
    i = closing(lines, i)
    let j = i + 1
    while (j < lines.length && lines[j].trim() === '') j++
    if (lines[j]?.startsWith('Code:')) errors.push(...codeLineErrors(lines[j], j + 1, root))
    else errors.push(`line ${start}: equation without a Code line`)
  }
  return errors
}

/** Index of the line that closes the display equation opened on line `i`. */
function closing(lines: string[], i: number): number {
  const open = lines[i].trim()
  if (open.length > 2 && open.endsWith('$$')) return i
  let j = i + 1
  while (j < lines.length && !lines[j].trim().endsWith('$$')) j++
  return j
}

/** Findings on the `Code:` line on line `n`. */
function codeLineErrors(code: string, n: number, root: string): string[] {
  const names = [...code.matchAll(/`([^`]+)`/g)].map((m) => m[1])
  const files = names.filter((name) => /^[\w.-]+\/[\w./[\]-]+\.\w+$/.test(name))
  const errors = files.length === 0 ? [`line ${n}: Code line names no file`] : []
  const texts = files.flatMap((f) => {
    if (existsSync(join(root, f))) return [readFileSync(join(root, f), 'utf8')]
    errors.push(`line ${n}: no file ${f}`)
    return []
  })
  for (const name of names.filter((name) => !files.includes(name)))
    if (!texts.some((t) => t.includes(name)))
      errors.push(`line ${n}: ${name} not in ${files.join(', ')}`)
  return errors
}

/** The files under `dir`, recursively, as paths relative to it. */
export function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(dir.length + 1))
}
