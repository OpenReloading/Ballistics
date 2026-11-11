import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  baseList,
  extract,
  messages,
  problems,
  requiredMessages,
  safeWordingProblems,
  tableMessages,
  termUseProblems,
} from '../scripts/i18n.mts'

const source = messages()

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

describe('the catalogue lint', () => {
  it('names an unlisted or required missing text, a listed text with German or new to the list, a stray key, other placeholders, a wrong plural, a table text or an unlisted worded text left English, and a text listed as English that has German', () => {
    const catalogue = {
      'Value {n}': 'Wert {m}',
      Stray: 'Streuner',
      '{count} row|{count} rows': { one: '{count} Zeile', few: '{count} Zeilen' },
      Busy: 'Busy',
      Done: 'Fertig',
      Wind: 'Wind',
      Open: 'Open',
      '{a}: {b}': '{a}: {b}',
      '"{a}"': '"{a}"',
      '{count} file|{count} files': { other: '{count} files', one: '{count} file' },
    }
    const english = ['Wind', 'Open', '{a}: {b}', '"{a}"', '{count} file|{count} files']
    expect(
      problems(
        [
          'Value {n}',
          'Missing',
          'Listed',
          'New',
          '{count} row|{count} rows',
          'Busy',
          'Done',
          ...english,
        ],
        catalogue,
        'de',
        ['Busy', 'Missing'],
        ['Missing', 'Listed', 'Done'],
        ['Missing', 'Done'],
        ['Wind', 'Busy', 'Done', '{a}: {b}', 'Wind'],
      ),
    ).toEqual([
      'untranslated: Missing',
      'untranslated: New',
      'listed as untranslated, but translated or gone: Done',
      'listed as untranslated, but the base does not list it: Listed',
      'no message has this key: Stray',
      'placeholders differ: Value {n}',
      'few is no plural category of de: {count} row|{count} rows',
      'left English: Busy',
      'left English: Open',
      'left English: "{a}"',
      'left English: {count} file|{count} files',
      'listed as equal to English, but translated or gone: Done',
      'listed as equal to English, but needs no entry or is listed twice: {a}: {b}',
      'listed as equal to English, but needs no entry or is listed twice: Wind',
    ])
  })

  it('reads the untranslated list of the base and refuses a base without one', () => {
    expect(baseList('{"untranslated":{"de":["Listed"]}}', 'de', 'abc1234')).toEqual(['Listed'])
    expect(() => baseList('{"safeTexts":[]}', 'de', 'abc1234')).toThrow(/abc1234/)
  })

  it('names a German text without the verified term or with a rejected candidate, and a safe word without approval', () => {
    const table = {
      sources: { a: { document: 'A', edition: '1', pages: 'p.' } },
      terms: [
        {
          key: 'case',
          english: 'Case',
          german: 'Hülse',
          status: 'verified',
          group: 'components',
          sources: [{ doc: 'a', at: '1' }],
          candidates: [],
        },
        {
          key: 'event',
          english: 'Event',
          german: 'Wettbewerb',
          status: 'decided',
          group: 'target-shooting',
          sources: [],
          candidates: [
            { german: 'Wettbewerb', sources: [{ doc: 'a', at: '2' }] },
            { german: 'Disziplin', sources: [{ doc: 'a', at: '3' }] },
          ],
          decision: 'Rule c: more sources.',
        },
      ],
    }
    const keys = ['Case length', 'Event date', 'Corner case']
    expect(
      termUseProblems(
        { 'Case length': 'Länge', 'Event date': 'Disziplin-Datum', 'Corner case': 'Eckfall' },
        table,
        { 'Corner case': 'case: a combination' },
        keys,
      ),
    ).toEqual(['Case length: Hülse', 'Event date: Disziplin, a rejected candidate of Wettbewerb'])
    expect(
      safeWordingProblems(
        ['A safe load', 'Handle it safely', 'Safety notice'],
        { 'Safety notice': 'Hinweis' },
        ['Safety notice'],
      ),
    ).toEqual([
      'says safe without approval: A safe load',
      'says safe without approval: Handle it safely',
      'says "sicher" other than "safe" 1 times: Safety notice',
    ])
  })

  it('counts the warning sentences and refusal words the two files mark as texts of the table', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'i18n-'))
    try {
      mkdirSync(path.join(root, 'src/lib'), { recursive: true })
      writeFileSync(
        path.join(root, 'src/lib/core-message-table.json'),
        JSON.stringify({ codes: ['busy'], templates: { truing: ['range {n}'] } }),
      )
      writeFileSync(
        path.join(root, 'src/lib/core-message-table.ts'),
        "import { msg } from '../i18n/translate.ts'\nexport const w = [msg('A seeded warning.')]\n",
      )
      writeFileSync(
        path.join(root, 'src/lib/refusal-words.ts'),
        "import { msg } from '../i18n/translate.ts'\nexport const r = { x: msg('A seeded refusal.') }\n",
      )
      writeFileSync(
        path.join(root, 'src/lib/safety.ts'),
        "import { msg } from '../i18n/translate.ts'\nexport const safety = { binding: msg('A seeded safety line.') }\n",
      )
      const table = tableMessages(root)
      expect(table).toEqual(['busy', 'range {n}', 'A seeded warning.', 'A seeded refusal.'])
      // the lines of the Safety notice need German too
      expect(problems(['A seeded safety line.'], {}, 'de', requiredMessages(root))).toEqual([
        'untranslated: A seeded safety line.',
      ])
      expect(
        problems(
          table,
          {
            busy: 'besetzt',
            'range {n}': 'Entfernung {n}',
            'A seeded warning.': 'A seeded warning.',
            'A seeded refusal.': 'Eine gesetzte Ablehnung.',
          },
          'de',
          table,
        ),
      ).toEqual(['left English: A seeded warning.'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
