const dayFormats = new Map<string, Intl.DateTimeFormat>()

/** English dates read day, month, year: the locale of English text is en-GB. */
const localeOf = (language: string) => (language === 'en' ? 'en-GB' : language)

/** A YYYY-MM-DD day as text in `language` ("1 May 2026", "1. Mai 2026"), the same in every time zone; any other text as given. */
export function dayText(day: string, language: string): string {
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

const monthFormats = new Map<string, Intl.DateTimeFormat>()

/** The month `index` (0 for January) by name in `language`. */
export function monthText(index: number, language: string): string {
  let format = monthFormats.get(language)
  if (!format) {
    format = new Intl.DateTimeFormat(localeOf(language), { month: 'long', timeZone: 'UTC' })
    monthFormats.set(language, format)
  }
  return format.format(Date.UTC(2026, index, 1))
}

/** A date and time in `language`; English follows the runtime's default locale. */
export const dateTimeText = (d: Date, language: string): string =>
  d.toLocaleString(language === 'en' ? undefined : language)

/** A time of day in `language` (English 24 hours). */
export const timeText = (d: Date, language: string): string =>
  d.toLocaleTimeString(localeOf(language))
