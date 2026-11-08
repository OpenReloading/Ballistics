/**
 * The English messages of the web app's sources and how a language's catalogue compares with them.
 *
 *   node scripts/i18n.mts messages        every message, one per line
 *   node scripts/i18n.mts missing <code>  the messages `src/i18n/<code>.json` lacks, and its keys no
 *                                         message matches (exit 1 for such a key)
 *   node scripts/i18n.mts check <code>    the catalogue lint `pnpm run lint` runs: exit 1 for any
 *                                         problem `problems` names; for German also the term table,
 *                                         its use in the texts and the safe wording (`i18n-lint.json`)
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

const escapes: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  v: '\v',
  0: '\0',
}

/** The value of a literal's body: its escapes read as JavaScript does (`\n`, `\xHH`, `\uHHHH`, `\u{H}`). */
const decode = (body: string) =>
  body.replace(
    /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(.))/g,
    (_, braced, unit, hex, other: string) =>
      braced || unit || hex
        ? String.fromCodePoint(Number.parseInt(braced ?? unit ?? hex, 16))
        : (escapes[other] ?? other),
  )

/** The text of the string literal at `at` and the index after it, or undefined. */
function literalAt(source: string, at: number) {
  literal.lastIndex = at
  const m = literal.exec(source)
  if (!m) return
  return { text: decode(m[1] ?? m[2] ?? m[3] ?? ''), end: literal.lastIndex }
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

/** The messages of one source file (none unless it imports from `i18n/`, or from `./translate.ts` in that folder); a call that is not extractable throws. */
export function extract(source: string, file = 'source'): string[] {
  if (!/from '(?:[^']*\/i18n\/[^']*|\.\/translate\.ts)'/.test(source)) return []
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

/**
 * The texts of the message table: the codes and templates of `src/lib/core-message-table.json`,
 * the warning sentences that `src/lib/core-message-table.ts` marks and the refusal words of
 * `src/lib/refusal-words.ts`.
 */
export function tableMessages(root: string): string[] {
  const { codes, templates } = JSON.parse(
    readFileSync(path.join(root, 'src/lib/core-message-table.json'), 'utf8'),
  ) as { codes: string[]; templates: Record<string, string[]> }
  const marked = ['src/lib/core-message-table.ts', 'src/lib/refusal-words.ts'].flatMap((file) =>
    extract(readFileSync(path.join(root, file), 'utf8'), file),
  )
  return [...codes, ...Object.values(templates).flat(), ...marked]
}

/** The distinct messages of every source under `src/` and of the message table, sorted. */
export function messages(root = webRoot): string[] {
  const all = new Set<string>(tableMessages(root))
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

const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1] ?? '')
    .sort((a, b) => a.localeCompare(b))
    .join()

/** The texts that must be translated: the message table and the lines of the Safety notice. */
export function requiredMessages(root: string): string[] {
  const safety = 'src/lib/safety.ts'
  return [...tableMessages(root), ...extract(readFileSync(path.join(root, safety), 'utf8'), safety)]
}

/**
 * What is wrong with `catalogue` of `language` against the English `source`: a `required` text
 * without a translation or left English, a key no message matches, an empty text, placeholders
 * other than its key's, and a plural that is no object of the language's categories. Other
 * untranslated messages show in English; `missing` lists them.
 */
export function problems(
  source: readonly string[],
  catalogue: Record<string, unknown>,
  language: string,
  required: readonly string[],
): string[] {
  const { untranslated, stale } = compare(source, catalogue)
  const found = [
    ...untranslated.filter((s) => required.includes(s)).map((s) => `untranslated: ${s}`),
    ...stale.map((k) => `no message has this key: ${k}`),
  ]
  const categories: string[] = new Intl.PluralRules(language).resolvedOptions().pluralCategories
  for (const [key, entry] of Object.entries(catalogue)) {
    const forms = key.split('|')
    const plural = typeof entry === 'object' && entry !== null
    if (forms.length !== (plural ? 2 : 1)) found.push(`a plural is an object of forms: ${key}`)
    const texts: [string, unknown][] = plural ? Object.entries(entry) : [['', entry]]
    if (texts.length === 0) found.push(`no plural forms: ${key}`)
    for (const [category, text] of texts) {
      if (plural && !categories.includes(category))
        found.push(`${category} is no plural category of ${language}: ${key}`)
      if (typeof text !== 'string' || text.trim() === '') found.push(`empty: ${key}`)
      else if (placeholders(text) !== placeholders(plural ? (forms[1] ?? '') : key))
        found.push(`placeholders differ: ${key}`)
    }
  }
  for (const text of required) if (catalogue[text] === text) found.push(`left English: ${text}`)
  return found
}

/** A cited place in a source document of the term table. */
interface Cite {
  doc: string
  at: string
}

/** One row of the German term table `src/i18n/german-terms.json`. */
interface TermRow {
  key: string
  english: string
  german: string | null
  status: string
  group: string
  sources: Cite[]
  candidates: { german: string; sources: Cite[] }[]
  forms?: string[]
  decision?: string
  note?: string
}

/** The German term table: the source documents and the rows. */
export interface TermTable {
  sources: Record<string, { document: string; edition: string; pages: string }>
  terms: TermRow[]
}

const twice = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i)

