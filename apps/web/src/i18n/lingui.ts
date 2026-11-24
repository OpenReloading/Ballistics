import { type I18n, type Messages, setupI18n } from '@lingui/core'
import { uiMessages } from '@rangefoundry/ui'
import en from '../locales/en.json' with { type: 'json' }
import type { Language } from './language.ts'

const instance = (locale: Language, messages: Messages) =>
  setupI18n({ locale, messages: { [locale]: { ...uiMessages[locale], ...messages } } })

// one instance per language: activating a shared one changes boundaries that hydrate later (React #418)
const instances: Record<Language, I18n> = {
  en: instance('en', en.messages),
  de: instance('de', {}),
}

/** The app's compiled messages of each language but English: its own chunk, so English pages ship without it. */
const catalogs = { de: () => import('../locales/de.json') }

/** Loads the app's messages of `language` into its instance; `language.ts` awaits it before showing the language. */
export async function loadLingui(language: keyof typeof catalogs) {
  const { default: catalog } = await catalogs[language]()
  instances[language].load(language, catalog.messages)
}

/** The Lingui messages of `language`, the language the views' own messages show, so one switch changes both. */
export const linguiOf = (language: string) => (language === 'de' ? instances.de : instances.en)
