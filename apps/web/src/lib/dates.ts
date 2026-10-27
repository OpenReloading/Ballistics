import { shownLanguage } from '../i18n/shown.ts'

/** The local calendar day of `d` as YYYY-MM-DD: the date of a print or a file name. */
export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const dayFormats = new Map<string, Intl.DateTimeFormat>()

/** English dates read day, month, year: the locale of the English text is en-GB. */
const localeOf = (language: string) => (language === 'en' ? 'en-GB' : language)

/**
 * A YYYY-MM-DD day as text in the language shown ("1 May 2026", "1. Mai 2026"), the same on server
 * and browser for one language; any other text as given.
 */
export function dayText(day: string, language = shownLanguage()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return day
  let format = dayFormats.get(language)
  if (!format) {
    format = new Intl.DateTimeFormat(localeOf(language), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    dayFormats.set(language, format)
  }
  return format.format(new Date(day))
}

/** A date and time in the language shown; English follows the browser's locale, as it always did. */
export const dateTimeText = (d: Date, language = shownLanguage()) =>
  d.toLocaleString(language === 'en' ? undefined : language)

/** A time of day in the language shown (English 24 hours). */
export const timeText = (d: Date, language = shownLanguage()) =>
  d.toLocaleTimeString(localeOf(language))