/** What is wrong with one row's status: what a verified, decided or unverified row needs. */
function statusProblems(t: TermRow): string[] {
  const german = t.candidates.map((c) => c.german)
  if (t.status === 'verified')
    return Boolean(t.german?.trim()) && t.sources.length > 0 && german.length === 0
      ? []
      : [`${t.key}: a verified row has one German term, a source and no candidates`]
  if (t.status === 'decided') {
    const sourced = t.candidates.every((c) => c.german.trim() !== '' && c.sources.length > 0)
    const chosen = t.german !== null && german.includes(t.german)
    return german.length >= 2 &&
      chosen &&
      twice(german).length === 0 &&
      sourced &&
      /^Rule [a-e]: .+\.$/.test(t.decision ?? '')
      ? []
      : [
          `${t.key}: a decided row has two or more distinct sourced candidates, its term one of them, and a rule`,
        ]
  }
  if (t.status === 'unverified')
    return german.length === 0 &&
      t.german?.trim() !== '' &&
      /^Accepted as candidate for 1\.0/.test(t.note ?? '')
      ? []
      : [
          `${t.key}: an unverified row has no candidates and the note "Accepted as candidate for 1.0"`,
        ]
  return [`${t.key}: status ${t.status}`]
}

/** What is wrong with one row besides its status: key, group, English term, cited places, forms. */
function rowProblems(t: TermRow, ids: readonly string[]): string[] {
  const found: string[] = []
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.key)) found.push(`${t.key}: a key in kebab case`)
  if (!['components', 'measurements', 'procedures', 'target-shooting'].includes(t.group))
    found.push(`${t.key}: group ${t.group}`)
  if (t.english.trim() === '') found.push(`${t.key}: an English term`)
  for (const c of [...t.sources, ...t.candidates.flatMap((x) => x.sources)]) {
    if (!ids.includes(c.doc)) found.push(`${t.key}: unknown document ${c.doc}`)
    if (c.at.trim() === '' || c.at.length > 80) found.push(`${t.key}: a short place in ${c.doc}`)
  }
  if (t.forms && (t.german === null || !t.forms.includes(t.german)))
    found.push(`${t.key}: its term among its forms`)
  return [...found, ...statusProblems(t)]
}

