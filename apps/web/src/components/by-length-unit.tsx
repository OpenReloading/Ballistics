'use client'

import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { localizeDecimals } from '../i18n/number.ts'
import { drawingLengthUnit } from '../lib/units.ts'
import { useUnits } from './units-settings.tsx'

/**
 * A figure in the Settings length unit: both are given as elements and only the one in the unit is
 * rendered (mm until the stored choice is read, as every value on the page).
 */
export function ByLengthUnit({ mm, inch }: { mm: ReactNode; inch: ReactNode }) {
  const { system } = useUnits()
  // follows the language shown
  useTranslation()
  const shown = drawingLengthUnit(system) === 'in' ? inch : mm
  // the server wrote the numbers with a point
  return typeof shown === 'string' ? localizeDecimals(shown) : shown
}
