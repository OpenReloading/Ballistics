import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compare, extract, messages } from '../scripts/i18n.mts'
import de from '../src/i18n/de.json'
import terms from '../src/i18n/german-terms.json'

const source = messages()
const fold = (s: string) =>
  s.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort((a, b) => a.localeCompare(b))

describe('message extraction', () => {
  const head = "import { msg, useTranslation } from '../i18n/language.ts'\n"

  it('reads the literals of t, msg and tn, and the key of a plural', () => {
    expect(
      extract(
        `${head}t('A'); t("B \\"q\\""); msg(\`C\`); tn(rows.length, '{count} row', '{count} rows')\n` +
          `tn(\n  f(a, b),\n  'one',\n  'other',\n  { x: 1 },\n)`,
      ),
    ).toEqual(['A', 'B "q"', 'C', '{count} row|{count} rows', 'one|other'])
  })

  it('reads escapes as JavaScript does, so the key equals the runtime string', () => {
    const source = String.raw`${head}t('Line\nTwo'); t("Tab\there \x41 ä \u{1F600} \\ \'")`
    expect(extract(source)).toEqual(['Line\nTwo', "Tab\there A ä \u{1F600} \\ '"])
  })

  it('leaves `t(label)` of a marked message to the place that marks it', () => {
    expect(extract(`${head}t(label)`)).toEqual([])
  })

  it('refuses a msg or a plural without literals', () => {
    expect(() => extract(`${head}msg(name)`)).toThrow(/msg\(\) takes string literals/)
    expect(() => extract(`${head}tn(n, one, 'other')`)).toThrow(/tn\(\) takes string literals/)
    expect(() => extract(`${head}msg(\`a \${b}\`)`)).toThrow(/source:2: msg\(\)/)
  })

  it('reads no file that does not import from i18n', () => {
    expect(extract("const t = (x) => x; t('A')")).toEqual([])
  })

  it('finds the messages of the sources', () => {
    expect(source).toContain('Settings')
    expect(source).toContain('{count} record|{count} records')
  })
})

const catalogues = readdirSync(new URL('../src/i18n', import.meta.url))
  .filter((f) => /^[a-z]{2,3}\.json$/.test(f))
  .map((f) => f.replace('.json', ''))

describe.each(catalogues)('catalogue %s', (code) => {
  const catalogue: Record<string, string | Record<string, string>> = JSON.parse(
    readFileSync(new URL(`../src/i18n/${code}.json`, import.meta.url), 'utf8'),
  )

  it('has no key the English source lacks', () => {
    expect(compare(source, catalogue).stale).toEqual([])
  })

  it('gives every entry the placeholders of its key and every plural the forms of its language', () => {
    const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories
    for (const [key, entry] of Object.entries(catalogue)) {
      const forms = key.split('|')
      if (typeof entry === 'string') {
        expect(forms, key).toHaveLength(1)
        expect(entry.trim(), key).not.toBe('')
        expect(placeholders(entry), key).toEqual(placeholders(key))
      } else {
        expect(forms, key).toHaveLength(2)
        expect(Object.keys(entry).length, key).toBeGreaterThan(0)
        for (const [category, text] of Object.entries(entry)) {
          expect(categories, key).toContain(category)
          expect(text.trim(), key).not.toBe('')
          expect(placeholders(text), key).toEqual(placeholders(forms[1] ?? ''))
        }
      }
    }
  })
})

describe('German catalogue', () => {
  it('writes a verified term of the table as the table does, where its English word occurs', () => {
    // a verified row whose English is one word or comma separated single words ('Case, brass')
    const words = terms.terms
      .filter((t) => t.status === 'verified' && t.german)
      .filter((t) => t.english.split(', ').every((w) => /^[A-Za-z]+$/.test(w)))
      .flatMap((t) => {
        // 'Pistol, revolver, handgun' is 'Pistole, Revolver, Kurzwaffe': each word has its own
        // German word when the lists are as long as each other, else the whole German text
        const english = t.english.split(', ')
        const german = (t.german ?? '').split(', ')
        return english.map((w, i) => ({
          english: new RegExp(`\\b${w}(e?s)?\\b`, 'i'),
          german: (german.length === english.length ? german[i] : t.german) ?? '',
        }))
      })
    for (const [key, entry] of Object.entries(de)) {
      const text = typeof entry === 'string' ? entry : Object.values(entry).join(' ')
      for (const w of words.filter((w) => w.english.test(key)))
        expect(fold(text), `${key}: ${w.german}`).toContain(fold(w.german))
    }
  })
})