/** What is wrong with the term table, by the rules of the translating page's term table section. */
export function termTableProblems(table: TermTable): string[] {
  const ids = Object.keys(table.sources)
  return [
    ...twice(table.terms.map((t) => t.key)).map((k) => `a key twice: ${k}`),
    ...twice(table.terms.map((t) => t.english)).map((e) => `an English term twice: ${e}`),
    ...(ids.length > 0 ? [] : ['no source documents']),
    ...Object.entries(table.sources)
      .filter(([, x]) => !(x.document && x.edition && x.pages))
      .map(([id]) => `${id}: document, edition and pages`),
    ...table.terms.flatMap((t) => rowProblems(t, ids)),
  ]
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    // a soft hyphen marks where a long compound may break
    .replace(/\u00ad/g, '')
const wordPattern = (word: string) => new RegExp(`\\b${word}(e?s)?\\b`, 'i')
const termWords = (english: string) => english.replace(/\s*\(.*\)/, '').split(', ')
const textOf = (entry: unknown) =>
  typeof entry === 'string' ? entry : Object.values(entry as Record<string, string>).join(' ')

/**
 * Where `catalogue` writes a term other than the table: a verified word or a decided phrase whose
 * English occurs in a key without its German, or a rejected candidate of a decided term. `senses`
 * lists the keys where the English word has another sense; each must be a text of `source`.
 */
export function termUseProblems(
  catalogue: Record<string, unknown>,
  table: TermTable,
  senses: Record<string, string>,
  source: readonly string[],
): string[] {
  const found: string[] = []
  const phrases = table.terms
    .filter((t) => t.status !== 'unverified')
    .flatMap((t) => termWords(t.english))
  // the English word outside the longer terms that contain it ('Target face' owns 'target')
  const occurs = (word: string, key: string) =>
    wordPattern(word).test(
      phrases
        .filter((p) => p.length > word.length && wordPattern(word).test(p))
        .reduce((k, p) => k.replace(new RegExp(wordPattern(p).source, 'gi'), ' '), key),
    )
  const entries = Object.entries(catalogue).filter(([key]) => !(key in senses))
  // a verified row of single words pairs its English and German words by position when both lists are as long
  const words = table.terms
    .filter((t) => t.status === 'verified' && t.german)
    .filter((t) => t.english.split(', ').every((w) => /^[A-Za-z]+$/.test(w)))
    .flatMap((t) => {
      const english = t.english.split(', ')
      const german = (t.german ?? '').split(', ')
      return english.map((word, i) => ({
        word,
        german: t.forms ?? [(german.length === english.length ? german[i] : t.german) ?? ''],
      }))
    })
  const decided = table.terms.filter((t) => t.status === 'decided' && t.german)
  for (const [key, entry] of entries) {
    const text = fold(textOf(entry))
    for (const w of words.filter((x) => occurs(x.word, key)))
      if (!w.german.some((g) => text.includes(fold(g))))
        found.push(`${key}: ${w.german.join(' or ')}`)
    for (const t of decided.filter((d) => /^[A-Za-z]+( [A-Za-z]+)+$/.test(d.english)))
      if (wordPattern(t.english).test(key) && !text.includes(fold(t.german ?? '')))
        found.push(`${key}: ${t.german}`)
    for (const t of decided.filter((d) => termWords(d.english).some((w) => occurs(w, key))))
      for (const rejected of t.candidates.map((c) => c.german).filter((g) => g !== t.german))
        if (new RegExp(`(^|[^a-z])${fold(rejected)}(n|s|e|es|en)?($|[^a-z])`).test(text))
          found.push(`${key}: ${rejected}, a rejected candidate of ${t.german}`)
  }
  for (const k of Object.keys(senses))
    if (!source.includes(k)) found.push(`a sense of a text no message has: ${k}`)
  return found
}

/**
 * Only the `approved` texts (the Safety notice and the disclaimers) use a word that starts with "safe" (safe, safety, safely), and
 * each German text says "sicher" as often as its English says one of them.
 */
export function safeWordingProblems(
  source: readonly string[],
  catalogue: Record<string, unknown>,
  approved: readonly string[],
): string[] {
  const found: string[] = []
  const count = (text: string, word: RegExp) => text.match(word)?.length ?? 0
  for (const s of source) {
    const safe = count(s, /\bsafe/gi)
    if (safe === 0) continue
    if (!approved.includes(s)) found.push(`says safe without approval: ${s}`)
    const german = catalogue[s]
    if (typeof german === 'string' && count(german, /\bsicher/gi) !== safe)
      found.push(`says "sicher" other than "safe" ${safe} times: ${s}`)
  }
  for (const a of approved)
    if (!source.includes(a)) found.push(`approved, but no message has it: ${a}`)
  return found
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
  } else if (command === 'check' && code && /^[a-z]{2,3}$/.test(code)) {
    const catalogue = JSON.parse(readFileSync(path.join(webRoot, `src/i18n/${code}.json`), 'utf8'))
    const found = problems(source, catalogue, code, requiredMessages(webRoot))
    if (code === 'de') {
      const read = (file: string) => JSON.parse(readFileSync(path.join(webRoot, file), 'utf8'))
      const table: TermTable = read('src/i18n/german-terms.json')
      const lint = read('scripts/i18n-lint.json')
      const senses = {
        ...Object.fromEntries(lint.targetRecords.map((k: string) => [k, lint.targetSense])),
        ...lint.otherSense,
      }
      found.push(
        ...termTableProblems(table),
        ...termUseProblems(catalogue, table, senses, source),
        ...safeWordingProblems(source, catalogue, lint.safeTexts),
      )
    }
    for (const p of found) console.error(`src/i18n/${code}.json: ${p}`)
    if (found.length > 0) process.exit(1)
  } else {
    console.error('usage: i18n.mts messages | missing <language code> | check <language code>')
    process.exit(2)
  }
}
