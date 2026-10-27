import { afterEach, describe, expect, it, vi } from 'vitest'
import de from '../src/i18n/de.json'
import { chooseLanguage, startLanguage } from '../src/i18n/language.ts'
import { msg, translator } from '../src/i18n/translate.ts'

const german = translator(de, 'de')
const english = translator()
const count = ['{count} record', '{count} records'] as const

describe('translator', () => {
  it('shows the English text without a catalogue', () => {
    expect(english.t('Settings')).toBe('Settings')
    expect(english.language).toBe('en')
  })

  it('translates from the catalogue', () => {
    expect(german.t('Settings')).toBe('Einstellungen')
    expect(german.language).toBe('de')
  })

  it('shows a text the catalogue lacks as written, never a key or a blank', () => {
    expect(german.t('A text no catalogue has')).toBe('A text no catalogue has')
    expect(german.t('A {thing} no catalogue has', { thing: 'text' })).toBe(
      'A text no catalogue has',
    )
    expect(german.tn(1, 'One {count} thing', 'Many {count} things')).toBe('One 1 thing')
    expect(german.tn(2, 'One {count} thing', 'Many {count} things')).toBe('Many 2 things')
  })

  it('shows the English plural forms when the entry is not a plural', () => {
    const wrong = translator({ [`${count[0]}|${count[1]}`]: 'Datensätze' }, 'de')
    expect(wrong.tn(1, ...count)).toBe('1 record')
  })

  it('picks the plural form of the language shown', () => {
    expect([0, 1, 2].map((n) => german.tn(n, ...count))).toEqual([
      '0 Datensätze',
      '1 Datensatz',
      '2 Datensätze',
    ])
    expect([0, 1, 2].map((n) => english.tn(n, ...count))).toEqual([
      '0 records',
      '1 record',
      '2 records',
    ])
  })

  it('falls back to the other form when the entry lacks the category', () => {
    const only = translator({ [`${count[0]}|${count[1]}`]: { other: '{count} Stück' } }, 'de')
    expect(only.tn(1, ...count)).toBe('1 Stück')
  })

  it('formats a number value with the language shown, without digit grouping', () => {
    expect(german.t('Value {n}', { n: 1234.5 })).toBe('Value 1234,5')
    expect(english.t('Value {n}', { n: 1234.5 })).toBe('Value 1234.5')
    expect(german.tn(1234, ...count)).toBe('1234 Datensätze')
  })

  it('leaves a placeholder without a value in place', () => {
    expect(english.t('Value {n}', { m: 1 })).toBe('Value {n}')
  })

  it('takes a marked message where the text is no literal at the call', () => {
    const labels = [msg('Settings')]
    expect(german.t(labels[0] ?? msg(''))).toBe('Einstellungen')
    const dynamic: string = String(labels.length)
    // @ts-expect-error a string that is no literal would escape extraction
    english.t(dynamic)
    // @ts-expect-error the forms of a plural are literals too
    english.tn(1, dynamic, 'other')
  })
})

describe('language setting', () => {
  const store = new Map<string, string>()
  const listeners: ((e: { key: string; newValue: string | null }) => void)[] = []
  const doc = { documentElement: { lang: 'en' } }

  vi.stubGlobal('document', doc)
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  })
  vi.stubGlobal('window', {
    addEventListener: (_: string, f: (typeof listeners)[number]) => listeners.push(f),
    removeEventListener: () => {},
  })

  afterEach(() => store.clear())

  it('stores the choice, loads the catalogue and sets the document language', async () => {
    chooseLanguage('de')
    await vi.waitFor(() => expect(doc.documentElement.lang).toBe('de'))
    expect(store.get('language')).toBe('de')
    chooseLanguage('en')
    expect(doc.documentElement.lang).toBe('en')
    expect(store.get('language')).toBe('en')
  })

  it('applies the stored language when it starts and one stored by another tab later', async () => {
    store.set('language', 'de')
    startLanguage()
    await vi.waitFor(() => expect(doc.documentElement.lang).toBe('de'))
    for (const l of listeners) l({ key: 'language', newValue: 'en' })
    await vi.waitFor(() => expect(doc.documentElement.lang).toBe('en'))
  })

  it('reads an unknown stored value as English', async () => {
    startLanguage()
    for (const l of listeners) l({ key: 'language', newValue: 'de' })
    await vi.waitFor(() => expect(doc.documentElement.lang).toBe('de'))
    for (const l of listeners) l({ key: 'language', newValue: 'xx' })
    await vi.waitFor(() => expect(doc.documentElement.lang).toBe('en'))
  })
})
