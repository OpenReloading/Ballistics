import { type Formatter, type I18n, type Messages, setupI18n } from '@lingui/core'
import { uiMessages } from '@rangefoundry/ui'
import type { Language } from './language.ts'

/** A compiled catalog's messages: a JSON import types their tokens as arrays, not the tuples Lingui reads. */
const compiled = (catalog: { messages: object }) => catalog.messages as Messages

/** `{x, decimal}`: a number with the language's decimal mark, ungrouped and unrounded, as `t` writes one. */
const decimal: Formatter = (value, { locale }) =>
  new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 20 }).format(
    value as number,
  )

const instance = (locale: Language, messages: Messages) =>
  setupI18n({
    locale,
    messages: { [locale]: { ...uiMessages[locale], ...messages } },
    formatters: { decimal },
  })

// one instance per language: activating a shared one changes boundaries that hydrate later (React #418)
const instances: Record<Language, I18n> = {
  en: instance('en', {}),
  de: instance('de', {}),
}

/** Adds compiled English: each module with messages loads its own (a worker's, the module that shows them), so a page carries only the English it shows. In place, as `load` emits a change that would re-render the tree while a route's modules evaluate. */
export const loadEnglish = (...catalogs: { messages: object }[]) => {
  for (const catalog of catalogs) Object.assign(instances.en.messages, compiled(catalog))
}

/** The app's compiled messages of each language but English, the views' and the message table's: their own chunks, so English pages ship without them. */
const catalogs = {
  de: () => Promise.all([import('../locales/de.json'), import('../locales/table/de.json')]),
}

/** Loads the app's messages of `language` into its instance and returns it; `language.ts` awaits it with the message table before showing the language. */
export async function loadLingui(language: keyof typeof catalogs) {
  const [views, table] = await catalogs[language]()
  instances[language].load(language, { ...compiled(views.default), ...compiled(table.default) })
  return instances[language]
}

/** The `formats` of an `i18n._` plural: its `#` ungrouped, as the own messages show a number. */
export const ungrouped = { number: { useGrouping: false } }

/** The Lingui messages of `language`, the language the views' own messages show, so one switch changes both. */
export const linguiOf = (language: string) => (language === 'de' ? instances.de : instances.en)
