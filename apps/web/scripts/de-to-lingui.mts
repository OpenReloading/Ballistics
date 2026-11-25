// Writes the German of src/i18n/de.json (keyed by English text) into src/locales/de.po for each id whose English matches
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Catalogue } from '../src/i18n/translate.ts'
import { withSourceNote } from './lingui-outdated.mts'
import { type PoCatalog, readCatalog, writeCatalog } from './po-catalog.mts'

const pluralOfCount =
  /^\{count, plural, one \{((?:[^{}]|\{\w+\})*)\} other \{((?:[^{}]|\{\w+\})*)\}\}$/

/** The `de.json` key of a Lingui English text: a `count` plural as its `one|other` pair with `{count}` for `#`, after its context, with `''` read as `'`. */
function ownKey(english: string, context?: string) {
  const forms = pluralOfCount.exec(english)
  const text = (forms ? `${forms[1]}|${forms[2]}`.replaceAll('#', '{count}') : english).replaceAll(
    "''",
    "'",
  )
  return context ? `${context}\u0004${text}` : text
}

// ICU quoting: a lone apostrophe before a brace would quote the placeholder instead of filling it
const quoted = (text: string) => text.replaceAll("'", "''")

/** A `de.json` entry as a Lingui message: plural forms become a `count` plural with `#` for `{count}`. */
const linguiText = (entry: Catalogue[string]) =>
  typeof entry === 'string'
    ? quoted(entry)
    : `{count, plural, ${Object.entries(entry)
        .map(([form, text]) => `${form} {${quoted(text).replaceAll('{count}', '#')}}`)
        .join(' ')}}`

/** `de` with the German of `german` for every id whose English (from `en`) it holds; an id with other German keeps it. */
export function convert(en: PoCatalog, de: PoCatalog, german: Catalogue) {
  const catalog: PoCatalog = { ...de }
  const report = { written: [] as string[], kept: [] as string[], other: [] as string[] }
  const missing: string[] = []
  const used = new Set<string>()
  for (const [id, current] of Object.entries(de)) {
    const english = en[id]?.translation
    if (current.obsolete || !english) continue
    const key = ownKey(english, en[id]?.context)
    // an inherited name such as `constructor` is no entry
    const found = Object.hasOwn(german, key) ? german[key] : undefined
    if (found === undefined) {
      missing.push(id)
      continue
    }
    used.add(key)
    const text = linguiText(found)
    if (current.translation && current.translation !== text) {
      report.other.push(id)
      continue
    }
    report[current.translation ? 'kept' : 'written'].push(id)
    const extra = current.extra ?? { translatorComments: [], flags: [] }
    catalog[id] = {
      ...current,
      translation: text,
      extra: { ...extra, translatorComments: withSourceNote(extra.translatorComments, english) },
    }
  }
  return { catalog, report, missing, unused: Object.keys(german).length - used.size }
}

if (import.meta.main) {
  const file = path.join(import.meta.dirname, '..', 'src', 'i18n', 'de.json')
  const german = JSON.parse(readFileSync(file, 'utf8')) as Catalogue
  const en = await readCatalog('en')
  const de = await readCatalog('de')
  const { catalog, report, missing, unused } = convert(en, de, german)
  await writeCatalog('de', catalog)
  const { written, kept, other } = report
  console.log(
    `de.po: ${written.length} written, ${kept.length} unchanged, ${other.length} with other German kept, ${missing.length} without a de.json entry; ${unused} de.json entries no id uses`,
  )
  const quoted = (id: string) => JSON.stringify(en[id]?.translation)
  for (const id of other) console.log(`other German: ${id} ${quoted(id)}: ${de[id]?.translation}`)
  for (const id of missing) console.log(`no de.json entry: ${id} ${quoted(id)}`)
}
