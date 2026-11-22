import { type Messages, setupI18n } from '@lingui/core'
import { uiMessages } from '@rangefoundry/ui'
import { startTransition, useEffect, useState } from 'react'
import { storageName } from '../lib/edition.ts'
import { storedChoice } from '../lib/stored-choice.ts'
import de from '../locales/de.json' with { type: 'json' }
import en from '../locales/en.json' with { type: 'json' }

type Language = keyof typeof uiMessages

const instance = (locale: Language, messages: Messages) =>
  setupI18n({ locale, messages: { [locale]: { ...uiMessages[locale], ...messages } } })

// one instance per language: activating a shared one changes boundaries that hydrate later (React #418)
const instances = { en: instance('en', en.messages), de: instance('de', de.messages) }

const languageChoice = storedChoice<Language>(
  storageName('language'),
  (text) => (text === 'de' ? 'de' : 'en'),
  (language) => language,
)

/** English for the prerender and hydration, then this edition's stored language. */
export function useStoredLanguage() {
  const [language, setLanguage] = useState<Language>('en')
  useEffect(() => {
    const follow = () => startTransition(() => setLanguage(languageChoice.read()))
    follow()
    return languageChoice.subscribe(follow)
  }, [])
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  return instances[language]
}
