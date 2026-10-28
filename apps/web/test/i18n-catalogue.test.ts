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

  it('reads a file of the i18n folder that imports the translate module', () => {
    expect(extract("import { type Translator } from './translate.ts'\nt('A')")).toEqual(['A'])
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

/** English texts that contain a term's English word in another sense, each with the sense. */
const otherSense: Record<string, string> = {
  'Bullet position': 'where the bullet is in the barrel, not a shooting position',
  'Case fill': 'the load ratio, whose verified term (Ladedichte) names no case',
  'Powder temperature': 'the compound Pulvertemperatur, the usual word, in a label of one line',
  'The band is the 5th to 95th percentile of {samples} draws (seed {seed}, {failed} left the model) of the inputs, normal around their nominal values with the tolerance as the 90 % half width. The limit check uses the corner-case range {low} to {high} {unit}.':
    'corner case: an extreme combination of inputs',
  'The band is the 5th to 95th percentile of {samples} draws (seed {seed}) of the inputs, normal around their nominal values with the tolerance as the 90 % half width. The limit check uses the corner-case range {low} to {high} {unit}.':
    'corner case: an extreme combination of inputs',
  'The sampled bands are {notice}: the corner-case range is shown.':
    'corner case: an extreme combination of inputs',
  '{failed} of {total} range cases could not be computed; the true range can be wider.':
    'case: one computed combination of inputs',
  '{n} of {m} range cases could not be computed ({list}); the range covers only the computed cases, and the true range can be wider.':
    'case: one computed combination of inputs',
  'Sampled bands {notice}: corner-case range shown.':
    'corner case: an extreme combination of inputs',
  Rifle:
    'a rifle as the discipline category or the firearm in a shooting-sport text, where the rule books write Gewehr; Büchse names the primer size',
  'Rifle and scope':
    'a rifle as the discipline category or the firearm in a shooting-sport text, where the rule books write Gewehr; Büchse names the primer size',
  'Empty: by cartridge class, rifle {rifle}, pistol {pistol} (assumptions, no source).':
    'a rifle as the discipline category or the firearm in a shooting-sport text, where the rule books write Gewehr; Büchse names the primer size',
  Targets: 'the Targets tab lists target face records, whose verified term is Scheibe',
  'No target mapping of its disciplines names a face.':
    'target mapping: a record kind; the German names the face',
  'No target mapping names this discipline.':
    'target mapping: a record kind; the German names the discipline',
  'The events and disciplines shot on this face':
    'events: the verified term of Event is Wettbewerb',
  'Shooting distance': 'the compound Schießentfernung translates both words',
  'Results are simulations, not load data. Never use a result as a charge weight or as proof that a load is safe. Start from load data published by the powder or bullet maker for your exact components.':
    'Safety text: the owner approves its wording',
  'Measurements, statistics, group sizes, scores and records shown here can contain errors from the models, the data or your inputs.':
    'Safety text: the owner approves its wording',
  'boatTailLength must be zero or more': 'zero: the number',
  'meplatDiameter must be zero up to the diameter': 'zero: the number',
  'A flat spot is a statistical observation of the strings fired: neighbouring charges whose slope of mean velocity has a {level} % band that includes zero. Few shots make wide bands. It is not a safety statement and not a charge to load.':
    'zero: the number',
}

const wordPattern = (word: string) => new RegExp(`\\b${word}(e?s)?\\b`, 'i')
const termWords = (english: string) => english.replace(/\s*\(.*\)/, '').split(', ')
const phrases = terms.terms
  .filter((t) => t.status !== 'unverified')
  .flatMap((t) => termWords(t.english))

/** Whether the English word occurs in the key outside the longer terms of the table that contain it ('Target face' owns 'target'). */
function occurs(word: string, key: string): boolean {
  const rest = phrases
    .filter((p) => p.length > word.length && wordPattern(word).test(p))
    .reduce((k, p) => k.replace(new RegExp(wordPattern(p).source, 'gi'), ' '), key)
  return wordPattern(word).test(rest)
}

const textOf = (entry: string | Record<string, string>) =>
  typeof entry === 'string' ? entry : Object.values(entry).join(' ')

describe('German catalogue', () => {
  it('writes a verified term of the table as the table does, where its English word occurs', () => {
    // a verified row whose English is one word or comma separated single words ('Case, brass'); the
    // English words and the German words of a row pair up by position when both lists are as long
    const words = terms.terms
      .filter((t) => t.status === 'verified' && t.german)
      .filter((t) => t.english.split(', ').every((w) => /^[A-Za-z]+$/.test(w)))
      .flatMap((t) => {
        // 'Pistol, revolver, handgun' is 'Pistole, Revolver, Kurzwaffe': each word has its own
        // German word when the lists are as long as each other, else the whole German text
        const english = t.english.split(', ')
        const german = (t.german ?? '').split(', ')
        return english.map((word, i) => ({
          word,
          german: (german.length === english.length ? german[i] : t.german) ?? '',
        }))
      })
    for (const [key, entry] of Object.entries(de)) {
      if (key in otherSense) continue
      for (const w of words.filter((w) => occurs(w.word, key)))
        expect(fold(textOf(entry)), `${key}: ${w.german}`).toContain(fold(w.german))
    }
  })

  it('does not write a rejected candidate of a decided term where its English word occurs', () => {
    for (const t of terms.terms.filter((r) => r.status === 'decided')) {
      const rejected = t.candidates.map((c) => c.german).filter((g) => g !== t.german)
      const asWord = rejected.map((r) => new RegExp(`(^|[^a-z])${fold(r)}(n|s|e|es|en)?($|[^a-z])`))
      for (const [key, entry] of Object.entries(de)) {
        if (key in otherSense || !termWords(t.english).some((w) => occurs(w, key))) continue
        for (const [i, pattern] of asWord.entries())
          expect(fold(textOf(entry)), `${key}: ${rejected[i]} for ${t.german}`).not.toMatch(pattern)
      }
    }
  })

  it('lists only texts that are in the English source', () => {
    expect(Object.keys(otherSense).filter((k) => !source.includes(k))).toEqual([])
  })
})
