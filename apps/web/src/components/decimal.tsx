'use client'

import { useTranslation } from '../i18n/language.ts'
import { localizeDecimals } from '../i18n/number.ts'

/**
 * Text of numbers that a server component wrote with a point, with the decimal mark of the language
 * shown: the server render and hydration are English, then it follows the setting.
 */
export function Decimal({ text }: { text: string }) {
  useTranslation()
  return localizeDecimals(text)
}
