'use client'

import { useTranslation } from '../i18n/language.ts'
import { dayText } from '../lib/dates.ts'

/** A YYYY-MM-DD day in the language shown: the server render and hydration are English, then it follows the setting. */
export function Day({ day }: { day: string }) {
  const { language } = useTranslation()
  return <time dateTime={day}>{dayText(day, language)}</time>
}
