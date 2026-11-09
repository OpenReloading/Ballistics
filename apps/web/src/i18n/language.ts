import { useSyncExternalStore } from 'react'
import { setRefusalWords } from '../lib/core-messages.ts'
import { storageName } from '../lib/edition.ts'
import { setShownLanguage } from './shown.ts'
import { type Catalogue, english as englishText, type Translator, translator } from './translate.ts'

/** English is the source text of the code and has no catalogue; every other language names its file in `loaders`. */
export const languages = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
] as const

export type Language = (typeof languages)[number]['code']

/** Loaded when the language is first chosen: its own chunk, so English pages ship without it. */
const loaders: Record<Exclude<Language, 'en'>, () => Promise<{ default: Catalogue }>> = {
  de: () => import('./de.json'),
}

/** The table of package and API messages: loaded with any language but English, read by `translateMessage`. */
const loadMessages = () =>
  import('../lib/core-message-table.ts').then((m) => m.installCoreMessages())

/** Loaded in every language once a page has started, so that no page carries them in its own JavaScript; the page renders again with them. */
const loadRefusalWords = () =>
  import('../lib/refusal-words.ts').then(
    (m) => {
      setRefusalWords(m.refusalSentence)
      publish({ ...current })
    },
    () => undefined,
  )

/** `localStorage` key of the chosen language. */
const languageKey = storageName('language')

/** The chosen language, with the functions of the language shown (English until its catalogue is loaded). */
type Translation = Translator & { chosen: Language }

const english: Translation = { chosen: 'en', ...englishText }

let current = english
const listeners = new Set<() => void>()

const publish = (next: Translation) => {
  current = next
  document.documentElement.lang = next.language
  setShownLanguage(next.language)
  for (const l of listeners) l()
}

/** Shows `code`: English at once, another language when its catalogue has loaded (a failed load keeps English). */
async function show(code: Language) {
  if (code === 'en') {
    if (current.chosen !== 'en') publish(english)
    return
  }
  if (current.chosen === code && current.language === code) return
  publish({ ...current, chosen: code })
  try {
    const [{ default: catalogue }] = await Promise.all([loaders[code](), loadMessages()])
    if (current.chosen === code) publish({ chosen: code, ...translator(catalogue, code) })
  } catch {
    // offline and never opened in this language: the text stays English, the choice stays stored
    if (current.chosen === code) publish({ chosen: code, ...translator() })
  }
}

const parse = (value: string | null): Language =>
  languages.find((l) => l.code === value)?.code ?? 'en'

/** Stores the choice and shows it; other tabs follow through `startLanguage`. */
export function chooseLanguage(code: Language) {
  try {
    localStorage.setItem(languageKey, code)
  } catch {}
  void show(code)
}

/** Called after mounting, as the server render and hydration are English and do not know the stored choice; follows a change made in another tab. */
export function startLanguage() {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(languageKey)
  } catch {}
  void show(parse(stored))
  void loadRefusalWords()
  const follow = (e: StorageEvent) => {
    if (e.key === languageKey) void show(parse(e.newValue))
  }
  window.addEventListener('storage', follow)
  return () => window.removeEventListener('storage', follow)
}

/** Calls `listener` when the language shown changes; the function it returns stops that. */
export const onLanguageChange = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The translation functions of the language shown and the language chosen, re-rendering on a change. */
export const useTranslation = () =>
  useSyncExternalStore(
    onLanguageChange,
    () => current,
    () => english,
  )
