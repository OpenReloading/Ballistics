import { type Messages, setupI18n } from '@lingui/core'
import { uiMessages } from '@rangefoundry/ui'
import type { Language } from '../i18n/language.ts'
import de from '../locales/de.json' with { type: 'json' }
import en from '../locales/en.json' with { type: 'json' }

const instance = (locale: Language, messages: Messages) =>
  setupI18n({ locale, messages: { [locale]: { ...uiMessages[locale], ...messages } } })

// one instance per language: activating a shared one changes boundaries that hydrate later (React #418)
const instances = { en: instance('en', en.messages), de: instance('de', de.messages) }

/** The Lingui messages of `language`, the language the views' own messages show, so one switch changes both. */
export const linguiOf = (language: string) => (language === 'de' ? instances.de : instances.en)
