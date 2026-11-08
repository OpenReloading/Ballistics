import type { Messages } from '@lingui/core'
import de from './locales/de.json' with { type: 'json' }
import en from './locales/en.json' with { type: 'json' }

/** ui's own messages per language (compiled from src/locales/*.po), which an app loads beside its own. */
export const uiMessages: Record<'en' | 'de', Messages> = { en: en.messages, de: de.messages }
