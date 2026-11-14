import * as locale from '@rangefoundry/locale-format'
import { shownLanguage } from '../i18n/shown.ts'

/** The local calendar day of `d` as YYYY-MM-DD: the date of a print or a file name. */
export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The same on server and browser for one language; any other text as given. */
export const dayText = (day: string, language = shownLanguage()) => locale.dayText(day, language)

/** The month `index` (0 for January) by name in the language shown. */
export const monthText = (index: number, language = shownLanguage()) =>
  locale.monthText(index, language)

/** A date and time in the language shown; English follows the browser's locale, as it always did. */
export const dateTimeText = (d: Date, language = shownLanguage()) =>
  locale.dateTimeText(d, language)

/** A time of day in the language shown (English 24 hours). */
export const timeText = (d: Date, language = shownLanguage()) => locale.timeText(d, language)
