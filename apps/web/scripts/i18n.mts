/**
 * The English messages of the web app's sources and how a language's catalogue compares with them.
 *
 *   node scripts/i18n.mts messages        every message, one per line
 *   node scripts/i18n.mts missing <code>  the messages `src/i18n/<code>.json` lacks, and its keys no
 *                                         message matches (exit 1 for such a key)
 *
 * A message is the first argument of `t(...)` or `msg(...)` and the two forms of `tn(count, one,
 * other)`, as a string literal, in a file that imports from `src/i18n/`.
 * shortcut: a text scan, not a parse. A call that spans a comma inside its first argument of `tn`
 * is read by bracket depth; a template literal with `${` is refused. Upgrade to the TypeScript API
 * if a source needs more.
 */
import { globSync, readFileSync } from 'node:fs'
import path from 'node:path'

const webRoot = path.join(import.meta.dirname, '..')

const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`/y
const call = /(?<![.\w])(msg|tn|t)\(\s*/g

/** The text of the string literal at `at` and the index after it, or undefined. */
function literalAt(source: string, at: number) {
  literal.lastIndex = at
  const m = literal.exec(source)
  if (!m) return
  return { text: (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\(.)/g, '$1'), end: literal.lastIndex }
}

/** The index of the first comma at bracket depth 0 from `at`, or -1. */
function commaAfter(source: string, at: number) {
  let depth = 0
  for (let i = at; i < source.length; i++) {
    const c = source[i]
    if ('([{'.includes(c ?? '\0')) depth++
    else if (')]}'.includes(c ?? '\0')) {
      if (depth === 0) return -1
      depth--
    } else if (c === ',' && depth === 0) return i
  }
  return -1
}

const afterSpace = (source: string, at: number) =>
  at + (/^\s*/.exec(source.slice(at))?.[0].length ?? 0)

const lineOf = (source: string, at: number) => source.slice(0, at).split('\n').length

/** The key of the plural `tn(count, one, other)` whose arguments start at `at`: `one|other`, or undefined. */
function pluralAt(source: string, at: number) {
  const comma = commaAfter(source, at)
  const one = comma < 0 ? undefined : literalAt(source, afterSpace(source, comma + 1))
  const next = one && /^\s*,/.exec(source.slice(one.end))
  const other = one && next && literalAt(source, afterSpace(source, one.end + next[0].length))
  return one && other ? `${one.text}|${other.text}` : undefined
}

/** The messages of one source file (none unless it imports from `i18n/`); a call that is not extractable throws. */
export function extract(source: string, file = 'source'): string[] {
  if (!/from '[^']*\/i18n\/[^']*'/.test(source)) return []
  const found: string[] = []
  for (const m of source.matchAll(call)) {
    const start = m.index + m[0].length
    const text = m[1] === 'tn' ? pluralAt(source, start) : literalAt(source, start)?.text
    // `t(label)` of a message marked by `msg` is no literal: extracted where it is marked
    if (text === undefined && m[1] !== 't')
      throw new Error(`${file}:${lineOf(source, m.index)}: ${m[1]}() takes string literals`)
    if (text !== undefined) found.push(text)
  }
  return found
}

/** The distinct messages of every source under `src/`, sorted. */
export function messages(root = webRoot): string[] {
  const all = new Set<string>()
  for (const file of globSync('src/**/*.{ts,tsx}', { cwd: root }))
    for (const text of extract(readFileSync(path.join(root, file), 'utf8'), file)) all.add(text)
  return [...all].sort((a, b) => a.localeCompare(b, 'en'))
}

/** What `catalogue` lacks of `source` and what it has that `source` lacks. */
export function compare(source: readonly string[], catalogue: Record<string, unknown>) {
  const keys = Object.keys(catalogue)
  return {
    untranslated: source.filter((s) => !keys.includes(s)),
    stale: keys.filter((k) => !source.includes(k)),
  }
}

if (import.meta.main) {
  const [command, code] = process.argv.slice(2)
  const source = messages()
  if (command === 'messages') console.log(source.join('\n'))
  else if (command === 'missing' && code && /^[a-z]{2,3}$/.test(code)) {
    const catalogue = JSON.parse(readFileSync(path.join(webRoot, `src/i18n/${code}.json`), 'utf8'))
    const { untranslated, stale } = compare(source, catalogue)
    console.log(`${code}: ${untranslated.length} of ${source.length} messages untranslated`)
    for (const s of untranslated) console.log(`  ${s}`)
    if (stale.length > 0) {
      console.log(`${stale.length} keys without a message in the sources:`)
      for (const s of stale) console.log(`  ${s}`)
      process.exit(1)
    }
  } else {
    console.error('usage: i18n.mts messages | missing <language code>')
    process.exit(2)
  }
}
