'use client'

import { useTranslation } from '../i18n/language.ts'
import { localizeDecimals } from '../i18n/number.ts'

/** The server render and hydration are English, then the decimal mark follows the language setting. */
export function Decimal({ text }: { text: string }) {
  useTranslation()
  return localizeDecimals(text)
}
